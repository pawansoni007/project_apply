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
const { User } = require('./models/models');

dotenv.config();

connectDB();

// Cron job to run every 3 hours
cron.schedule('0 */3 * * *', async () => {
  console.log('Running job alerts');
  processUnextractedJobPosts.catch((error) => {
    logger.error('Error in processUnextractedJobPosts:', error);
  });
});

cron.schedule('0 */3 * * *', async () => {
  const users = User.find().lean();
  for (const user of users) {
    processJobAlerts(user._id).catch((error) => {
      console.error(`Error in processJobAlerts: ${error}`);
      logger.error(`Error in processJobAlerts: ${error}`);
    });
  }
});

app.listen(port, '0.0.0.0', async (err) => {
  if (err) {
    logger.error(`Error starting server: ${err}`);
    return;
  }

  setupForStartup().catch((error) => {
    logger.error('Error in setupForStartup:', error);
  });

  logger.info(`Server running on http://localhost:${port}`);
});

async function setupForStartup() {
  try {
    await retry(
      async () => {
        try {
          await processUnextractedJobPosts();
        } catch (error) {
          logger.error(`Error in processUnextractedJobPosts: ${error}`);
          throw error;
        }
      },
      {
        retries: 7,
        minTimeout: 45000, // 45 seconds
        maxTimeout: 1800000, // 30 minutes
        factor: 4,
        onRetry: (error, attempt) => {
          logger.error(
            `Attempt ${attempt}: Error in processUnextractedJobPosts: ${error}`
          );
        },
      }
    );

    const users = User.find().lean();
    if (users.length > 0) {
      for (const user of users) {
        processJobAlerts(user._id)
          .then((response) => {
            res.json({
              message: 'Job alerts processed successfully',
              response: response,
            });
          })
          .catch((error) => {
            logger.error('Error in processJobAlerts:', error);
            res.status(500).json({
              message: 'Failed to process job alerts',
              error: error.message,
            });
          });
      }
    }
  } catch (error) {
    logger.error(
      'Failed to process unextracted job posts after all retries:',
      error
    );
  }
}

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
