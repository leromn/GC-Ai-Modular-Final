// controllers/financialDataController.js
const db = require("../Finnished/firebase/firebaseClient"); // Path from your memory
const { extractInvoiceInfo } = require("../aiModels/infoExtractorGpt"); // Path from your memory
const { extractTextFromInput } = require("../services/inputService"); // Assuming path
const {
  prepareTransactionsForCategorization,
  categorizeTransactionsAI,
} = require("../aiModels/arrayCategorizerGpt"); // Path from your memory
const { v4: uuidv4 } = require("uuid"); // For generating unique txId

/**
 * Converts a date string (M/D/YYYY or MM/DD/YYYY) to ISO 8601 string.
 */
function normalizeDateToISO(dateString) {
  if (!dateString || typeof dateString !== "string")
    return new Date().toISOString();
  try {
    const parts = dateString.split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const dateObj = new Date(Date.UTC(year, month, day));
        if (!isNaN(dateObj.getTime())) return dateObj.toISOString();
      }
    }
    console.warn(
      `Could not parse date string: ${dateString}. Using current date.`
    );
    return new Date().toISOString();
  } catch (error) {
    console.warn(
      `Error parsing date string: ${dateString}. Using current date.`,
      error
    );
    return new Date().toISOString();
  }
}

/**
 * Maps the AI-extracted invoice data to the platform's normalized transaction format.
 */
function mapAiCbeDataToNormalizedTransaction(aiExtractedData, userId, source) {
  if (!aiExtractedData || typeof aiExtractedData.transAmount !== "number") {
    console.warn(
      "mapAiCbeDataToNormalizedTransaction: Invalid or incomplete AI data.",
      aiExtractedData
    );
    return null;
  }
  const amount = parseFloat(aiExtractedData.transAmount);
  let transactionType = aiExtractedData.cashflow?.toLowerCase();
  if (!transactionType)
    transactionType = amount >= 0 ? "deposit" : "withdrawal";
  else if (["expense", "payment"].includes(transactionType))
    transactionType = "withdrawal";
  else if (["income", "credit"].includes(transactionType))
    transactionType = "deposit";
  if (!["deposit", "withdrawal"].includes(transactionType))
    transactionType = amount >= 0 ? "deposit" : "withdrawal";

  let category = aiExtractedData.category || "Uncategorized";
  if (source.toUpperCase() === "CBE")
    category = aiExtractedData.category || "Bank Transaction";

  return {
    txId:
      aiExtractedData.transaction_id ||
      aiExtractedData.id ||
      `${source.toLowerCase()}-${uuidv4()}`,
    userId: userId,
    source: source,
    asset: aiExtractedData.currency || "ETB",
    currency: aiExtractedData.currency || "ETB",
    amount: Math.abs(amount),
    type: transactionType,
    status: "completed",
    date: normalizeDateToISO(aiExtractedData.transDate),
    description:
      aiExtractedData.reason ||
      aiExtractedData.description ||
      `${source} Transaction`,
    merchantName:
      aiExtractedData.bankName || aiExtractedData.transOwner || null,
    category: category,
    rawExtractedData: aiExtractedData,
  };
}

