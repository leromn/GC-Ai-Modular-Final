const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["income", "expense"], required: true },
  amount: { type: Number, required: true },
  reason: String, //the transaction reason
  category: String, //entertainment,basics,debt...
  date: { type: Date, default: Date.now },
});

const assetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: String,
  type: String, // e.g., cash, real estate, stock, crypto
  value: Number,
  acquiredDate: Date,
  description: String,
});

const financialPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: String,
  goal: String,
  targetAmount: Number,
  currentAmount: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  progress: { type: Number, default: 0 }, // percentage
  status: {
    type: String,
    enum: ["ongoing", "completed", "paused"],
    default: "ongoing",
  },
});

const User = mongoose.model("User", userSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);
const Asset = mongoose.model("Asset", assetSchema);
const FinancialPlan = mongoose.model("FinancialPlan", financialPlanSchema);

module.exports = {
  User,
  Transaction,
  Asset,
  FinancialPlan,
};
