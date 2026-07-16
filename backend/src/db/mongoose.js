// src/db/mongoose.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Use MONGODB_URI directly - it already includes the database name
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`\nMongoDB connected! DB host: ${connectionInstance.connection.host}`);
    console.log(`Database: ${connectionInstance.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection error", error);
    process.exit(1);
  }
};

export default connectDB;
