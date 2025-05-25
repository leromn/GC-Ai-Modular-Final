const mongoose = require("mongoose");

const uri =
  "mongodb+srv://root:root@graduationproject-finan.xys6uti.mongodb.net/?retryWrites=true&w=majority&appName=GraduationProject-FinancialAnalysis";

const connectDB = async () => {
  try {
    await mongoose.connect(uri); // Clean and simple now
    console.log("✅ MongoDB connected with Mongoose");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
