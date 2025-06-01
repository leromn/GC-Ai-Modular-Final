// initializeUserData.js
const db = require("../Finnished/firebase/firebaseClient");
const { decrypt } = require("../utils/encryption"); // Corrected path from memory
const {
  prepareTransactionsForCategorization,
  categorizeTransactionsAI,
} = require("../aiModels/arrayCategorizerGpt"); // Corrected path from memory

// Fetchers & Balance Fetchers
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

const initializeUserData = async (req, res) => {
  const userId =
    req?.body?.userId || req?.query?.userId || "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Test User ID
  if (!userId) {
    console.error("initializeUserData: userId required.");
    if (res) res.status(400).send("User ID required.");
    return;
  }
  console.log("🚀 Initializing data (Tx & Bal) for new user:", userId);

  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      console.error(`❌ User ${userId} not found for init.`);
      if (res) res.status(404).send("User not found.");
      return;
    }
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};
    console.log("🔗 User integrations fetched for init.");

    let allNormalizedTransactions = []; // Store all normalized transactions before splitting
    let collectedRawBalances = [];

    const today = new Date();
    const txEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
    txEndDate.setHours(23, 59, 59, 999);
    const txStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    txStartDate.setHours(0, 0, 0, 0);
    console.log(
      `🗓️ Initial Tx Fetch Range: ${txStartDate.toISOString()} to ${txEndDate.toISOString()}`
    );

    // --- BINANCE ---
    if (
      integrations.binance &&
      integrations.binance.apiKey &&
      integrations.binance.apiSecret
    ) {
      const decApiKey = decrypt(integrations.binance.apiKey),
        decApiSecret = decrypt(integrations.binance.apiSecret);
      if (decApiKey && decApiSecret) {
        const creds = { apiKey: decApiKey, apiSecret: decApiSecret };
        try {
          const rawTx = await fetchBinanceTransactions(
            creds,
            txStartDate,
            txEndDate
          );
          const normTx = normalizeBinanceTransactions(
            rawTx || { deposits: [], withdrawals: [] }
          );
          allNormalizedTransactions.push(...normTx); // Add to main list
          const bals = await fetchBinanceBalance(creds);
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
            `📊 Init Binance: ${normTx.length} Tx, ${
              bals?.length || 0
            } Bal types.`
          );
        } catch (e) {
          console.error("❌ Init Binance Error:", e.message, e.stack);
        }
      } else console.warn(`⚠️ Init: Binance keys decrypt fail for ${userId}.`);
    }

    // --- PAYPAL ---
    if (
      integrations.paypal &&
      integrations.paypal.apiKey &&
      integrations.paypal.apiSecret
    ) {
      const decClientId = decrypt(integrations.paypal.apiKey),
        decClientSecret = decrypt(integrations.paypal.apiSecret);

      const testEndDate = new Date(); // Today, up to current time
      testEndDate.setHours(23, 59, 59, 999); // End of today

      const testStartDate = new Date();
      testStartDate.setDate(testEndDate.getDate() - 30); // Go back 59 days to get 60 full days (today inclusive)
      testStartDate.setHours(0, 0, 0, 0); // Start of that day

      if (decClientId && decClientSecret) {
        const creds = { clientId: decClientId, clientSecret: decClientSecret };
        try {
          const rawTx = await fetchPayPalTransactions(
            creds,
            testStartDate,
            testEndDate
          );
          const normTx = normalizePayPalTransactions(rawTx);
          allNormalizedTransactions.push(
            ...(Array.isArray(normTx) ? normTx : [])
          ); // Add to main list
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
            `📊 Init PayPal: ${Array.isArray(normTx) ? normTx.length : 0} Tx.`
          );
        } catch (e) {
          console.error("❌ Init PayPal Error:", e.message, e.stack);
        }
      } else console.warn(`⚠️ Init: PayPal keys decrypt fail for ${userId}.`);
    }

    // --- WALLETS ---
    const wallets = integrations.wallets || {};
    if (Object.keys(wallets).length > 0) {
      for (const [coin, walletList] of Object.entries(wallets)) {
        if (!Array.isArray(walletList) || walletList.length === 0) continue;
        for (const wallet of walletList) {
          if (!wallet || !wallet.address) continue;
          const addr = wallet.address.trim();
          try {
            let rawTx = [],
              balNum = null,
              normTx = [];
            const cL = coin.toLowerCase(),
              cU = coin.toUpperCase();
            if (cL === "eth") {
              rawTx = await fetchEthereumTransactions(
                addr /*,txStartDate,txEndDate*/
              );
              normTx = normalizeEthereumTransactions(rawTx || [], addr);
            } else if (cL === "usdt") {
              rawTx = await fetchUSDTTransactions(
                addr /*,txStartDate,txEndDate*/
              );
              normTx = normalizeUSDTTransactions(rawTx || [], addr);
            } else if (cL === "btc") {
              rawTx = await fetchBitcoinTransactions(
                addr /*,txStartDate,txEndDate*/
              );
              normTx = normalizeBitcoinTransactions(rawTx || [], addr);
            } else {
              console.warn(`Unsupported wallet: ${cU}`);
              continue;
            }

            if (Array.isArray(normTx)) {
              // Add to main list
              allNormalizedTransactions.push(...normTx);
            }

            if (cL === "eth") balNum = await fetchEthereumBalance(addr);
            else if (cL === "usdt") balNum = await fetchUSDTBalance(addr);
            else if (cL === "btc") balNum = await fetchBitcoinBalance(addr);

            if (balNum !== null && !isNaN(balNum))
              collectedRawBalances.push({
                source: "wallet",
                asset: cU,
                amount: balNum,
                currency: cU,
                address: addr,
                name:
                  wallet.name || `${cU} Wallet (${addr.substring(0, 6)}...)`,
              });
          } catch (e) {
            console.error(
              `❌ Init ${cU} Wallet Error ${addr.substring(0, 10)}:`,
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

      allNormalizedTransactions.forEach((tx) => {
        if (
          tx.source === "ethereum" ||
          tx.source === "bitcoin" ||
          tx.source === "ethereum_erc20"
        ) {
          walletTransactions.push({ ...tx, category: "Crypto" });
        } else {
          otherPlatformTransactionsToAI.push(tx);
        }
      });
      console.log(
        `ℹ️ Init: ${walletTransactions.length} wallet transactions auto-categorized as 'Crypto'.`
      );
      finalCategorizedTransactions.push(...walletTransactions);

      if (otherPlatformTransactionsToAI.length > 0) {
        console.log(
          `\nℹ️ Init: Preparing ${otherPlatformTransactionsToAI.length} non-wallet txns for AI category...`
        );
        const preparedTxForAI = prepareTransactionsForCategorization(
          otherPlatformTransactionsToAI.map((tx) => ({ ...tx }))
        );
        if (preparedTxForAI.length > 0) {
          try {
            const aiResults = await categorizeTransactionsAI(preparedTxForAI);
            const catMap = new Map(
              aiResults.map((item) => [item.id, item.category])
            );
            const categorizedByAI = otherPlatformTransactionsToAI.map(
              (origTx) => ({
                ...origTx,
                category: catMap.get(origTx.txId) || "Uncategorized",
              })
            );
            finalCategorizedTransactions.push(...categorizedByAI);
            console.log(
              `👍 Init: ${categorizedByAI.length} non-wallet txns processed with AI categories.`
            );
          } catch (aiError) {
            console.error(
              "❌ Init: AI Category step failed for non-wallet txns:",
              aiError.message
            );
            finalCategorizedTransactions.push(
              ...otherPlatformTransactionsToAI.map((tx) => ({
                ...tx,
                category: "Uncategorized (AI Error)",
              }))
            );
          }
        } else {
          finalCategorizedTransactions.push(
            ...otherPlatformTransactionsToAI.map((tx) => ({
              ...tx,
              category: "Uncategorized",
            }))
          );
        }
      }
      console.log(
        `👍 Init: Total ${finalCategorizedTransactions.length} transactions after categorization process.`
      );
    } else console.log(`ℹ️ Init: No txns fetched to categorize.`);

    // === CONSOLIDATE BALANCES (remains the same) ===
    let totalUSD = 0;
    const balBreakdown = [];
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
        balBreakdown.push(item);
        totalUSD += usdVal;
      }
    }
    const summaryData = {
      userId,
      totalBalanceUSD: parseFloat(totalUSD.toFixed(2)),
      breakdown: balBreakdown,
      retrievedAt: new Date().toISOString(),
      updatedBy: "initialization",
    };
    if (
      balBreakdown.length > 0 ||
      collectedRawBalances.some((b) => b.amount !== undefined)
    ) {
      await db
        .collection("allUserBalances")
        .doc(userId)
        .set(summaryData, { merge: true });
      console.log(`💰 Init: Balance summary saved for ${userId}.`);
    }

    // === STORE NEW TRANSACTIONS (using 'finalCategorizedTransactions') ===
    if (finalCategorizedTransactions.length > 0) {
      // Check if there are any transactions after categorization attempt
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
      );
      console.log(
        `✨ Init: ${newTxToSave.length} New Categorized Txns to Save.`
      );
      if (newTxToSave.length > 0) {
        const batch = db.batch();
        newTxToSave.forEach((tx) => {
          const docRef = txCollRef.doc();
          batch.set(docRef, {
            ...tx,
            userId,
            retrievedAtSaaS: new Date().toISOString(),
            sourceProcess: "initialization",
          });
        });
        await batch.commit();
        console.log(`🧾 Init: New categorized txns batch committed.`);
      }
    } else console.log(`ℹ️ Init: No txns to save for ${userId}.`);

    const userRef = db.collection("users").doc(userId);
    try {
      await userRef.update({
        totalBalance: summaryData,
      });
    } catch (error) {
      console.error("❌ Failed to update user totalBalance:", error.message);
    }

    console.log("✅ User initialization (Tx & Bal) successful for:", userId);
    if (res) res.status(200).send(`Initialization successful for ${userId}.`);
  } catch (err) {
    console.error(
      `❌ User Initialization Failed for ${userId}:`,
      err.message,
      err.stack
    );
    if (res) res.status(500).send("User initialization failed.");
  }
};

if (require.main === module) {
  (async () => {
    const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Using your specified testUserId
    console.log(`Manually running user init for test user: ${testUserId}`);
    const userDocRef = db.collection("users").doc(testUserId);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.log(
        `Test user ${testUserId} not found. Creating with dummy integrations...`
      );
      await userDocRef.set(
        {
          email: `${testUserId}@example.com`,
          integrations: {
            /* Add encrypted test keys here */
          },
        },
        { merge: true }
      );
    }
    await initializeUserData({ query: { userId: testUserId } }, null);
  })();
}
module.exports = { initializeUserData };
