const express = require('express');
const errorHandler = require('./middleware/errorHandler');
const cors = require('cors');
const { register, login } = require('./controllers/register');
const multer = require('multer');
const { processJobAlerts } = require('./services/processJobAlerts');
const logger = require('./utils/logger');
const { memoryStorage } = multer;
const app = express();
const { auth } = require('./middleware/auth');
const cookieParser = require('cookie-parser');

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes

const upload = multer({ storage: memoryStorage() });

app.post('/api/user/register', upload.single('resume'), register);

app.get('/api/user/process-job-alerts', auth, async (req, res) => {
  processJobAlerts(req.user.userId)
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
});

app.post('/api/user/login', login);


// Error handling
app.use(errorHandler);

module.exports = app;
