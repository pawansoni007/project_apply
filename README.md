Here's a README.md for the project:

# Job Alerts Automation System

This project is a job alerts automation system that processes job postings, matches them with user profiles, and sends personalized job alerts.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables:

   ```
   EXPRESS_API_PORT=3000
   NODE_ENV=development
   LOG_LEVEL=info
   JWT_SECRET=your_jwt_secret
   MONGODB_URI=your_mongodb_connection_string
   AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection_string
   EXPRESS_GEMINI_API_KEY_2=your_gemini_api_key
   EMAIL_USER=your_email_address
   EMAIL_PASS=your_email_password
   ```

   Replace the placeholder values with your actual credentials.

4. Set up Azure Blob Storage:
   - Create a container named 'resume' in your Azure Blob Storage account.

5. Set up MongoDB:
   - Ensure you have a MongoDB instance running and update the `MONGODB_URI` in the `.env` file.

## Running the Project

To start the server:

```
npm start
```

For development with auto-restart:

```
npm run watch
```

## Project Structure

- `server.js`: Main entry point
- `app.js`: Express application setup
- `config/`: Configuration files
- `controllers/`: Request handlers
- `middleware/`: Custom middleware functions
- `models/`: Database models
- `services/`: Business logic
- `utils/`: Utility functions

## Key Features

1. User registration and authentication
2. Job posting processing and extraction
3. Job matching algorithm using Google's Generative AI
4. Automated job alerts via email

## API Endpoints

- POST `/api/user/register`: User registration
- POST `/api/user/login`: User login
- GET `/api/user/process-job-alerts`: Process job alerts for authenticated user

## Cron Jobs

The system runs a cron job every 3 hours to process unextracted job posts:


```32:37:project_apply_backend/server.js
cron.schedule('0 */3 * * *', async () => {
  console.log('Running job alerts');
  processUnextractedJobPosts.catch(error => {
    logger.error('Error in processUnextractedJobPosts:', error);
  })
});
```


## Error Handling

The project uses a custom error handler middleware:


```1:15:project_apply_backend/middleware/errorHandler.js
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  res.status(500).json({ message: 'Something went wrong' });
};
```


## Logging

Winston is used for logging. Logs are stored in `error.log` and `combined.log` files.

## Environment Variables

Ensure all environment variables in the `.env` file are properly set before running the application.

## Dependencies

Key dependencies include:
- Express
- Mongoose
- @azure/storage-blob
- @google/generative-ai
- node-cron
- nodemailer
- winston

For a full list of dependencies, refer to the `package.json` file.

## Note

This project uses Google's Generative AI for job matching. Ensure you have the necessary API key and permissions set up.
