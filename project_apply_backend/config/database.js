const mongoose = require('mongoose'); 
require('dotenv').config(); //The purpose of this line is to load environment variables from a .env file into process.env

const connectDB = async (next) => {
  try{
    await mongoose.connect(process.env.MONGODB_URI);
  }
  catch(error){
    logger.error(`Error occurred: ${error}`);
    return next(error); 
  }
}

module.exports = connectDB;