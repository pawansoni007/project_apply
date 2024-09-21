const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger');
const dotenv = require('dotenv');
dotenv.config();

async function extractJobInfo(parsedJobPostsWithClampedJsons) {
  const ai = new GoogleGenerativeAI(process.env.EXPRESS_GEMINI_API_KEY_2);
  const model = ai.getGenerativeModel({
    model: 'gemini-1.5-pro',
    systemInstruction:
      'Return a proper JSON array of object without any escape characters and double check if the JSON is valid before returning',
  });

  const prompt = `
  Extract the following information from each job post in the provided JSON array:
    1. Overview: A brief summary of the job (extract from the general description if no specific overview is given)
    2. Responsibilities: List as an array of strings
    3. Requirements: List as an array of strings
    4. Location: As a string (if available)
    5. id: Use the 'id' field from the input JSON
    6. Company Name: Extract from the job description if possible

  Instructions:
  - Return the information in a plain JSON format(array of objects, where each object is a job description of a job post), without any markdown or additional formatting.
  - Remove all HTML tags from the extracted text.
  - If any field is not found in the job post, include it as an empty string or empty array as appropriate.
  - For the Overview, use the first paragraph or two if no clear overview section is present.
  - Generate the job posting information as a valid JSON array of objects. Each object should include all specified fields (id, Overview, Responsibilities, Requirements, Location, Company Name). Ensure all string values are properly escaped, especially when they contain quotes or special characters. The following example demonstrates proper string escaping within a single field of one object, but your output should be a complete array of full job posting objects:

  Example:
  {
    "Overview": "Builder.ai empowers entrepreneurs. Fast Company's 2023 \"Most Innovative in AI\", Europas 2022 \"Scaleup of the Year.\"",
  }

  The input JSON array of job posts is as follows:
  ${JSON.stringify(parsedJobPostsWithClampedJsons)}

  Please process each job post and return an array of JSON objects with the extracted information without any markdown formatting around or additional text. 
`;

  const result = await model.generateContentStream([prompt]);
  let jobInfo = '';
  for await (const chunk of result.stream) {
    jobInfo += chunk.text();
  }

  // Post-processing to remove escape sequences
  jobInfo = jobInfo
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  jobInfo = jobInfo.replace(/^```json\n/, '').replace(/\n```$/, '');

  try {
    // Try to parse it if it's a string, or return as is if it's already an object
    const parsedJobInfo =
      typeof jobInfo === 'string' ? JSON.parse(jobInfo) : jobInfo;
    logger.info(
      `Raw extracted job info: ${JSON.stringify(parsedJobInfo, null, 2)}`
    );
    return parsedJobInfo;
  } catch (error) {
    logger.error(`Error parsing job info: ${error.message}`);
    logger.error(`Raw job info: ${jobInfo}`);
    // return jobInfo;
    throw new Error('Failed to parse extracted job information');
  }
}

module.exports = { extractJobInfo };
