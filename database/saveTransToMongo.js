const mongoose = require("mongoose");
const { Transaction } = require("./models"); // Update this path

async function saveTransactionFromExtractedData(extractedData, userId) {
  try {
    console.log(extractedData);
    // const amountValue = Number(extractedData.transAmount);
    // console.log(amountValue, extractedData.transAmount);
    // // Create a new transaction from the extracted JSON
    // const newTransaction = new Transaction({
    //   userId: userId, // Passed in separately
    //   type: extractedData.cashflow || "expense", // Use 'cashflow' field
    //   amount: amountValue || 0,
    //   reason: extractedData.reason || "undefined",
    //   category: extractedData.category || "Miscellaneous",
    //   date: extractedData.transDate
    //     ? new Date(extractedData.transDate)
    //     : new Date(),
    // });

    // // Save to the database
    // await newTransaction.save();

    // console.log("✅ Transaction saved successfully:", newTransaction);

    // return newTransaction;
  } catch (error) {
    console.error("❌ Error saving transaction:", error.message);
    throw error;
  }
}

module.exports = { saveTransactionFromExtractedData };
