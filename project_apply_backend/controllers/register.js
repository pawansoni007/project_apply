const stream = require('stream');
const { hash, compare } = require('bcrypt');
const { User } = require('../models/models');
const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { initializeAzureStorage } = require('../utils/azureStorage');

dotenv.config();

// Registration endpoint
function register(req, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const { email, password } = req.body;

      const containerClient = await initializeAzureStorage();

      // Upload resume to Azure Blob Storage
      console.log(req.file);
      const blobName = `${Date.now()}-${req.file.originalname}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const readableStream = new stream.PassThrough();
      readableStream.end(req.file.buffer);
      await blockBlobClient.uploadStream(readableStream);

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email and password are required' });
      }

      const existingUser = await User.findOne({ email });

      if (existingUser) {
        res.json({ message: 'User already exists' });
      } else {
        const hashedPassword = await hash(password, 10);
        const newUser = new User({
          email,
          password: hashedPassword,
          resumeUrl: blockBlobClient.url,
          lastProcessedJobId: '',
          hasSubscribedForJobAlerts: true,
        });
        await newUser.save();
        res.json({
          message: 'User registered and subscribed for job alerts successfully',
          hasSubscribedForJobAlerts: newUser.hasSubscribedForJobAlerts,
        });
      }
      resolve();
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error registering user', error: error.message });
      logger.error('Error registering user at /api/user/register:', error);
      reject(error);
    }
  });
}

// Profile completion endpoint
function completeProfile(req, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const userId = req.user.id; // Assuming you have authentication middleware
      const {
        experience,
        skills,
        domains,
        jobTypes,
        minSalary,
        locations,
        skillMatchPercentage,
        resumeUrl,
      } = req.body;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          jobFilter: {
            experience,
            skills,
            domains,
            jobTypes,
            minSalary,
            locations,
            skillMatchPercentage,
          },
          resumeUrl,
          profileCompleted: true,
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'Profile completed successfully',
        user: updatedUser,
      });
      resolve();
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error completing profile', error: error.message });
      reject(error);
    }
  });
}

// Get user profile endpoint
function getProfile(req, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const userId = req.user.id; // Assuming you have authentication middleware
      const user = await User.findById(userId).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
      resolve();
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error fetching profile', error: error.message });
      reject(error);
    }
  });
}

function login(req, res, next) {
  return new Promise(async (resolve, reject) => {
    try {
      // logger.info('Login request received');
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      // logger.info(`User found: ${user.email}, ${user.id}, ${user.password}`);

      if (!user || !(await compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'strict', // Protect against CSRF
        maxAge: 3600000, // 1 hour in milliseconds
      });
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          profileCompleted: user.profileCompleted,
        },
      });
      resolve();
    } catch (error) {
      next(error);
      reject(error);
    }
  });
}

module.exports = { register, completeProfile, getProfile, login };