// Renamed from analyzeFinancialData to better reflect its purpose if it's always one tx.
// Or keep analyzeFinancialData if it's a general endpoint. For now, let's assume it's for adding ONE transaction.
const addSingleTransaction = async (req, res) => {
  console.log("Add single transaction endpoint reached");
  console.log(req.body.fileUrl);

  try {
    const userId = req.user?.uid || "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Test User ID

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated." });
    }

    const file = req.files?.file || null;
    const fileUrl = req.body.fileUrl || null;
    const manualEntryJsonString = req.body.manualText || null;
    const userFullName = req.body.fullName || req.user?.displayName || "User"; // Use req.user.displayName if available
    const source = req.body.source || "CBE";

    let normalizedTransaction = null; // Will hold the single normalized transaction

    if (manualEntryJsonString) {
      console.log("Processing manual entry for single transaction...");
      try {
        const manualData = JSON.parse(manualEntryJsonString);
        normalizedTransaction = mapAiCbeDataToNormalizedTransaction(
          manualData,
          userId,
          source
        );
        if (!normalizedTransaction) {
          console.warn(
            "Manual entry data could not be normalized:",
            manualData
          );
        }
      } catch (e) {
        console.error("Error parsing manual entry JSON:", e.message);
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format for manual entry.",
        });
      }
    } else if (file || fileUrl) {
      console.log("Processing file/URL entry for single transaction...");
      const extractedText = await extractTextFromInput({ file, fileUrl });
      if (!extractedText || extractedText.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Could not extract text from input.",
        });
      }

      console.log("Extracted text, sending to AI for info extraction...");
      console.log(extractedText);
      // IMPORTANT ASSUMPTION: extractInvoiceInfo returns a SINGLE transaction object here
      const aiExtractedData = await extractInvoiceInfo(
        userFullName,
        extractedText
      );

      if (aiExtractedData) {
        normalizedTransaction = mapAiCbeDataToNormalizedTransaction(
          aiExtractedData,
          userId,
          source
        );
        console.log(normalizedTransaction);
      } else {
        console.warn("AI did not return data from file/URL input.");
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "No input provided (manualText, file, or fileUrl).",
      });
    }

    if (!normalizedTransaction) {
      console.log("ℹ️ No valid transaction was processed from the input.");
      return res.status(400).json({
        success: false,
        message: "Could not process a valid transaction from the input.",
      });
    }

    // === CATEGORIZE THE SINGLE TRANSACTION ===
    let finalTransactionToSave = { ...normalizedTransaction }; // Start with the mapped transaction

    // If source is NOT "CBE" (or similar that gets category from mapping), then use general AI categorizer.
    // Or if CBE's category is too generic and you want to refine it.
    const requiresGeneralAICategorization = !(
      source.toUpperCase() === "CBE" &&
      finalTransactionToSave.category &&
      !["Uncategorized", "Bank Transaction", "Miscellaneous"].includes(
        finalTransactionToSave.category
      )
    );

    if (requiresGeneralAICategorization) {
      console.log(
        `Preparing transaction from source '${source}' for general AI categorization...`
      );
      const preparedForGeneralAI = prepareTransactionsForCategorization([
        finalTransactionToSave,
      ]); // Pass as array
      if (preparedForGeneralAI.length > 0) {
        try {
          const generalAICategorizedResult = await categorizeTransactionsAI(
            preparedForGeneralAI
          ); // Returns array
          if (
            generalAICategorizedResult.length > 0 &&
            generalAICategorizedResult[0].category
          ) {
            finalTransactionToSave.category =
              generalAICategorizedResult[0].category;
            console.log(
              `Transaction category updated by general AI to: ${finalTransactionToSave.category}`
            );
          } else {
            console.warn("General AI categorizer did not return a category.");
            finalTransactionToSave.category =
              finalTransactionToSave.category ||
              "Uncategorized (General AI Error)";
          }
        } catch (aiError) {
          console.error(
            "General AI Categorization step failed:",
            aiError.message
          );
          finalTransactionToSave.category = "Uncategorized (General AI Error)";
        }
      }
    } else {
      console.log(
        `Transaction from source '${source}' using pre-assigned category: ${finalTransactionToSave.category}`
      );
    }

    // === SAVE THE SINGLE TRANSACTION ===
    if (finalTransactionToSave && finalTransactionToSave.txId) {
      const transactionsCollectionRef = db.collection("allUserTransactions");
      const docRef = transactionsCollectionRef.doc(); // Auto-generate ID for the new transaction document

      await docRef.set({
        ...finalTransactionToSave, // Already contains userId
        retrievedAtSaaS: new Date().toISOString(),
        sourceProcess: "addSingleTransaction", // Or 'analyzeFinancialData' if you keep that name
      });

      console.log(
        `✅ Successfully saved new transaction ${finalTransactionToSave.txId} from input.`
      );
      return res.json({
        success: true,
        message: `Successfully processed and saved transaction.`,
        data: finalTransactionToSave,
      });
    } else {
      console.log(
        "ℹ️ No valid transaction was generated to save after all processing."
      );
      return res.status(500).json({
        success: false,
        message: "Failed to generate a valid transaction to save.",
      });
    }
  } catch (error) {
    console.error(
      "❌ Error in addSingleTransaction:",
      error.message,
      error.stack
    );
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred.",
    });
  }
};

module.exports = {
  addSingleTransaction, // Exporting with potentially new name
};
