async function initializeAzureStorage() {
  try {
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error('Azure Storage connection string is not set');
    }
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    containerClient = blobServiceClient.getContainerClient('resume');
    await containerClient.getProperties();
    logger.info('Successfully connected to Azure Blob Storage');
  } catch (error) {
    logger.error('Failed to initialize Azure Blob storage:', error);
    // You might want to exit the process here or handle it differently
    // process.exit(1);
  }
}

module.exports = { initializeAzureStorage };

