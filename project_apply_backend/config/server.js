require('dotenv').config();

module.exports = {
  port: process.env.EXPRESS_API_PORT ?? 3000,
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET,
};