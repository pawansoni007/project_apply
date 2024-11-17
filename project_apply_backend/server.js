const cron = require('node-cron');
const app = require('./app');
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
  try {
    await retry(
      async () => {
        try {
          await processUnextractedJobPosts();
        } catch (error) {
          logger.error('Error in processUnextractedJobPosts:', error);
          throw error;
        }
      },
      {
        retries: 5,
        minTimeout: 1500, // 1.5 seconds
        maxTimeout: 45000, // 45 seconds
        factor: 2.5,
        onRetry: (error, attempt) => {
          logger.error(`Attempt ${attempt}: Error in processUnextractedJobPosts: ${error}`);
        },
      }
    );

    // Artificial delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds delay

    const users = await User.find().lean();
    for (const user of users) {
      await retry(
        async () => {
          try {
            await processJobAlerts(user._id);
          } catch (error) {
            logger.error(`Error in processJobAlerts for user ${user._id}: ${error}`);
            throw error;
          }
        },
        {
          retries: 5,
          minTimeout: 1500, // 1.5 seconds
          maxTimeout: 45000, // 45 seconds
          factor: 2.5,
          onRetry: (error, attempt) => {
            logger.error(`Attempt ${attempt}: Error in processJobAlerts for user ${user._id}: ${error}`);
          },
        }
      );
    }
  } catch (error) {
    logger.error('Error in cron job:', error);
  }
});

app.listen(port, '0.0.0.0', async (err) => {
  try {
    if (err) {
      logger.error(`Error starting server: ${err}`);
      return;
    }

    setupForStartup().catch((error) => {
      logger.error('Error in setupForStartup:', error);
    });

    logger.info(`Server running on http://localhost:${port}`);
  } catch (error) {
    console.log(`error in server.js in app.listen: ${error}`);
    logger.error(`Error in server.js in app.listen: ${error}`);
  }
});

async function setupForStartup() {
  try {
    console.log('setup for startup');
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

    const users = await User.find().lean();
    console.log(`users: ${JSON.stringify(users, null, 2)}`);
    if (users.length > 0) {
      for (const user of users) {
        processJobAlerts(user._id)
          .then((res) => {
            console.log(`response: ${JSON.stringify(res, null, 2)}`);
          })
          .catch((error) => {
            console.log(`error in processJobAlerts: ${error}`);
            logger.error('Error in processJobAlerts:', error);
          });
      }
    }
  } catch (error) {
    console.log(`error in setupForStartup: ${error}`);
    logger.error(
      'Failed to process unextracted job posts after all retries in setupForStartup: ',
      error
    );
  }
}

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at unhandledRejection:', promise, 'reason:', reason);
});
