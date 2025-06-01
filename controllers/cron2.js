// runCronJob.js
const db = require("../Finnished/firebase/firebaseClient");
const { decrypt } = require("../utils/encryption"); // Corrected path from memory
const {
  prepareTransactionsForCategorization,
  categorizeTransactionsAI,
} = require("../aiModels/arrayCategorizerGpt"); // Corrected path from memory

// Fetchers
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
// Balance Fetchers
const {
  fetchBinanceBalance,
} = require("../Finnished/balanceFetchers/binanceBalanceFetcher");
const {
  fetchPayPalBalance,
} = require("../Finnished/balanceFetchers/paypalBalanceFetcher");
const {
  fetchEthereumBalance,
  fetchUSDTBalance,
  fetchBitcoinBalance,
  fetchCryptoPrices,
} = require("../Finnished/balanceFetchers/walletBalanceFetcher");
// Normalizers
const {
  normalizeBinanceTransactions,
} = require("../Finnished/normalizers/binanceNormalizer");
const {
  normalizePayPalTransactions,
} = require("../Finnished/normalizers/paypalNormalizer");
const {
  normalizeEthereumTransactions,
  normalizeUSDTTransactions,
  normalizeBitcoinTransactions,
} = require("../Finnished/normalizers/walletNormalizer");

