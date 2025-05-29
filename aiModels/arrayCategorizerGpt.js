const OPENAI_API_KEY =
  "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";
const API_URL = "https://api.openai.com/v1/chat/completions";
// services/categorizeTransactions.js
const axios = require("axios");

const categoriesList = [
  "Income",
  "Housing & Utilities",
  "Food & Groceries",
  "Transportation",
  "Healthcare",
  "Shopping & Entertainment",
  "Transfers & Payments",
  "Other Expenses",
];

function prepareTransactionsForCategorization(normalizedTransactions) {
  // ... (this function remains the same as before) ...
  if (!Array.isArray(normalizedTransactions)) return [];
  return normalizedTransactions.map((tx) => {
    let descriptionForAI = "No description provided";
    if (tx.description) descriptionForAI = tx.description;
    else if (tx.memo) descriptionForAI = tx.memo;
    else if (tx.notes) descriptionForAI = tx.notes;
    else if (tx.type && tx.fromAddress && tx.toAddress) {
      descriptionForAI = `Crypto ${tx.currency || tx.asset || ""} ${
        tx.type
      } from ${tx.fromAddress.substring(0, 6)}... to ${tx.toAddress.substring(
        0,
        6
      )}...`;
    } else if (tx.title) descriptionForAI = tx.title;

    descriptionForAI = String(descriptionForAI).substring(0, 100);

    return {
      id: tx.txId,
      amount: tx.amount,
      description: descriptionForAI,
      date: tx.date,
      currency: tx.currency || tx.asset,
      type: tx.type,
    };
  });
}

async function categorizeTransactionsAI(transactionsToCategorize) {
  if (!OPENAI_API_KEY) {
    console.error("❌ OpenAI API Key (OPENAI_API_KEY) is not configured.");
    return transactionsToCategorize.map((tx) => ({
      ...tx,
      category: "Uncategorized (AI Config Error)",
    }));
  }
  if (
    !Array.isArray(transactionsToCategorize) ||
    transactionsToCategorize.length === 0
  ) {
    return [];
  }

  const CHUNK_SIZE = 100;
  let allEnrichedTransactions = [];

  for (let i = 0; i < transactionsToCategorize.length; i += CHUNK_SIZE) {
    const chunk = transactionsToCategorize.slice(i, i + CHUNK_SIZE);
    console.log(
      `\n⏳ Categorizing chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(
        transactionsToCategorize.length / CHUNK_SIZE
      )} (size: ${chunk.length})`
    );

    const prompt = `
You are an expert financial transaction categorizer.
Categorize each of the following financial transactions into ONE of these categories:
${categoriesList.join(", ")}

Consider 'description', 'amount', and 'type' (deposit/withdrawal).
If a transaction involves moving money between the user's own accounts (e.g., "Transfer to Savings", description indicates self-transfer like between checking and savings), categorize it as "Transfers & Payments".
If description is "No description provided" or very generic, try to infer from other fields or use "Other Expenses" or "Uncategorized" if truly unclear.

Return ONLY a valid JSON array in this exact format, with no explanations, introductions, or markdown:
[
  { "id": "transaction_id_value_1", "category": "ChosenCategory1" },
  { "id": "transaction_id_value_2", "category": "ChosenCategory2" }
]
Even if you are providing a JSON object as per the 'json_object' response format, ensure the *value* associated with your primary key in that object is this exact array structure. For example: { "result_array": [ { "id": "...", "category": "..." } ] }

Transactions to categorize:
${JSON.stringify(chunk)}
`;

    try {
      const start = Date.now();
      const response = await axios.post(
        API_URL,
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert financial transaction categorizer. Respond ONLY with valid JSON. If using JSON mode and returning an object, ensure the primary value is an array of categorized transactions as specified.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      const rawContent = response.data.choices[0].message.content;
      let cleanedContent = rawContent.trim();
      if (cleanedContent.startsWith("```json"))
        cleanedContent = cleanedContent.substring(7);
      if (cleanedContent.endsWith("```"))
        cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
      cleanedContent = cleanedContent.trim();

      // === MODIFIED_START: Robust JSON parsing ===
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error(
          "❌ Failed to parse AI JSON response:",
          parseError.message
        );
        console.error("Raw content from AI:", rawContent);
        // Handle as error for this chunk
        const errorEnrichedChunk = chunk.map((tx) => ({
          ...tx,
          category: "Categorization Error (JSON Parse)",
        }));
        allEnrichedTransactions.push(...errorEnrichedChunk);
        continue; // Move to the next chunk
      }

      let categorizedItemsArray;
      if (Array.isArray(parsedResponse)) {
        // If the response is directly an array (ideal case)
        categorizedItemsArray = parsedResponse;
      } else if (
        typeof parsedResponse === "object" &&
        parsedResponse !== null
      ) {
        // If the response is an object, try to find an array within it.
        // Common keys might be 'transactions', 'result', 'data', 'categories', or the first array found.
        const potentialArrayKeys = [
          "transactions",
          "result",
          "data",
          "categories",
          "categorized_transactions",
          "items",
        ];
        let foundArray = false;
        for (const key of potentialArrayKeys) {
          if (Array.isArray(parsedResponse[key])) {
            categorizedItemsArray = parsedResponse[key];
            foundArray = true;
            break;
          }
        }
        // If no common key worked, try to find the first array value in the object
        if (!foundArray) {
          for (const key in parsedResponse) {
            if (Array.isArray(parsedResponse[key])) {
              categorizedItemsArray = parsedResponse[key];
              foundArray = true;
              break;
            }
          }
        }
        if (!foundArray) {
          console.warn(
            "⚠️ AI response was an object, but no array of transactions found within it using common keys. Raw response:",
            parsedResponse
          );
          categorizedItemsArray = []; // Treat as if no categories were returned for this chunk
        }
      } else {
        console.warn(
          "⚠️ AI response was not an array or a recognized object structure. Raw response:",
          parsedResponse
        );
        categorizedItemsArray = []; // Treat as if no categories were returned
      }
      // === MODIFIED_END ===

      const categoryMap = new Map();
      if (Array.isArray(categorizedItemsArray)) {
        categorizedItemsArray.forEach((c) => {
          if (c && c.id && c.category) {
            // Ensure item and its properties are valid
            categoryMap.set(c.id, c.category);
          } else {
            console.warn(
              "⚠️ Invalid item structure in AI's categorized array:",
              c
            );
          }
        });
      }

      const enrichedChunk = chunk.map((txn) => ({
        ...txn,
        category:
          categoryMap.get(txn.id) || "Uncategorized (AI Response Error)",
      }));
      allEnrichedTransactions.push(...enrichedChunk);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`✅ Chunk categorization complete. Took ${duration}s`);
    } catch (error) {
      console.error(
        "❌ AI Categorization error for chunk (outer try-catch):",
        error.response?.data?.error || error.message,
        error.stack
      );
      const errorEnrichedChunk = chunk.map((tx) => ({
        ...tx,
        category: "Categorization Error (Chunk Failed)",
      }));
      allEnrichedTransactions.push(...errorEnrichedChunk);
    }
  }
  return allEnrichedTransactions;
}

