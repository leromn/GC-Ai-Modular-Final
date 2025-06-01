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

/**
 * Processes data for a single user: fetches transactions, balances, categorizes, and saves.
 * @param {string} userId - The ID of the user to process.
 */
async function processUserDataForDailyCron(userId) {
  console.log(`\n🚀 Starting daily data processing for user: ${userId}`);
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      console.error(`❌ User ${userId} not found. Skipping.`);
      return; // Skip this user
    }
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};
    console.log(`🔗 User integrations fetched for ${userId}.`);

    let allNormalizedTransactions = [];
    let collectedRawBalances = [];

    const today = new Date();
    const startDate = new Date(today); // Previous day start
    startDate.setDate(today.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today); // Previous day end
    endDate.setDate(today.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    console.log(
      `🗓️ Daily Tx Fetch Range for ${userId}: ${startDate.toISOString()} to ${endDate.toISOString()}`
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
          allNormalizedTransactions.push(...normTx);
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
            `📊 Binance (User ${userId}): ${normTx.length} Tx, ${
              bals?.length || 0
            } Bal types.`
          );
        } catch (e) {
          console.error(
            `❌ Binance Error (User ${userId}):`,
            e.message,
            e.stack
          );
        }
      } else console.warn(`⚠️ Binance keys decrypt fail for ${userId}.`);
    }

    // --- PAYPAL ---
    // Using 'startDate' and 'endDate' for previous day as defined above
    if (
      integrations.paypal &&
      integrations.paypal.apiKey &&
      integrations.paypal.apiSecret
    ) {
      const decClientId = decrypt(integrations.paypal.apiKey);
      const decClientSecret = decrypt(integrations.paypal.apiSecret);
      if (decClientId && decClientSecret) {
        const creds = { clientId: decClientId, clientSecret: decClientSecret };
        try {
          const rawTx = await fetchPayPalTransactions(
            creds,
            startDate,
            endDate
          ); // Use defined startDate, endDate
          const normTx = normalizePayPalTransactions(rawTx);
          allNormalizedTransactions.push(
            ...(Array.isArray(normTx) ? normTx : [])
          );
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
            `📊 PayPal (User ${userId}): ${
              Array.isArray(normTx) ? normTx.length : 0
            } Tx.`
          );
        } catch (e) {
          console.error(
            `❌ PayPal Error (User ${userId}):`,
            e.message,
            e.stack
          );
        }
      } else console.warn(`⚠️ PayPal keys decrypt fail for ${userId}.`);
    }

    // --- WALLETS ---
    const wallets = integrations.wallets || {};
    if (Object.keys(wallets).length > 0) {
      for (const [coin, walletList] of Object.entries(wallets)) {
        if (!Array.isArray(walletList) || walletList.length === 0) continue;
        for (const wallet of walletList) {
          if (
            !wallet ||
            !wallet.address ||
            typeof wallet.address !== "string" ||
            wallet.address.trim() === ""
          )
            continue;
          const userWalletAddress = wallet.address.trim();
          try {
            let rawTx = [],
              balNum = null,
              normTx = [];
            const cL = coin.toLowerCase(),
              cU = coin.toUpperCase();
            // Wallet fetchers currently fetch "recent". For precise "previous day", they'd need date params.
            if (cL === "eth") {
              rawTx = await fetchEthereumTransactions(userWalletAddress);
              normTx = normalizeEthereumTransactions(
                rawTx || [],
                userWalletAddress
              );
              balNum = await fetchEthereumBalance(userWalletAddress);
            } else if (cL === "usdt") {
              rawTx = await fetchUSDTTransactions(userWalletAddress);
              normTx = normalizeUSDTTransactions(
                rawTx || [],
                userWalletAddress
              );
              balNum = await fetchUSDTBalance(userWalletAddress);
            } else if (cL === "btc") {
              rawTx = await fetchBitcoinTransactions(userWalletAddress);
              normTx = normalizeBitcoinTransactions(
                rawTx || [],
                userWalletAddress
              );
              balNum = await fetchBitcoinBalance(userWalletAddress);
            } else {
              console.warn(`Unsupported wallet: ${cU} for user ${userId}`);
              continue;
            }
            if (Array.isArray(normTx))
              allNormalizedTransactions.push(...normTx);
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
              `❌ ${cU} Wallet Error ${userWalletAddress.substring(
                0,
                10
              )} (User ${userId}):`,
              e.message,
              e.stack
            );
          }
        }
      }
    }

    // === CATEGORIZE TRANSACTIONS ===
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
          walletTransactions.push({ ...tx, category: "Crypto Transfer" }); // More specific default for wallets
        } else {
          otherPlatformTransactionsToAI.push(tx);
        }
      });
      finalCategorizedTransactions.push(...walletTransactions);
      console.log(
        `ℹ️ ${walletTransactions.length} wallet txns auto-categorized (User ${userId}).`
      );

      if (otherPlatformTransactionsToAI.length > 0) {
        console.log(
          `\nℹ️ Preparing ${otherPlatformTransactionsToAI.length} non-wallet txns for AI (User ${userId})...`
        );
        const preparedTxForAI = prepareTransactionsForCategorization(
          otherPlatformTransactionsToAI
        ); // No need to map here, func handles it
        if (preparedTxForAI.length > 0) {
          try {
            const aiCategorizedResults = await categorizeTransactionsAI(
              preparedTxForAI
            );
            // aiCategorizedResults is assumed to be an array of {id, category}
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
              `👍 ${categorizedByAI.length} non-wallet txns AI-categorized (User ${userId}).`
            );
          } catch (aiError) {
            console.error(
              `❌ AI Category failed for non-wallet txns (User ${userId}):`,
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
    } else {
      console.log(
        `ℹ️ No transactions fetched to categorize for user ${userId}.`
      );
    }

    // === CONSOLIDATE BALANCES ===
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
        console.warn(`No price for ${bal.currency} (User ${userId})`);
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
      console.log(`💰 Balance summary saved for ${userId}.`);
    }

    // === STORE NEW TRANSACTIONS ===
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
      `✨ ${newTxToSave.length} New Categorized Txns to Save for ${userId}.`
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
      console.log(`🧾 New categorized txns batch committed for ${userId}.`);
    }

    // Update user's total balance to user document (as per your previous code)
    const userDocRef = db.collection("users").doc(userId);
    try {
      await userDocRef.update({
        totalBalance: summaryData, // Save the whole summary object
        // lastCronSuccessAt: new Date().toISOString(), // Optional: track last successful run
      });
      console.log(`Updated totalBalance in users/${userId} document.`);
    } catch (error) {
      console.error(
        `❌ Failed to update totalBalance for users/${userId}:`,
        error.message
      );
    }

    console.log(`✅ Daily data processing successful for user: ${userId}`);
  } catch (err) {
    console.error(
      `❌ Overall Error during daily processing for ${userId}:`,
      err.message,
      err.stack
    );
  }
}

