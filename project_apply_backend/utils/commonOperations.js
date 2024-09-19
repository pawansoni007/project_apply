
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

module.exports = { cleanJobPosts };
