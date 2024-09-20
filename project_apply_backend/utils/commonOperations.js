const htmlMinifier = require('html-minifier');

function cleanJobPosts(newJobPosts) {
  newJobPosts.forEach((job) => {
    delete job.companyImage;
  });

  let parsedJobPostsWithClampedJsons = newJobPosts.map((job) => {
    return {
      jobDesc: job.body.html.replace(/^"|"$/g, ''),
      id: job.id,
      title: job.title,
    };
  });
  return parsedJobPostsWithClampedJsons;
}

const getJobFreshness = (createdAt) => {
  const now = new Date();
  const jobDate = new Date(createdAt);
  const diffMs = now.getTime() - jobDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffHours < 48) {
    return 'Yesterday';
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
};

const createEmailBody = (jobs) => `
 <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Top Job Matches</title>
  <style type="text/css">
    body, p, h1, h2, h3, h4, h5, h6 {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      line-height: 1.4;
    }
    .container {
      max-width: 600px !important;
      margin: 0 auto !important;
      padding: 20px !important;
    }
    table {
      border-collapse: collapse;
      width: 100% !important;
    }
    .job-item {
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }
    .job-item:last-child {
      border-bottom: none;
    }
    .job-title {
      font-size: 18px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 2px;
    }
    .company {
      font-size: 14px;
      color: #7f8c8d;
      margin-bottom: 5px;
    }
    .details {
      font-size: 14px;
      color: #555;
      margin-bottom: 3px;
    }
    .match-score {
      font-weight: bold;
      color: #27ae60;
    }
    .cta {
      display: inline-block;
      background: #3498db;
      color: #ffffff;
      padding: 6px 12px;
      text-decoration: none;
      border-radius: 3px;
      font-size: 14px;
      margin-top: 8px;
    }
    @media only screen and (max-width: 480px) {
      .container {
        width: 100% !important;
        padding: 10px !important;
      }
      .job-title {
        font-size: 16px;
      }
      .company, .details {
        font-size: 12px;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="container" style="background-color: #ffffff;">
          <tr>
            <td style="padding: 20px;">
              <h1 style="color: #333333; font-size: 24px; margin-bottom: 15px; text-align: center;">Radhe Radhe, Your Top Job Matches</h1>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                ${jobs
                  .map(
                    (job) => `
                  <tr>
                    <td class="job-item">
                      <div class="job-title">${job.title}</div>
                      <div class="company">${job.companyName} • ${
                      job.companyImage
                        ? `<img src="${job.companyImage}" alt="Company Logo" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 5px;">`
                        : ''
                    } • ${
                      job.domain ? job.domain.domain : 'Other Domains'
                    }</div>
                      <div class="details">
                        ${job.salary ? `Salary: ${job.salary} • ` : ''}${
                      job.experience
                        ? `Experience: ${job.experience}`
                        : 'Any experience'
                    }
                      </div>
                      <div class="details">
                        Job Type: ${
                          job.jobTypeReference
                            ? job.jobTypeReference
                            : 'Not specified'
                        } • Posted: ${job.createdAt}
                      </div>
                      <div class="details">
                        <span class="match-score">${
                          job.overallMatchScore
                        }% Match</span> (Resume: ${
                      job.resumeMatchScore
                    }%, Requirements: ${job.requirementMatchScore}%)
                      </div>
                      <div class="details">
                        Fit Reason: ${
                          job.fitReason || 'Not enough information to determine'
                        }
                      </div>
                       ${
                         job.areasForImprovement
                           ? `
                        <div class="improvement">
                          <strong>Areas for Improvement:</strong> ${job.areasForImprovement}
                        </div>
                      `
                           : ''
                       }
                      <div>
                        <a href="${job.apply}" class="cta">Quick Apply</a>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const minifyHTML = (html) => {
  return htmlMinifier.minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    minifyCSS: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    removeEmptyAttributes: true,
  });
};

module.exports = {
  cleanJobPosts,
  getJobFreshness,
  createEmailBody,
  minifyHTML,
};
