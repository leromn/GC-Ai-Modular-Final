const db = require("../Finnished/firebase/firebaseClient");

// === FETCHERS ===
const { fetchBinanceTransactions } = require("../Finnished/fetchers/binanceFetcher");
const { fetchPayPalTransactions } = require("../Finnished/fetchers/paypalFetcher");
const { fetchWalletTransactions } = require("../Finnished/fetchers/walletFetcher");

// === BALANCE FETCHERS ===
const { fetchBinanceBalance } = require("../Finnished/balanceFetchers/binanceBalanceFetcher");
const { fetchPayPalBalance } = require("../Finnished/balanceFetchers/paypalBalanceFetcher");
const { fetchWalletBalance } = require("../Finnished/balanceFetchers/walletBalanceFetcher");

// === NORMALISERS ===
const { normalizeBinanceTransactions } = require("../Finnished/normalisers/binanceNormalizer");
const { normalizePayPalTransactions } = require("../Finnished/normalisers/paypalNormalizer");
const { normalizeWalletTransactions } = require("../normalisers/walletNormalizer");

const { normalizeBinanceBalance } = require("../Finnished/normalisers/binanceBalanceNormalizer");
const { normalizePayPalBalance } = require("../Finnished/normalisers/paypalBalanceNormalizer");
const { normalizeWalletBalance } = require("../Finnished/normalisers/walletBalanceNormalizer");

const runCronJob = async (req, res) => {
  const userId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Replace with auth if needed

  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    const integrations = userData?.integrations || {};

    let allTransactions = [];
    let allBalances = [];

    // ==== BINANCE ====
    if (integrations.binance) {
      const rawTx = await fetchBinanceTransactions(integrations.binance);
      const normTx = normalizeBinanceTransactions(rawTx);
      allTransactions.push(...normTx);

      const rawBal = await fetchBinanceBalance(integrations.binance);
      const normBal = normalizeBinanceBalance(rawBal);
      allBalances.push(...normBal);
    }

      // ==== PAYPAL ====
      if (integrations.paypal) {
        const rawTx = await fetchPayPalTransactions(integrations.paypal);
        const normTx = normalizePayPalTransactions(rawTx);
        allTransactions.push(...normTx);
  
        const rawBal = await fetchPayPalBalance(integrations.paypal);
        const normBal = normalizePayPalBalance(rawBal);
        allBalances.push(...normBal);
      }
  
      // ==== WALLETS ====
      const wallets = integrations.wallets || {};
      for (const [coin, walletList] of Object.entries(wallets)) {
        for (const wallet of walletList) {
          const rawTx = await fetchWalletTransactions(coin, wallet);
          const normTx = normalizeWalletTransactions(coin, rawTx);
          allTransactions.push(...normTx);
  
          const rawBal = await fetchWalletBalance(coin, wallet);
          const normBal = normalizeWalletBalance(coin, rawBal);
          allBalances.push(...normBal);
        }
      }
  
      // === Save all normalized data at once ===
      await userRef.collection("normalizedData").doc("latest").set({
        transactions: allTransactions,
        balances: allBalances,
        updatedAt: new Date().toISOString(),
      });
  
      res.status(200).json({
        success: true,
        message: "✅ Cron job executed successfully",
        transactionsSaved: allTransactions.length,
        balancesSaved: allBalances.length,
      });
  
    } catch (err) {
      console.error("❌ Cron Job Failed:", err.message);
      res.status(500).json({ error: "Cron job failed." });
    }
  };
  
  module.exports = { runCronJob };