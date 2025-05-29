// const { extractInvoiceInfo } = require("../aiModels/infoExtractorGpt");
// const { extractTextFromInput } = require("../services/inputService");
// const axios = require("axios");

// const analyzeFinancialData = async (req, res) => {
//   try {
//     console.log(req.body);

//     const file = req.files?.file || null;
//     const fileUrl = req.body.fileUrl || null;
//     const manualText = req.body.manualText || null;
//     const userFullName = req.body.fullName || null;
//     // Case 1: Manual entry — save directly to DB
//     if (manualText) {
//       // Simulated save to DB
//       const savedTransaction = { id: Date.now(), content: manualText };

//       return res.json({
//         success: true,
//         message: "Manual transaction saved directly.",
//         data: savedTransaction,
//       });
//     }

//     // Case 2: Process file or URL input
//     const extractedText = await extractTextFromInput({ file, fileUrl });
//     console.log(extractedText);
//     // // Send to your AI text processor //"ERMIAS ASSEFA TIBEBU"
//     const extractedJson = await extractInvoiceInfo(
//       display_name, //name from the req body to match if its his transaction
//       extractedText
//     );
//     console.log(extractedJson);

//     console.log("text Extractedand saved to database");
//     res.json({ success: true, extracted: extractedText });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// module.exports = {
//   analyzeFinancialData,
// };
// //start
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
 * @param {string} dateString - e.g., "5/22/2025"
 * @returns {string} ISO string e.g., "2025-05-22T00:00:00.000Z" or null if invalid
 */
function normalizeDateToISO(dateString) {
  if (!dateString || typeof dateString !== "string")
    return new Date().toISOString(); // Fallback
  try {
    // Handle M/D/YYYY, MM/D/YYYY, M/DD/YYYY, MM/DD/YYYY
    const parts = dateString.split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed in JS Date
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        // Create date in UTC to avoid timezone issues during conversion to ISO string
        const dateObj = new Date(Date.UTC(year, month, day));
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString();
        }
      }
    }
    // Fallback if parsing fails
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
 * Maps the AI-extracted invoice data (CBE specific structure) to the platform's normalized transaction format.
 * @param {object} aiExtractedData - The data object returned by extractInvoiceInfo.
 * @param {string} userId - The ID of the user.
 * @param {string} source - The transaction source.
 * @returns {object | null} A normalized transaction object or null if input is invalid.
 */
function mapAiCbeDataToNormalizedTransaction(aiExtractedData, userId, source) {
  if (!aiExtractedData || typeof aiExtractedData.transAmount !== "number") {
    console.warn(
      "mapAiCbeDataToNormalizedTransaction: Invalid or incomplete AI data received.",
      aiExtractedData
    );
    return null;
  }

  const amount = parseFloat(aiExtractedData.transAmount);
  let transactionType = aiExtractedData.cashflow
    ? aiExtractedData.cashflow.toLowerCase()
    : null;

  if (!transactionType) {
    transactionType = amount >= 0 ? "deposit" : "withdrawal"; // Infer if cashflow is missing
  } else if (transactionType === "expense" || transactionType === "payment") {
    transactionType = "withdrawal";
  } else if (transactionType === "income" || transactionType === "credit") {
    transactionType = "deposit";
  }
  // Ensure type is one of the standard values
  if (transactionType !== "deposit" && transactionType !== "withdrawal") {
    transactionType = amount >= 0 ? "deposit" : "withdrawal"; // Fallback inference
  }

  // The category provided by extractInvoiceInfo for CBE might be used directly
  // or you might choose to re-categorize it with the more general AI categorizer.
  // For this example, we'll use the category from extractInvoiceInfo if provided.
  let category = aiExtractedData.category || "Uncategorized";
  if (source.toUpperCase() === "CBE") {
    // If explicitly CBE, maybe a default category
    category = aiExtractedData.category || "Bank Transaction";
  }

  return {
    txId:
      aiExtractedData.transaction_id ||
      aiExtractedData.id ||
      `${source.toLowerCase()}-${uuidv4()}`,
    userId: userId,
    source: source,
    asset: aiExtractedData.currency || "ETB", // Assuming ETB if not specified
    currency: aiExtractedData.currency || "ETB",
    amount: Math.abs(amount), // Store positive amount
    type: transactionType,
    status: "completed", // Default for manually entered/extracted
    date: normalizeDateToISO(aiExtractedData.transDate),
    description:
      aiExtractedData.reason ||
      aiExtractedData.description ||
      `${source} Transaction`,
    merchantName:
      aiExtractedData.bankName || aiExtractedData.transOwner || null, // Or payee_or_payer
    category: category, // Use category from AI or default
    // Optional: Store the raw AI output for auditing or future reprocessing
    rawExtractedData: aiExtractedData,
  };
}

