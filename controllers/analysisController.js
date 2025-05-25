const { extractInvoiceInfo } = require("../aiModels/infoExtractorGpt");
const {
  saveTransactionFromExtractedData,
} = require("../database/saveTransToMongo");
const { extractTextFromInput } = require("../services/inputService");
const axios = require("axios");

const analyzeFinancialData = async (req, res) => {
  try {
    console.log(req.body);

    const file = req.files?.file || null;
    const fileUrl = req.body.fileUrl || null;
    const manualText = req.body.manualText || null;
    const userFullName = req.body.fullName || null;
    // Case 1: Manual entry — save directly to DB
    if (manualText) {
      // Simulated save to DB
      const savedTransaction = { id: Date.now(), content: manualText };

      return res.json({
        success: true,
        message: "Manual transaction saved directly.",
        data: savedTransaction,
      });
    }

    // Case 2: Process file or URL input
    const extractedText = await extractTextFromInput({ file, fileUrl });
    console.log(extractedText);
    // // Send to your AI text processor
    const extractedJson = await extractInvoiceInfo(
      "ERMIAS ASSEFA TIBEBU",
      extractedText
    );
    console.log(extractedJson);
    // // save to DB
    const userId = "661b23d4f8e23c001f52aabc"; // your user ID from MongoDB

    await saveTransactionFromExtractedData(extractedJson, userId)
      .then((savedTransaction) => {
        console.log("🎯 Saved to DB:", savedTransaction);
        // console.log("🎯 Saved to DB:");
      })
      .catch((error) => {
        console.error("❌ Failed to save:", error.message);
        throw error;
      });

    console.log("text Extractedand saved to database");
    res.json({ success: true, extracted: extractedText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  analyzeFinancialData,
};
//start
