const cron = require('node-cron');
const app = require('./app');
const express = require('express');
// const app = express();
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { port } = require('./config/server');
const dotenv = require('dotenv');
const { processJobAlerts } = require('./services/processJobAlerts');

dotenv.config();

connectDB();

app.get('/process-job-alerts', async (req, res) => {
  try {
    await processJobAlerts();
    res.json({ message: 'Job alerts processed successfully' });
  } catch (error) {
    logger.error('Error in processJobAlerts:', error);
    res.status(500).json({ message: 'Failed to process job alerts', error: error.message });
  }
});


// Cron job to run every 3 hours
// cron.schedule('0 */3 * * *', () => {
//   console.log('Running job alerts');
//   processJobAlerts();
// });

app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    logger.error(`Error starting server: ${err}`);
    return;
  }
  
  logger.info(`Server running on http://localhost:${port}`);
  // processJobAlerts().catch(error => {
  //   logger.error('Error in processJobAlerts:', error);
  // });
  
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
