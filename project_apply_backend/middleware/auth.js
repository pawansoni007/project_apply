const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/server');

function auth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = { userId: decoded.userId };
    return next();
  });
}

module.exports = { auth };
