const transporter = require("../config/emailConfig");
const dotenv = require('dotenv');
dotenv.config();

async function sendJobAlertEmail(email, jobs) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Job Alerts',
    html: `
            <h1>Radhe Radhe, Your Job Alerts</h1>
            ${jobs
              .map(
                (job) => `
                <div>
                    <h2>${job.title}</h2>
                    <p>Company: ${
                      job.companyImage
                        ? `<img src="${job.companyImage.url}" alt="Company Logo" style="max-width: 100px;">`
                        : 'N/A'
                    }</p>
                    <p>Salary: ${job.salary || 'Not specified'}</p>
                    <p>Experience: ${
                      job.experience
                        ? job.experience.experience
                        : 'Not specified'
                    }</p>
                    <p>Domain: ${
                      job.domain ? job.domain.domain : 'Not specified'
                    }</p>
                    <p>Job Type: ${
                      job.jobTypeReference
                        ? job.jobTypeReference.jobType
                        : 'Not specified'
                    }</p>
                    <p>Match Score: ${job.matchScore}</p>
                    <a href="${job.apply}">Apply Now</a>
                    <hr>
                </div>
            `
              )
              .join('')}
        `,
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