/**
 * Main cron job function to fetch all users and process their data.
 * This function is typically triggered by a scheduler (e.g., Cloud Scheduler).
 */
async function runDailyCronForAllUsers(req, res) {
  console.log("🚀🚀🚀 Starting Daily Cron Job for ALL USERS 🚀🚀🚀");
  let processedUserCount = 0;
  let failedUserCount = 0;

  try {
    const usersSnapshot = await db.collection("users").select().get(); // Fetch only IDs if possible, or minimal fields
    if (usersSnapshot.empty) {
      console.log("No users found to process.");
      if (res) res.status(200).send("No users found to process.");
      return;
    }

    console.log(`Found ${usersSnapshot.size} users to process.`);

    // Process users sequentially to avoid overwhelming APIs or resources.
    // For parallel processing with controlled concurrency, consider using Promise.all with a library like p-limit.
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      try {
        await processUserDataForDailyCron(userId);
        processedUserCount++;
      } catch (userProcessingError) {
        failedUserCount++;
        console.error(
          `Failed to process user ${userId} completely:`,
          userProcessingError.message
        );
        // Continue to the next user
      }
    }

    const summaryMessage = `Daily Cron Job for ALL USERS completed. Processed: ${processedUserCount}, Failed: ${failedUserCount}.`;
    console.log(`🏁🏁🏁 ${summaryMessage} 🏁🏁🏁`);
    if (res) res.status(200).send(summaryMessage);
  } catch (error) {
    console.error(
      "❌ FATAL ERROR in runDailyCronForAllUsers:",
      error.message,
      error.stack
    );
    if (res) res.status(500).send("Fatal error during cron job execution.");
  }
}

// If called directly, run for all users.
// For HTTP trigger, use runDailyCronForAllUsers.
// The old runCronJob (for single user) can be kept for testing or specific triggers if needed,
// but the main scheduled job should call runDailyCronForAllUsers.
if (require.main === module) {
  (async () => {
    // To test processing for a SINGLE user when running script directly:
    // const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1";
    // console.log(`Manually running daily cron for single test user: ${testUserId}`);
    // await processUserDataForDailyCron(testUserId);

    // To test processing for ALL users:
    console.log("Manually running daily cron for ALL users...");
    await runDailyCronForAllUsers(null, null); // Simulate no HTTP req/res
  })();
}

// Export the main function to be called by scheduler
module.exports = {
  runDailyCronForAllUsers,
  processUserDataForDailyCron, // Exporting for potential individual use/testing
};