const analyzeFinancialData = async (req, res) => {
  try {
    const userId = req.user?.uid || "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Use your testUserId

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated." });
    }

    const file = req.files?.file || null;
    const fileUrl = req.body.fileUrl || null;
    const manualEntryJsonString = req.body.manualText || null; // Expecting JSON for one transaction
    const userFullName = req.body.fullName || userData?.displayName || "User"; // Get from userData if available
    const source = req.body.source || "CBE"; // Default to "CBE", client can override

    let transactionsToProcess = []; // This will hold transactions before AI categorization (if any)
    let finalCategorizedTransactions = [];

    if (manualEntryJsonString) {
      console.log("Processing manual entry...");
      try {
        const manualData = JSON.parse(manualEntryJsonString);
        // Assuming manualData is ONE object in the structure AI would return, or already normalized
        // For simplicity, let's assume it's in the AI structure and needs mapping
        const normalizedManualTx = mapAiCbeDataToNormalizedTransaction(
          manualData,
          userId,
          source
        );
        if (normalizedManualTx) {
          transactionsToProcess.push(normalizedManualTx);
        } else {
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
      console.log("Processing file/URL entry...");
      const extractedText = await extractTextFromInput({ file, fileUrl });
      if (!extractedText || extractedText.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Could not extract text from input.",
        });
      }

      console.log("Extracted text, sending to AI for info extraction...");
      // extractInvoiceInfo might return a single object or an array if the document has multiple transactions
      const aiExtractedData = await extractInvoiceInfo(
        userFullName,
        extractedText
      );

      const itemsToNormalize = Array.isArray(aiExtractedData)
        ? aiExtractedData
        : [aiExtractedData];

      itemsToNormalize.forEach((item) => {
        if (item) {
          // Ensure item is not null/undefined
          const normalizedTx = mapAiCbeDataToNormalizedTransaction(
            item,
            userId,
            source
          );
          if (normalizedTx) {
            transactionsToProcess.push(normalizedTx);
          }
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "No input provided (manualText, file, or fileUrl).",
      });
    }

    // Now, transactionsToProcess contains normalized transactions from manual or file/URL (AI extracted + mapped)
    // If the source is "CBE", the category might already be set by mapAiCbeDataToNormalizedTransaction
    // We only send non-"CBE" source transactions (or those without a good category) to the general categorizer.

    if (transactionsToProcess.length > 0) {
      const cbeTransactions = [];
      const otherTransactionsForAICategorization = [];

      transactionsToProcess.forEach((tx) => {
        // If source is CBE and it already got a category from `extractInvoiceInfo` (via mapping)
        // OR if you want ALL CBE to be hardcoded to a specific category or skip general AI.
        // For this example, let's say if source is CBE, its category from mapping is final.
        if (tx.source && tx.source.toUpperCase() === "CBE") {
          // If category from CBE AI is 'Uncategorized' or too generic, maybe send it to general AI
          if (
            tx.category === "Uncategorized" ||
            tx.category === "Bank Transaction" ||
            tx.category === "Miscellaneous"
          ) {
            // Optionally refine CBE's generic categories with the main AI
            // For now, let's keep it simple: if source is CBE, category from mapping is used.
            // If you want to recategorize CBE, push to otherTransactionsForAICategorization instead.
            cbeTransactions.push(tx);
          } else {
            cbeTransactions.push(tx); // Already has a specific category from CBE AI
          }
        } else {
          otherTransactionsForAICategorization.push(tx);
        }
      });

      finalCategorizedTransactions.push(...cbeTransactions);
      console.log(
        `${cbeTransactions.length} transactions from source '${source}' processed with mapped category.`
      );

      if (otherTransactionsForAICategorization.length > 0) {
        console.log(
          `Preparing ${otherTransactionsForAICategorization.length} other transactions for general AI categorization...`
        );
        const preparedForGeneralAI = prepareTransactionsForCategorization(
          otherTransactionsForAICategorization
        );
        try {
          const generalAICategorized = await categorizeTransactionsAI(
            preparedForGeneralAI
          );
          const generalCategoryMap = new Map(
            generalAICategorized.map((item) => [item.id, item.category])
          );
          const reCategorized = otherTransactionsForAICategorization.map(
            (origTx) => ({
              ...origTx,
              category:
                generalCategoryMap.get(origTx.txId) ||
                origTx.category ||
                "Uncategorized",
            })
          );
          finalCategorizedTransactions.push(...reCategorized);
        } catch (aiError) {
          console.error(
            "General AI Categorization step failed:",
            aiError.message
          );
          finalCategorizedTransactions.push(
            ...otherTransactionsForAICategorization.map((tx) => ({
              ...tx,
              category: "Uncategorized (General AI Error)",
            }))
          );
        }
      }
    }

    if (finalCategorizedTransactions.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No transactions processed or to save.",
      });
    }

    // Save all finalCategorizedTransactions to Firestore
    const transactionsCollectionRef = db.collection("allUserTransactions");
    const batch = db.batch();
    let savedCount = 0;

    finalCategorizedTransactions.forEach((tx) => {
      if (tx && tx.txId) {
        // Ensure transaction is valid before saving
        const docRef = transactionsCollectionRef.doc(); // Auto-generate ID for new transactions
        batch.set(docRef, {
          ...tx, // tx already contains userId
          retrievedAtSaaS: new Date().toISOString(),
          sourceProcess: "analyzeFinancialData",
        });
        savedCount++;
      }
    });

    if (savedCount > 0) {
      await batch.commit();
      console.log(
        `✅ Successfully saved ${savedCount} new transactions from input.`
      );
      return res.json({
        success: true,
        message: `Successfully processed and saved ${savedCount} transactions.`,
        data: finalCategorizedTransactions, // Send back the processed transactions
      });
    } else {
      console.log("ℹ️ No valid transactions were generated to save.");
      return res.json({
        success: true,
        message:
          "Input processed, but no valid transactions were generated to save.",
      });
    }
  } catch (error) {
    console.error(
      "❌ Error in analyzeFinancialData:",
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
  analyzeFinancialData,
};
