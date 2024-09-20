const transporter = require('../config/emailConfig');
const dotenv = require('dotenv');
dotenv.config();
const { createEmailBody, minifyHTML } = require('./commonOperations');


async function sendJobAlertEmail(email, jobs) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Job Alerts',
    html: minifyHTML(createEmailBody(jobs)),
  };

  const isMailSent = await transporter.sendMail(mailOptions);
  if (isMailSent) {
    console.log('Email sent successfully');
  } else {
    console.log(`Error sending email: ${error}`);
    logger.error(error);
  }
}

module.exports = { sendJobAlertEmail };
