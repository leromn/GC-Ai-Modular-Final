const db = require("../Finnished/firebase/firebaseClient");

// === FETCHERS ===
const {
  fetchBinanceTransactions,
} = require("../Finnished/fetchers/binanceFetcher");
const {
  fetchPayPalTransactions,
} = require("../Finnished/fetchers/paypalFetcher");
const {
  fetchEthereumTransactions,
  fetchUSDTTransactions,
  fetchBitcoinTransactions,
} = require("../Finnished/fetchers/walletFetcher");

// === BALANCE FETCHERS ===
const {
  fetchBinanceBalance,
} = require("../Finnished/balanceFetchers/binanceBalanceFetcher");
const {
  fetchPayPalBalance,
} = require("../Finnished/balanceFetchers/paypalBalanceFetcher");
const {
  fetchTotalWalletBalance,
} = require("../Finnished/balanceFetchers/walletBalanceFetcher");

// === NORMALISERS ===
const {
  normalizeBinanceTransactions,
} = require("../Finnished/normalizers/binanceNormalizer");
const {
  normalizePayPalTransactions,
} = require("../Finnished/normalizers/paypalNormalizer");
const {
  normalizeWalletTransactions,
} = require("../Finnished/normalizers/walletNormalizer");

const runCronJob = async (req, res) => {
  const userId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Replace with auth if needed
  console.log("🚀 Cron started");

  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};

    console.log("🔗 User integrations fetched:", JSON.stringify(integrations));

    let allTransactions = [];
    let allBalances = [];

    // ==== BINANCE ====
    if (integrations.binance) {
      const rawTx = await fetchBinanceTransactions(integrations.binance);
      console.log("📦 Raw Binance Transactions:", rawTx);
      const normTx = Array.isArray(normalizeBinanceTransactions(rawTx))
        ? normalizeBinanceTransactions(rawTx)
        : [];
      console.log("✅ Normalized Binance Transactions:", normTx);
      allTransactions.push(...normTx);

      const rawBal = await fetchBinanceBalance(integrations.binance);
      console.log("📦 Raw Binance Balances:", rawBal);
      const normBal = Array.isArray(rawBal) ? rawBal : [];
      allBalances.push(...normBal);
      console.log("📊 Binance fetched");
    }

    // ==== PAYPAL ====
    if (integrations.paypal) {
      const endDate = new Date();
      const startDate = new Date();
      // startDate.setMonth(endDate.getMonth() - 1); // last 6 months
      const daysAgo = 1;
      startDate.setTime(endDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const rawTx = await fetchPayPalTransactions(startDate, endDate);
      console.log("📦 Raw PayPal Transactions:", rawTx);
      const normTx = Array.isArray(normalizePayPalTransactions(rawTx))
        ? normalizePayPalTransactions(rawTx)
        : [];
      console.log("✅ Normalized PayPal Transactions:", normTx);
      allTransactions.push(...normTx);

      const rawBal = await fetchPayPalBalance(integrations.paypal);
      console.log("📦 Raw PayPal Balances:", rawBal);
      const normBal = Array.isArray(rawBal) ? rawBal : [];
      allBalances.push(...normBal);
      console.log("📊 PayPal fetched");
    }

    // ==== WALLETS ====
    const wallets = integrations.wallets || {};

    for (const [coin, walletList] of Object.entries(wallets)) {
      console.log(`🔍 Fetching wallets for ${coin}:`, walletList);
      for (const wallet of walletList) {
        let rawTx = [];
        let rawBal = [];

        if (coin.toLowerCase() === "eth") {
          rawTx = await fetchEthereumTransactions(wallet.address);
          rawBal = await fetchEthereumBalance(wallet.address);
        } else if (coin.toLowerCase() === "usdt") {
          rawTx = await fetchUSDTTransactions(wallet.address);
          rawBal = await fetchUSDTBalance(wallet.address);
        } else if (coin.toLowerCase() === "btc") {
          rawTx = await fetchBitcoinTransactions(wallet.address);
          rawBal = await fetchBitcoinBalance(wallet.address);
        } else {
          console.warn(`⚠️ Unsupported wallet coin: ${coin}`);
          continue;
        }

        console.log(
          `📦 Raw ${coin.toUpperCase()} Transactions for ${wallet.address}:`,
          rawTx
        );

        const normTx = Array.isArray(normalizeWalletTransactions(coin, rawTx))
          ? normalizeWalletTransactions(coin, rawTx)
          : [];

        console.log(
          `✅ Normalized ${coin.toUpperCase()} Transactions:`,
          normTx
        );
        allTransactions.push(...normTx);

        console.log(
          `📦 Raw ${coin.toUpperCase()} Balance for ${wallet.address}:`,
          rawBal
        );
        const normBal = Array.isArray(rawBal) ? rawBal : [];
        allBalances.push(...normBal);
      }
      console.log(`📊 Wallets for ${coin} fetched`);
    }

    // === STORE BALANCES to /balances ===
    const balancesRef = userRef.collection("balances");
    const batch = db.batch();

    allBalances.forEach((bal) => {
      const docRef = balancesRef.doc(); // auto-ID
      batch.set(docRef, {
        ...bal,
        timestamp: new Date().toISOString(),
      });
    });

    // === STORE ONLY NEW TRANSACTIONS to /transactions ===
    const transactionsRef = userRef.collection("transactions");
    const existingSnap = await transactionsRef.get();
    const existingIds = new Set(
      existingSnap.docs.map((doc) => doc.data()?.id || doc.data()?.txId)
    );
    console.log("📄 Existing transaction IDs:", [...existingIds]);

    const newTransactions = allTransactions.filter((tx) => {
      const id = tx.id || tx.txId;
      return id && !existingIds.has(id);
    });
    console.log("✨ New Transactions to Save:", newTransactions);

    newTransactions.forEach((tx) => {
      const docRef = transactionsRef.doc();
      batch.set(docRef, {
        ...tx,
        timestamp: new Date().toISOString(),
      });
    });

    await batch.commit();

    console.log("✅ Cron job executed successfully");
    console.log(`🧾 Transactions saved: ${newTransactions.length}`);
    console.log(`💰 Balances saved: ${allBalances.length}`);
  } catch (err) {
    console.error("❌ Cron Job Failed:", err.message, err.stack);
  }
};

// Run immediately if called as a script
(async () => {
  try {
    await runCronJob();
  } catch (err) {
    console.error("❌ Error running cron", err.message);
  }
})();

module.exports = { runCronJob };