// Self-test block (remains the same as it tests the overall flow)
if (require.main === module) {
  (async () => {
    if (!OPENAI_API_KEY) {
      console.error("Please set OPENAI_API_KEY to run test.");
      return;
    }
    console.log(
      "--- Running Transaction Categorization Test (Simple Categories, Robust Parsing) ---"
    );
    const sampleNormalizedTransactions = [
      {
        txId: "txn_s_001",
        amount: -15.5,
        date: "2025-06-20",
        type: "withdrawal",
        currency: "USD",
        description: "Starbucks Coffee",
      },
      {
        txId: "txn_s_002",
        amount: 2500.0,
        date: "2025-06-15",
        type: "deposit",
        currency: "USD",
        description: "Paycheck Deposit",
      },
      {
        txId: "txn_s_003",
        amount: -60.0,
        date: "2025-06-12",
        type: "withdrawal",
        currency: "USD",
        description: "Uber ride to airport",
      },
      {
        txId: "txn_s_004",
        amount: -35.0,
        date: "2025-06-10",
        type: "withdrawal",
        currency: "USD",
        description: null,
      },
      {
        txId: "txn_s_005",
        amount: -120.0,
        date: "2025-06-01",
        type: "withdrawal",
        currency: "USD",
        description: "Transfer to Savings Account XYZ",
      },
      {
        txId: "txn_s_006",
        amount: -50.0,
        date: "2025-06-02",
        type: "withdrawal",
        currency: "USD",
        description: "Netflix Subscription",
      },
    ];

    const preparedTransactions = prepareTransactionsForCategorization(
      sampleNormalizedTransactions
    );
    console.log(
      "\nPrepared Transactions for AI:",
      JSON.stringify(preparedTransactions, null, 2)
    );
    try {
      const result = await categorizeTransactionsAI(preparedTransactions); // result has {id, category, ... (fields from prepared)}

      // Map categories from AI result (which used 'id') back to original transactions (which use 'txId')
      const categoryMap = new Map();
      result.forEach((item) => {
        if (item.id && item.category) {
          categoryMap.set(item.id, item.category); // item.id is the original tx.txId
        }
      });

      const finalEnrichedTransactions = sampleNormalizedTransactions.map(
        (originalTx) => ({
          ...originalTx, // Spread all original fields from sampleNormalizedTransactions
          category:
            categoryMap.get(originalTx.txId) ||
            "Uncategorized (Test Mapping Error)",
        })
      );
      console.log(
        "\nFinal Enriched Original Transactions:",
        JSON.stringify(finalEnrichedTransactions, null, 2)
      );
    } catch (error) {
      console.error("\n--- Test Failed ---", error.message);
    }
  })();
}

module.exports = {
  categorizeTransactionsAI,
  prepareTransactionsForCategorization,
};