const runCronJob = async (req, res) => {
  const userId =
    req?.query?.userId || req?.body?.userId || "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Test User ID
  console.log("🚀 Daily Cron job started for user:", userId);

  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      console.error(`❌ User ${userId} not found for daily cron.`);
      if (res) res.status(404).send("User not found");
      return;
    }
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};
    console.log("🔗 User integrations fetched for daily cron.");

    let allNormalizedTransactions = []; // Store all normalized transactions before splitting
    let collectedRawBalances = [];

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    console.log(
      `🗓️ Daily Transaction Fetch Range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // --- BINANCE ---
    if (
      integrations.binance &&
      integrations.binance.apiKey &&
      integrations.binance.apiSecret
    ) {
      const decryptedApiKey = decrypt(integrations.binance.apiKey);
      const decryptedApiSecret = decrypt(integrations.binance.apiSecret);
      if (decryptedApiKey && decryptedApiSecret) {
        const credentials = {
          apiKey: decryptedApiKey,
          apiSecret: decryptedApiSecret,
        };
        try {
          const rawTx = await fetchBinanceTransactions(
            credentials,
            startDate,
            endDate
          );
          const normTx = normalizeBinanceTransactions(
            rawTx || { deposits: [], withdrawals: [] }
          );
          allNormalizedTransactions.push(...normTx); // Add to the main list
          const bals = await fetchBinanceBalance(credentials);
          if (Array.isArray(bals))
            bals.forEach((b) =>
              collectedRawBalances.push({
                source: b.source || "binance",
                asset: b.asset,
                amount: parseFloat(b.free || 0) + parseFloat(b.locked || 0),
                currency: b.asset,
                name: `Binance ${b.asset}`,
              })
            );
          console.log(
            `📊 Daily Binance: ${normTx.length} Tx, ${
              bals?.length || 0
            } Bal types.`
          );
        } catch (e) {
          console.error("❌ Daily Binance Error:", e.message, e.stack);
        }
      } else
        console.warn(`⚠️ Daily Cron: Binance keys decrypt fail for ${userId}.`);
    }

    // --- PAYPAL ---
    if (
      integrations.paypal &&
      integrations.paypal.apiKey &&
      integrations.paypal.apiSecret
    ) {
      const decClientId = decrypt(integrations.paypal.apiKey);
      const decClientSecret = decrypt(integrations.paypal.apiSecret);

      const PDtestEndDate = new Date(); // Current date and time (implicitly "now")

      const PDtestStartDate = new Date();
      PDtestStartDate.setTime(PDtestEndDate.getTime() - 24 * 60 * 60 * 1000);

      if (decClientId && decClientSecret) {
        const creds = { clientId: decClientId, clientSecret: decClientSecret };
        try {
          const rawTx = await fetchPayPalTransactions(
            creds,
            PDtestStartDate,
            PDtestEndDate
          );
          const normTx = normalizePayPalTransactions(rawTx);
          allNormalizedTransactions.push(
            ...(Array.isArray(normTx) ? normTx : [])
          ); // Add to the main list
          const bals = await fetchPayPalBalance(creds);
          if (Array.isArray(bals))
            bals.forEach((b) => {
              if (b && typeof b.amount === "number" && b.currency)
                collectedRawBalances.push({
                  source: b.source || "paypal",
                  asset: b.currency,
                  amount: b.amount,
                  currency: b.currency,
                  name: `PayPal ${b.currency}`,
                });
            });
          else if (bals && typeof bals.amount === "number" && bals.currency)
            collectedRawBalances.push({
              source: bals.source || "paypal",
              asset: bals.currency,
              amount: bals.amount,
              currency: bals.currency,
              name: `PayPal ${bals.currency}`,
            });
          console.log(
            `📊 Daily PayPal: ${Array.isArray(normTx) ? normTx.length : 0} Tx.`
          );
        } catch (e) {
          console.error("❌ Daily PayPal Error:", e.message, e.stack);
        }
      } else
        console.warn(`⚠️ Daily Cron: PayPal keys decrypt fail for ${userId}.`);
    }

    // --- WALLETS ---
    const wallets = integrations.wallets || {};
    if (Object.keys(wallets).length > 0) {
      for (const [coin, walletList] of Object.entries(wallets)) {
        if (!Array.isArray(walletList) || walletList.length === 0) continue;
        for (const wallet of walletList) {
          if (!wallet || !wallet.address) continue;
          const userWalletAddress = wallet.address.trim();
          try {
            let rawTx = [],
              balNum = null,
              normTx = [];
            const cL = coin.toLowerCase(),
              cU = coin.toUpperCase();
            if (cL === "eth") {
              rawTx = await fetchEthereumTransactions(userWalletAddress);
              normTx = normalizeEthereumTransactions(
                rawTx || [],
                userWalletAddress
              );
            } else if (cL === "usdt") {
              rawTx = await fetchUSDTTransactions(userWalletAddress);
              normTx = normalizeUSDTTransactions(
                rawTx || [],
                userWalletAddress
              );
            } else if (cL === "btc") {
              rawTx = await fetchBitcoinTransactions(userWalletAddress);
              normTx = normalizeBitcoinTransactions(
                rawTx || [],
                userWalletAddress
              );
            } else {
              console.warn(`Unsupported wallet: ${cU}`);
              continue;
            }

            // Add to the main list (they will be identified by source later)
            if (Array.isArray(normTx)) {
              allNormalizedTransactions.push(...normTx);
            }

            // Balances are fetched as usual
            if (cL === "eth")
              balNum = await fetchEthereumBalance(userWalletAddress);
            else if (cL === "usdt")
              balNum = await fetchUSDTBalance(userWalletAddress);
            else if (cL === "btc")
              balNum = await fetchBitcoinBalance(userWalletAddress);

            if (balNum !== null && !isNaN(balNum))
              collectedRawBalances.push({
                source: "wallet",
                asset: cU,
                amount: balNum,
                currency: cU,
                address: userWalletAddress,
                name:
                  wallet.name ||
                  `${cU} Wallet (${userWalletAddress.substring(0, 6)}...)`,
              });
          } catch (e) {
            console.error(
              `❌ Daily ${coin.toUpperCase()} Wallet Error ${userWalletAddress.substring(
                0,
                10
              )}:`,
              e.message,
              e.stack
            );
          }
        }
      }
    }

    // === CATEGORIZE TRANSACTIONS (Conditional AI Call) ===
    let finalCategorizedTransactions = [];
    if (allNormalizedTransactions.length > 0) {
      const walletTransactions = [];
      const otherPlatformTransactionsToAI = [];

      // Split transactions based on their source (assuming normalizers add a 'source' field)
      allNormalizedTransactions.forEach((tx) => {
        // Wallet sources from normalizers: 'ethereum', 'bitcoin', 'ethereum_erc20'
        if (
          tx.source === "ethereum" ||
          tx.source === "bitcoin" ||
          tx.source === "ethereum_erc20"
        ) {
          walletTransactions.push({ ...tx, category: "Crypto" }); // Assign 'Crypto' category directly
        } else {
          otherPlatformTransactionsToAI.push(tx); // These will go to AI
        }
      });

      console.log(
        `ℹ️ Daily Cron: ${walletTransactions.length} wallet transactions auto-categorized as 'Crypto'.`
      );
      finalCategorizedTransactions.push(...walletTransactions);

      if (otherPlatformTransactionsToAI.length > 0) {
        console.log(
          `\nℹ️ Daily Cron: Preparing ${otherPlatformTransactionsToAI.length} non-wallet txns for AI category...`
        );
        const preparedTxForAI = prepareTransactionsForCategorization(
          otherPlatformTransactionsToAI.map((tx) => ({ ...tx }))
        );

        if (preparedTxForAI.length > 0) {
          try {
            const aiCategorizedResults = await categorizeTransactionsAI(
              preparedTxForAI
            );
            const categoryMap = new Map(
              aiCategorizedResults.map((item) => [item.id, item.category])
            );

            const categorizedByAI = otherPlatformTransactionsToAI.map(
              (originalTx) => ({
                ...originalTx,
                category: categoryMap.get(originalTx.txId) || "Uncategorized",
              })
            );
            finalCategorizedTransactions.push(...categorizedByAI);
            console.log(
              `👍 Daily Cron: ${categorizedByAI.length} non-wallet txns processed with AI categories.`
            );
          } catch (aiError) {
            console.error(
              "❌ Daily Cron: AI Category step failed for non-wallet txns:",
              aiError.message
            );
            // Add non-wallet transactions with an error category if AI fails
            finalCategorizedTransactions.push(
              ...otherPlatformTransactionsToAI.map((tx) => ({
                ...tx,
                category: "Uncategorized (AI Error)",
              }))
            );
          }
        } else {
          // If preparation resulted in no transactions for AI, add them back without AI category (or with a default)
          finalCategorizedTransactions.push(
            ...otherPlatformTransactionsToAI.map((tx) => ({
              ...tx,
              category: "Uncategorized",
            }))
          );
        }
      }
      console.log(
        `👍 Daily Cron: Total ${finalCategorizedTransactions.length} transactions after categorization process.`
      );
    } else {
      console.log("ℹ️ Daily Cron: No transactions fetched to categorize.");
    }

    // === CONSOLIDATE BALANCES (remains the same) ===
    let totalBalanceUSD = 0;
    const balanceBreakdown = [];
    let cryptoIds = new Set();
    collectedRawBalances.forEach((b) => {
      if (b.currency && b.currency !== "USD" && b.amount > 0) {
        const cU = b.currency.toUpperCase();
        if (cU === "BTC") cryptoIds.add("bitcoin");
        else if (cU === "ETH") cryptoIds.add("ethereum");
        else if (cU === "USDT") cryptoIds.add("tether");
      }
    });
    const prices = await fetchCryptoPrices(Array.from(cryptoIds));
    for (const bal of collectedRawBalances) {
      let usdVal = 0;
      if (bal.currency === "USD") usdVal = bal.amount;
      else if (bal.currency && prices[bal.currency.toUpperCase()])
        usdVal = bal.amount * prices[bal.currency.toUpperCase()];
      else if (bal.amount > 0 && bal.currency)
        console.warn(`No price for ${bal.currency}`);
      if (
        bal.amount > 0 ||
        (bal.currency === "USD" && bal.amount !== undefined)
      ) {
        const item = {
          source: bal.source,
          name: bal.name || `${bal.source} ${bal.asset}`,
          asset: bal.asset,
          amount: bal.amount,
          currency: bal.currency,
          usdValue: parseFloat(usdVal.toFixed(2)),
        };
        if (bal.address) item.address = bal.address;
        balanceBreakdown.push(item);
        totalBalanceUSD += usdVal;
      }
    }
    const summaryData = {
      userId,
      totalBalanceUSD: parseFloat(totalBalanceUSD.toFixed(2)),
      breakdown: balanceBreakdown,
      retrievedAt: new Date().toISOString(),
      updatedBy: "dailyCron",
    };
    if (
      balanceBreakdown.length > 0 ||
      collectedRawBalances.some((b) => b.amount !== undefined)
    ) {
      await db
        .collection("allUserBalances")
        .doc(userId)
        .set(summaryData, { merge: true });
      console.log(`💰 Daily Cron: Balance summary saved for ${userId}.`);
    }

    // === STORE NEW TRANSACTIONS (using 'finalCategorizedTransactions') ===
    const txCollRef = db.collection("allUserTransactions");
    const existSnap = await txCollRef
      .where("userId", "==", userId)
      .select("txId")
      .limit(5000)
      .get();
    const existIds = new Set(
      existSnap.docs.map((d) => d.data()?.txId).filter(Boolean)
    );
    const newTxToSave = finalCategorizedTransactions.filter(
      (tx) => tx.txId && !existIds.has(tx.txId)
    ); // Use final list
    console.log(
      `✨ Daily Cron: ${newTxToSave.length} New Categorized Txns to Save.`
    );
    if (newTxToSave.length > 0) {
      const batch = db.batch();
      newTxToSave.forEach((tx) => {
        const docRef = txCollRef.doc();
        batch.set(docRef, {
          ...tx,
          userId,
          retrievedAtSaaS: new Date().toISOString(),
          sourceProcess: "dailyCron",
        });
      });
      await batch.commit();
      console.log(`🧾 Daily Cron: New categorized txns batch committed.`);
    }
    // Update user's total balance to user document
    const userRef = db.collection("users").doc(userId);
    // const admin = require("firebase-admin");

    try {
      // console.log("📊 summaryData before update:", summaryData);
      await userRef.update({
        totalBalance: summaryData,
        // cashInHand: admin.firestore.FieldValue.increment(100),
      });
    } catch (error) {
      console.error("❌ Failed to update user totalBalance:", error.message);
    }

    console.log("✅ Daily Cron job successful for user:", userId);
    if (res) res.status(200).send(`Daily Cron successful for ${userId}`);
  } catch (err) {
    console.error(
      `❌ Daily Cron Overall Error for ${userId}:`,
      err.message,
      err.stack
    );
    if (res) res.status(500).send("Daily Cron failed");
  }
};

if (require.main === module) {
  (async () => {
    const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Using your specified testUserId
    console.log(`Manually running daily cron for test user: ${testUserId}`);
    await runCronJob({ query: { userId: testUserId } }, null);
  })();
}
module.exports = { runCronJob };
