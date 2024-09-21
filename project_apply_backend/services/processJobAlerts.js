const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { sendJobAlertEmail } = require('../utils/sendJobAlerts');
const { JobPost, User, UserJobMatch } = require('../models/models');
const { fetchResumeFile } = require('../utils/fetchResumeFile');
const { extractJobInfo } = require('../utils/jobDescriptionParser');
const logger = require('../utils/logger');
const { BATCH_SIZE } = require('../config/constants');
const { cleanJobPosts, getJobFreshness } = require('../utils/commonOperations');

async function processJobAlerts(userId) {
  const user = await User.findById(userId);
  logger.info(`user: ${JSON.stringify(user, null, 2)}`);
  let newJobPosts = await JobPost.find({
    createdAt: { $gt: user.lastProcessedAt || new Date(0) },
  })
    .sort({ createdAt: -1 })
    // .limit(12) // TODO - might remove this, as i am already doing batch processing
    .select(
      'id title jobTypeReference extractedJob experience domain companyImage apply createdAt salary'
    )
    .lean(); // Use lean() to return plain JavaScript objects instead of Mongoose documents, skips hydrating the result into a Mongoose document; reduces memory usage and improves performance for large datasets and omits virtuals, getters, setters, and custom methods of Mongoose documents.

  const jobPostsList = newJobPosts.map((job) => ({
    id: job.id,
    title: job.title,
    jobType: job.jobTypeReference.jobType,
    extractedJob: job.extractedJob,
    experience: job.experience.experience,
    domain: job.domain.domain,
  }));

  if (!newJobPosts || newJobPosts.length === 0)
    return { message: 'No new job posts to process' };

  let filteredJobs = {};
  let personalizedJobRecommendations = [];
  if (jobPostsList.length > 0) {
    const resumeFile = await fetchResumeFile(user.resumeUrl);
    for (let i = 0; i < jobPostsList.length; i += BATCH_SIZE) {
      const batch = jobPostsList.slice(i, i + BATCH_SIZE);

      let tempFilteredJobs = await filterJobsWithGemini(
        user.jobFilter,
        batch,
        resumeFile
      );

      filteredJobs = { ...filteredJobs, ...tempFilteredJobs };
    }

    await saveMatchingJobs(filteredJobs, userId);

    personalizedJobRecommendations = newJobPosts
      .filter((job) => filteredJobs[job.id])
      .map(
        ({
          apply,
          companyImage,
          domain,
          experience,
          id,
          createdAt,
          salary,
          jobTypeReference,
          title,
          extractedJob,
        }) => {
          const {
            resumeMatchScore,
            requirementMatchScore,
            overallMatchScore,
            fitReason,
            areasForImprovement,
          } = filteredJobs[id];

          return {
            apply,
            companyImage: companyImage.url,
            companyName: extractedJob['Company Name'],
            domain: domain.domain,
            experience: experience.experience,
            id,
            createdAt: getJobFreshness(createdAt['$date']),
            salary,
            jobTypeReference: jobTypeReference.jobType,
            title,
            resumeMatchScore,
            requirementMatchScore,
            overallMatchScore,
            fitReason,
            areasForImprovement,
          };
        }
      );


    if (personalizedJobRecommendations.length > 0) {
      sendJobAlertEmail(user.email, personalizedJobRecommendations);
    }

    user.lastProcessedAt = new Date();
    user.lastProcessedJobId = newJobPosts[newJobPosts.length - 1].id;
    await user.save();
  }

  return {
    message: 'Job alerts processed successfully',
    personalizedJobRecommendations,
    totalJobsProcessed: personalizedJobRecommendations.length,
  };
}

