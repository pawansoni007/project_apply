const { streamToBuffer } = require("./streamToBuffer");
const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();
  
// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient('resume');


async function fetchResumeFile(resumeUrl) {
  try {
    // logger.info(`Fetching resume file: ${resumeUrl}`);
    // Extract the blob name from the full URL
    const url = new URL(resumeUrl);
    const blobName = url.pathname.split('/').pop();
    
    const blobClient = containerClient.getBlobClient(blobName); // blobName is the filename
    const downloadBlockBlobResponse = await blobClient.download();
    const buffer = await streamToBuffer(
      downloadBlockBlobResponse.readableStreamBody
    );

    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: 'application/pdf', // Adjust if your resumes are in a different format
      },
    };
  } catch (error) {
    console.error('Error fetching resume file:', error);
    return null;
  }
}

module.exports = { fetchResumeFile };

