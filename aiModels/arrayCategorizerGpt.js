const axios = require("axios");

const OPENAI_API_KEY =
  "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";

const API_URL = "https://api.openai.com/v1/chat/completions";

const categoriesList = [
  "Income",
  "Housing",
  "Food",
  "Transportation",
  "Healthcare",
  "Insurance",
  "Debt Payment",
  "Savings",
  "Entertainment",
  "Miscellaneous",
];

/**
 * Categorize a list of transactions using GPT-4o-mini.
 * Adds a 'category' field to each item, matched by ID.
 * @param {Array} transactions - Array of { id, amount, description, date, etc. }
 */
async function categorizeTransactions(transactions) {
  const prompt = `
You are a financial assistant.
Categorize each transaction into one of the following categories:
${categoriesList.join(", ")}

Return ONLY valid JSON in this format:
[
  { "id": "txn_001", "category": "Food" },
  { "id": "txn_002", "category": "Income" },
  ...
]

Transactions:
${JSON.stringify(transactions)}
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
              "You are a financial assistant. Return only valid JSON with no explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = response.data.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();

    const categorized = JSON.parse(cleaned);
    const map = new Map(categorized.map((c) => [c.id, c.category]));

    const enriched = transactions.map((txn) => ({
      ...txn,
      category: map.get(txn.id) || "Uncategorized",
    }));

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n✅ Categorization complete. Took ${duration}s`);

    return enriched;
  } catch (error) {
    console.error(
      "❌ Categorization error:",
      error.response?.data || error.message
    );
    throw new Error("GPT failed to categorize transactions");
  }
}

(async () => {
  const transactions = [
    {
      id: "txn_001",
      description: "Burger King",
      amount: -12.5,
      date: "2025-05-20",
    },
    {
      id: "txn_002",
      description: "Monthly Salary",
      amount: 3000,
      date: "2025-05-15",
    },
    {
      id: "txn_003",
      description: "Gas station",
      amount: -45,
      date: "2025-05-12",
    },
  ];

  const result = await categorizeTransactions(transactions);
  console.log(result);
})();

module.exports = { categorizeTransactions };
