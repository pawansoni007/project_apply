const cron = require('node-cron');
const app = require('./app');
const express = require('express');
// const app = express();
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const retry = require('async-retry');
const { port } = require('./config/server');
const dotenv = require('dotenv');
const {
  processJobAlerts,
  processUnextractedJobPosts,
} = require('./services/processJobAlerts');

dotenv.config();

connectDB();

app.get('/process-job-alerts', async (req, res) => {
  try {
    await processJobAlerts();
    res.json({ message: 'Job alerts processed successfully' });
  } catch (error) {
    logger.error('Error in processJobAlerts:', error);
    res
      .status(500)
      .json({ message: 'Failed to process job alerts', error: error.message });
  }
});

// Cron job to run every 3 hours
cron.schedule('0 */3 * * *', async () => {
  console.log('Running job alerts');
  processUnextractedJobPosts.catch(error => {
    logger.error('Error in processUnextractedJobPosts:', error);
  })
});

app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    logger.error(`Error starting server: ${err}`);
    return;
  }

  retry(async () => {
    await processUnextractedJobPosts();
  }, {
    retries: 7,
    minTimeout: 45000, // 45 seconds
    maxTimeout: 1800000, // 30 minutes
    factor: 4,
    onRetry: (error, attempt) => {
      logger.error(`Attempt ${attempt}: Error in processUnextractedJobPosts: ${error}`);
    }
  }).catch((error) => {
    logger.error('Failed to process unextracted job posts after retries:', error);
  });

  logger.info(`Server running on http://localhost:${port}`);
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
