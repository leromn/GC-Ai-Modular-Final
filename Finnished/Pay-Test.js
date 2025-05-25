const express = require("express");
const { fetchPayPalTransactions } = require("./fetchers/paypalFetcher");
const {
  normalizePayPalTransactions,
} = require("./normalizers/paypalNormalizer");
const { saveTransactionsForUser } = require("./firebase/saveTransactions");

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory array to store normalized transactions
let storedTransactions = [];

const runCode = async (req, res) => {
  const userId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1";
  try {
    const endDate = new Date().toISOString();
    const startDate = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const rawTransactions = await fetchPayPalTransactions(startDate, endDate);
    const normalized = normalizePayPalTransactions(rawTransactions);

    // Store in memory (you could replace this with DB or cache later)
    storedTransactions = normalized;

    await saveTransactionsForUser(userId, normalized).then(
      console.log("transactions saved on firestore")
    );

    // console.log(storedTransactions);
  } catch (err) {
    console.error("Transaction error:", err);
  }
};

app.listen(PORT, () => {
  console.log(`Test Server running`);
  runCode();
});
