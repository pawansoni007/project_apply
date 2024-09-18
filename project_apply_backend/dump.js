//#region To be used later

// app.put('/api/update-filter', upload.single('resume'), async (req, res) => {
//   try {
//     const { email, jobFilter } = req.body;
//     let updateData = { jobFilter: JSON.parse(jobFilter) };

//     if (req.file) {
//       // Upload new resume to Azure Blob Storage
//       const blobName = `${Date.now()}-${req.file.originalname}`;
//       const blockBlobClient = containerClient.getBlockBlobClient(blobName);
//       await blockBlobClient.upload(req.file.buffer, req.file.size);
//       updateData.resumeUrl = blobName;
//     }

//     const user = await User.findOneAndUpdate({ email }, updateData, {
//       new: true,
//     });
//     if (user) {
//       res.json({ message: 'Job alert filter and resume updated successfully' });
//     } else {
//       res.status(404).json({ message: 'User not found' });
//     }
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: 'Error updating job filter', error: error.message });
//   }
// });

// app.post('/api/unsubscribe', async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOneAndDelete({ email });
//     if (user && user.resumeUrl) {
//       // Delete resume from Azure Blob Storage
//       const blockBlobClient = containerClient.getBlockBlobClient(
//         user.resumeUrl
//       );
//       await blockBlobClient.delete();
//     }
//     res.json({ message: 'Unsubscribed successfully' });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: 'Error unsubscribing user', error: error.message });
//   }
// });

//#endregion To be user later
