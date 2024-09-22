const logger = require('../utils/logger');

module.exports = (err, req, res, next, message = 'Something went wrong') => {
  logger.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  res.status(500).json({ message: message });
};