async function saveMatchingJobs(filteredJobs, userId) {
  const filteredJobsToBulkUpsert = Object.entries(filteredJobs).map(
    ([jobId, job]) => {
      return {
        updateOne: {
          filter: { userId: userId, jobId: jobId },
          update: {
            $set: {
              resumeMatchScore: job.resumeMatchScore,
              requirementMatchScore: job.requirementMatchScore,
              overallMatchScore: job.overallMatchScore,
              fitReason: job.fitReason,
              areasForImprovement: job.areasForImprovement,
              createdAt: new Date().toISOString(),
            },
          },
          upsert: true,
        },
      };
    }
  );

  let result = await UserJobMatch.bulkWrite(filteredJobsToBulkUpsert);
  return result;
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

    // Processing any failed job posts
    const unprocessedOrFailedJobPosts = await JobPost.find({
      $or: [{ extractedJob: { $exists: false } }, { extractedJob: null }],
    });

    unprocessedJobPosts.push(...unprocessedOrFailedJobPosts);

    logger.info(`Job posts to process: ${unprocessedJobPosts.length}`);
    if (unprocessedJobPosts.length > 0) {
      for (let i = 0; i < unprocessedJobPosts.length; i += BATCH_SIZE) {
        const batch = unprocessedJobPosts.slice(i, i + BATCH_SIZE);
        const processedJobBatch = await extractJobInfo(batch);
        // TODO - Can go for a bulk update here
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
    const genAI = new GoogleGenerativeAI(process.env.EXPRESS_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      systemInstruction:
        'Return valid, parsable JSON array of objects with no "\n" escapes or extra formatting. Verify JSON validity in Node.js environment before responding. Follow all prompt instructions carefully.JSON.parse() should not throw any errors when I try to parse the response.',
      generationConfig: {
        temperature: 1.0,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
      ],
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
      - "id" - The job id
      - "resumeMatchScore": A number from 0-100 indicating how well the job aligns with the user's resume.
      - "requirementMatchScore": A number from 0-100 indicating how well the job aligns with the user's specified requirements in the JSON file.
      - "overallMatchScore": An average of resumeMatchScore and requirementMatchScore.
      - "fitReason": A single concise string (max 100 words) highlighting the candidate's strongest matching skills or experiences for this role. Focus on the most relevant qualifications that align with key job requirements.

      - "areasForImprovement": A single concise string (max 100 words) providing an honest evaluation of the candidate's suitability, including:
          1. A brief assessment of the overall match.
          2. One key strength relevant to the role.
          3. One significant gap or area for improvement.
          4. A clear recommendation on whether to apply.
          Be specific and honest, balancing encouragement with realistic advice.
      
      5. Sort the results by overallMatchScore in descending order.
      6. Return a JSON array of filtered and sorted job posts. Include only the new fields from point 4 for each job. Exclude all input fields (extractedJob, domain, experience, title).
      
      Be realistic and nuanced in your matching. Consider synonyms and related terms, but also acknowledge that not all skills or experiences will be exact matches. Provide a balanced view of the user's fit for each role.
  
      Remember:
      - No candidate is likely to be a perfect match for all job requirements.
      - Highlight specific strengths while also noting areas for potential growth.
      - Be honest about potential mismatches.
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
          "fitReason": "5 years Python experience and AWS knowledge align well with requirements.",
          "areasForImprovement": "Gap: No Kubernetes experience. Consider learning it to improve candidacy."
        },
      }
      where 123 is the job id.

      IMPORTANT: Ensure your response is a valid JSON object. Properly escape all string values, especially those containing quotes or special characters. For example:
      {
        "123": {
          "fitReason": "Your experience with \"Python\" and AWS aligns well with the job requirements.",
        }
      }
    `;

    const result = await model.generateContent([prompt, resumeFile]);

    let finalProcessedJobs;
    const rawJobsData = result.response.candidates[0].content.parts[0].text;
    logger.info(`rawJobsData: ${rawJobsData}`);
    if (typeof rawJobsData === 'string') {
      const cleanedString = rawJobsData.trim();
      finalProcessedJobs = JSON.parse(cleanedString);
    } else {
      finalProcessedJobs = rawJobsData;
    }

    const groupedJobs = {};
    finalProcessedJobs.forEach((job) => {
      if (!groupedJobs[job.id]) {
        groupedJobs[job.id] = job;
      }
    });

    return groupedJobs;
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
