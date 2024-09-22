const mongoose = require('mongoose');

// Modified User Schema
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    jobFilter: {
      experience: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
      },
      skills: { type: [String], default: [] },
      domains: { type: [String], default: [] },
      jobTypes: { type: [String], default: [] },
      minSalary: { type: Number, default: null },
      locations: { type: [String], default: [] },
      skillMatchPercentage: { type: Number, default: null },
    },
    resumeUrl: { type: String, default: null },
    lastProcessedJobId: { type: String, default: null },
    lastProcessedAt: { type: Date, default: null },
    hasSubscribedForJobAlerts: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
  },

  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// Job Post Schema
const jobPostSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  title: String,
  companyImage: {
    url: String,
  },
  body: {
    html: String,
  },
  salary: String,
  createdAt: Date,
  experience: {
    experience: String,
  },
  extractedJob: {
    type: Object,
    default: null,
  },
  domain: {
    domain: String,
  },
  jobTypeReference: {
    jobType: String,
  },
  apply: String,
});

jobPostSchema.index({ id: 1 }, { unique: true });

const JobPost = mongoose.model('JobPost', jobPostSchema);

// New schema for storing user-job matches
const userJobMatchSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true },
  jobId: {
    type: String,
    ref: 'JobPost',
    required: true,
  },
  resumeMatchScore: { type: Number, default: 0 },
  requirementMatchScore: { type: Number, default: 0 },
  overallMatchScore: { type: Number, default: 0 },
  fitReason: { type: String },
  areasForImprovement: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const UserJobMatch = mongoose.model('UserJobMatch', userJobMatchSchema);

// Create indexes for efficient querying
userJobMatchSchema.index({ userId: 1, jobId: 1 }, { unique: true });
userJobMatchSchema.index({ userId: 1, overallMatchScore: -1 });

module.exports = { User, JobPost, UserJobMatch };
