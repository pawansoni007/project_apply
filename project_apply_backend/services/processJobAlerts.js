const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { sendJobAlertEmail } = require('../utils/sendJobAlerts');
const { JobPost, User } = require('../models/models');
const { fetchResumeFile } = require('../utils/fetchResumeFile');
const { extractJobInfo } = require('../utils/jobDescriptionParser');
const logger = require('../utils/logger');
const { BATCH_SIZE } = require('../config/constants');
const { cleanJobPosts } = require('../utils/commonOperations');

async function processJobAlerts(userId) {
  let newJobPosts = await JobPost.find({
    createdAt: { $gt: user.lastProcessedAt || new Date(0) },
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .select(
      'title "jobTypeReference.jobType" extractedJob experience.experience domain'
    )
    .lean(); // Use lean() to return plain JavaScript objects instead of Mongoose documents, skips hydrating the result into a Mongoose document; reduces memory usage and improves performance for large datasets and omits virtuals, getters, setters, and custom methods of Mongoose documents. 

  if (!newJobPosts || newJobPosts.length === 0)
    return { message: 'No new job posts to process' };

  const user = await User.findById(userId);

  if (jobPostsToFilterForUser.length > 0) {
    const resumeFile = await fetchResumeFile(user.resumeUrl);
    const filteredJobs = await filterJobsWithGemini(
      user.jobFilter,
      newJobPosts,
      resumeFile
    );

    logger.info(`------------------------------------------------`);
    logger.info(`Filtered jobs: ${JSON.stringify(filteredJobs)}`);
    logger.info(`------------------------------------------------`);

    if (filteredJobs.length > 0) {
      sendJobAlertEmail(user.email, filteredJobs);
    }

    user.lastProcessedAt = new Date();
    await user.save();
  }
  return {
    message: 'Job alerts processed successfully',
    // jobsProcessed: newJobPosts.length,
    // newJobsFound: newJobPosts.length,
    // filteredJobsCount: filteredJobs ? filteredJobs.length : 0
  };
}

async function processUnextractedJobPosts() {
  try {
    const jobPosts = await fetchAndStoreJobPosts();
    // Remove any re-fetched jobs that were already processed
    const alreadyProcessedJobIds = await JobPost.find({
      extractedJob: { $exists: true, $ne: null },
    }).distinct('id');
    const newJobPosts = jobPosts.filter(
      (job) => !alreadyProcessedJobIds.includes(job.id)
    );
    const unprocessedJobPosts = cleanJobPosts(newJobPosts);

    logger.info(`Job posts to process: ${unprocessedJobPosts.length}`);

    if (unprocessedJobPosts.length > 0) {
      for (let i = 0; i < unprocessedJobPosts.length; i += BATCH_SIZE) {
        const batch = unprocessedJobPosts.slice(i, i + BATCH_SIZE);
        const processedJobBatch = await extractJobInfo(batch);

        for (const job of processedJobBatch) {
          try {
            const updatedJob = await JobPost.findOneAndUpdate(
              { id: job.id },
              { $set: { extractedJob: job }, $unset: { body: '' } },
              { upsert: true, new: true }
            );
            logger.info(`------------------------------------------------`);
            logger.info(`job post: ${JSON.stringify(updatedJob, null, 2)}`);
            logger.info(`------------------------------------------------`);
          } catch (error) {
            logger.error(`Error updating job post: ${error}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Error processing unextracted job posts: ${error}`);
    throw error;
  }
}

async function filterJobsWithGemini(userFilter, jobPosts, resumeFile) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.EXPRESS_GEMINI_API_KEY_3);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      systemInstruction:
        'Return a JSON object as specified in the prompt without any formattings or markdown applied around the response.',
    });

    const prompt = `
    You are an AI assistant tasked with filtering job posts based on user requirements and their resume. You will receive a list of job posts as a JSON object, a JSON object containing user requirements, and the user's resume as a file attachment. Your task is to:
    
    1. Analyze each job post's description and details.
    2. Compare the job post against the user's requirements and resume.
    3. Include the job post in the results if:
    - The experience range matches (or is close to) the user's specified range and resume experience.
    - At least ${
      userFilter.skillMatchPercentage
    }% of the user's specified skills in the json file or skills mentioned in their resume are mentioned or implied in the job description.
      - The job domain matches one of the user's specified domains or aligns with their resume.
      
      4. For each matching job post, add the following fields:
      - "resumeMatchScore": A number from 0-100 indicating how well the job aligns with the user's resume.
      - "requirementMatchScore": A number from 0-100 indicating how well the job aligns with the user's specified requirements in the JSON file.
      - "overallMatchScore": An average of resumeMatchScore and requirementMatchScore.
      - "fitReason": A brief, balanced explanation of why the user might be a good fit for this job, highlighting specific matching skills or experiences without overgeneralizing.
      - "areasForImprovement": A constructive, brief explanation of potential gaps or areas where the user might need to develop further to fully meet the job requirements. This should be realistic without being demotivating.
      
      5. Sort the results by overallMatchScore in descending order.
      6. Return the filtered and sorted job posts as a JSON array, including the new fields for each job post, but do not include extractedJob, domain, experience, title which is passed as an input.
      
      Be realistic and nuanced in your matching. Consider synonyms and related terms, but also acknowledge that not all skills or experiences will be exact matches. Provide a balanced view of the user's fit for each role.
  
      Remember:
      - No candidate is likely to be a perfect match for all job requirements.
      - Highlight specific strengths while also noting areas for potential growth.
      - Be honest about potential mismatches without being discouraging.
      - Avoid overgeneralizing or making assumptions about the user's abilities beyond what's stated in their resume or requirements.
      
      Here are the user requirements:
      ${JSON.stringify(userFilter)}
      
      The user's resume is attached as a file. Please analyze it for relevant skills and experience.
      
      And here are the job posts to filter:
      ${JSON.stringify(jobPosts)}
      
      Please provide your filtered and sorted results as a JSON array, including resumeMatchScore, requirementMatchScore, overallMatchScore, fitReason, and areasForImprovement for each job post.
      
      Example json output:
      {
        "123": {
          "resumeMatchScore": 80,
          "requirementMatchScore": 90,
          "overallMatchScore": 85,
          "fitReason": "Your 5 years of Python development aligns well with the job's requirements. Your experience with AWS services is also a strong match.",
          "areasForImprovement": "The role requires experience with Kubernetes, which isn't mentioned in your resume. Consider gaining some exposure to this technology."
        },
        "456": {
          "resumeMatchScore": 75,
          "requirementMatchScore": 85,
          "overallMatchScore": 80,
          "fitReason": "Your background in data analysis and proficiency in SQL make you a strong candidate for this data scientist role.",
          "areasForImprovement": "The job emphasizes machine learning skills. While you have some experience, deepening your knowledge in this area could strengthen your candidacy."
        }
      }
      where 123 and 456 are the job ids.
    `;

    const result = await model.generateContent([prompt, resumeFile]);
    const response = result.response;
    logger.info(`Response: ${JSON.stringify(response)}`);
    return JSON.parse(response.text());
  } catch (error) {
    logger.error(`Error filtering jobs with Gemini: ${error}`);
    throw error;
  }
}

async function fetchAndStoreJobPosts() {
  try {
    let jobPosts;
    let data = JSON.stringify({
      query:
        '\n  query JobPosts {\n    jobPosts(orderBy: createdAt_DESC, first:30) {\n      id\n      title\n      slug\n      companyImage {\n        url\n      }\n      body {\n        html\n      }\n      author\n      salary\n      createdAt\n      skill {\n        skills\n      }\n      experience {\n        experience\n      }\n      domain {\n        domain\n      }\n      jobTypeReference {\n        jobType\n      }\n      apply\n    }\n  }\n',
      operationName: 'JobPosts',
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.EXPRESS_BACKEND_JOB_SOURCE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };

    const response = await axios.request(config);
    jobPosts = response.data.data.jobPosts;

    // Get the IDs of the new job posts
    // const newJobIds = jobPosts.map((job) => job.id);

    jobPosts.forEach((job) => {
      delete job.slug;
      delete job.author;
      delete job.skill;
    });

    // Filter out internships and then update existing jobs or insert new ones
    const fullTimeJobs = jobPosts.filter(
      (job) => job.jobTypeReference.jobType === 'Full Time'
    );

    // logger.info(`Job posts: ${JSON.stringify(fullTimeJobs)}`);

    // Upsert the full-time jobs into the database
    const bulkOps = fullTimeJobs.map((job) => ({
      updateOne: {
        filter: { id: job.id },
        update: { $set: job },
        upsert: true,
      },
    }));

    const result = await JobPost.bulkWrite(bulkOps);
    logger.info(
      `Upserted ${result.upsertedCount} new job posts, modified ${result.modifiedCount} existing posts`
    );

    // Fetch only the newly upserted job posts
    const upsertedIds = Object.values(result.upsertedIds);
    const upsertedJobs = await JobPost.find({ _id: { $in: upsertedIds } });

    return upsertedJobs;
  } catch (error) {
    logger.error('Error fetching and storing job posts:', error);
  }
}

module.exports = {
  processJobAlerts,
  sendJobAlertEmail,
  filterJobsWithGemini,
  fetchAndStoreJobPosts,
  processUnextractedJobPosts,
};
