// runCronJob.js
// Assuming this file is in a 'controllers' or 'jobs' directory
// Adjust paths based on your project structure

const db = require("../Finnished/firebase/firebaseClient"); // Adjust path
const { decrypt } = require("../utils/encryption"); // Adjust path

// === FETCHERS ===
const {
  fetchBinanceTransactions,
} = require("../Finnished/fetchers/binanceFetcher"); // Adjust path
const {
  fetchPayPalTransactions,
} = require("../Finnished/fetchers/paypalFetcher"); // Adjust path
const {
  fetchEthereumTransactions,
  fetchUSDTTransactions,
  fetchBitcoinTransactions,
} = require("../Finnished/fetchers/walletFetcher"); // Adjust path

// === BALANCE FETCHERS ===
const {
  fetchBinanceBalance,
} = require("../Finnished/balanceFetchers/binanceBalanceFetcher"); // Adjust path
const {
  fetchPayPalBalance,
} = require("../Finnished/balanceFetchers/paypalBalanceFetcher"); // Adjust path
const {
  fetchEthereumBalance,
  fetchUSDTBalance,
  fetchBitcoinBalance,
  fetchCryptoPrices,
} = require("../Finnished/balanceFetchers/walletBalanceFetcher"); // Adjust path

// === NORMALISERS ===
const {
  normalizeBinanceTransactions,
} = require("../Finnished/normalizers/binanceNormalizer"); // Adjust path
const {
  normalizePayPalTransactions,
} = require("../Finnished/normalizers/paypalNormalizer"); // Adjust path
const {
  normalizeEthereumTransactions,
  normalizeUSDTTransactions,
  normalizeBitcoinTransactions,
} = require("../Finnished/normalizers/walletNormalizer"); // Adjust path

const runCronJob = async (req, res) => {
  const userId =
    req?.query?.userId || req?.body?.userId || "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Example fallback
  console.log("🚀 Daily Cron job started for user:", userId);

  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.error(`❌ User ${userId} not found for daily cron.`);
      if (res) res.status(404).send("User not found");
      return;
    }
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};
    console.log("🔗 User integrations fetched for daily cron.");

    let allTransactions = [];
    let collectedRawBalances = [];

    // === Determine Date Range for Transactions (Daily Cron: Previous Day Only) ===
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

    // ==== BINANCE ====
    if (
      integrations.binance &&
      integrations.binance.apiKey &&
      integrations.binance.apiSecret
    ) {
      const decryptedApiKey = decrypt(integrations.binance.apiKey);
      const decryptedApiSecret = decrypt(integrations.binance.apiSecret);

      if (decryptedApiKey && decryptedApiSecret) {
        const binanceCredentials = {
          apiKey: decryptedApiKey,
          apiSecret: decryptedApiSecret,
        };
        try {
          const rawBinanceTxData = await fetchBinanceTransactions(
            binanceCredentials,
            startDate,
            endDate
          );
          console.log("📦 Daily Binance Transactions Data fetched.");
          const normalizedBinanceTx = normalizeBinanceTransactions(
            rawBinanceTxData || { deposits: [], withdrawals: [] }
          );
          allTransactions.push(...normalizedBinanceTx);
          console.log(
            `✅ Normalized ${normalizedBinanceTx.length} Daily Binance Transactions.`
          );

          const binanceBals = await fetchBinanceBalance(binanceCredentials);
          if (Array.isArray(binanceBals)) {
            binanceBals.forEach((bal) =>
              collectedRawBalances.push({
                source: bal.source || "binance", // Ensure source is set
                asset: bal.asset,
                amount: parseFloat(bal.free || 0) + parseFloat(bal.locked || 0),
                currency: bal.asset,
                name: `Binance ${bal.asset}`,
              })
            );
          }
          console.log(
            `📊 ${
              binanceBals ? binanceBals.length : 0
            } Daily Binance balances collected.`
          );
        } catch (binanceError) {
          console.error(
            "❌ Error processing Daily Binance data:",
            binanceError.message,
            binanceError.stack
          );
        }
      } else {
        console.warn(
          `⚠️ Failed to decrypt Binance API keys for user ${userId} in daily cron. Skipping Binance.`
        );
      }
    } else if (integrations.binance) {
      console.log(
        "ℹ️ Daily cron: Binance integration configured but API keys are missing or not in expected encrypted format."
      );
    }

    // ==== PAYPAL ====
    if (
      integrations.paypal &&
      integrations.paypal.apiKey &&
      integrations.paypal.apiSecret
    ) {
      const decryptedPayPalClientId = decrypt(integrations.paypal.apiKey);
      const decryptedPayPalClientSecret = decrypt(
        integrations.paypal.apiSecret
      );

      if (decryptedPayPalClientId && decryptedPayPalClientSecret) {
        const paypalCredentials = {
          clientId: decryptedPayPalClientId,
          clientSecret: decryptedPayPalClientSecret,
        };
        try {
          const rawTx = await fetchPayPalTransactions(
            paypalCredentials,
            startDate,
            endDate
          );
          console.log("📦 Daily PayPal Transactions fetched.");
          let normTx = normalizePayPalTransactions(rawTx);
          normTx = Array.isArray(normTx) ? normTx : [];
          allTransactions.push(...normTx);
          console.log(
            `✅ Normalized ${normTx.length} Daily PayPal Transactions.`
          );

          const payPalBals = await fetchPayPalBalance(paypalCredentials); // fetchPayPalBalance returns array or null
          if (Array.isArray(payPalBals)) {
            payPalBals.forEach((bal) => {
              if (bal && typeof bal.amount === "number" && bal.currency) {
                collectedRawBalances.push({
                  source: bal.source || "paypal", // Ensure source is set
                  asset: bal.currency,
                  amount: bal.amount,
                  currency: bal.currency,
                  name: `PayPal ${bal.currency}`,
                });
              }
            });
          } else if (
            payPalBals &&
            typeof payPalBals.amount === "number" &&
            payPalBals.currency
          ) {
            // Handle single object case
            collectedRawBalances.push({
              source: payPalBals.source || "paypal",
              asset: payPalBals.currency,
              amount: payPalBals.amount,
              currency: payPalBals.currency,
              name: `PayPal ${payPalBals.currency}`,
            });
          }
          console.log(`📊 Daily PayPal balances collected.`);
        } catch (paypalError) {
          console.error(
            "❌ Error processing Daily PayPal data:",
            paypalError.message,
            paypalError.stack
          );
        }
      } else {
        console.warn(
          `⚠️ Failed to decrypt PayPal API keys for user ${userId} in daily cron. Skipping PayPal.`
        );
      }
    } else if (integrations.paypal) {
      console.log(
        "ℹ️ Daily cron: PayPal integration configured but API keys are missing or not in expected encrypted format."
      );
    }

    // ==== WALLETS ====
    const wallets = integrations.wallets || {};
    if (Object.keys(wallets).length > 0) {
      console.log("👛 Processing crypto wallets for daily cron.");
      for (const [coin, walletList] of Object.entries(wallets)) {
        if (!Array.isArray(walletList) || walletList.length === 0) continue;
        console.log(`🔍 Fetching daily ${coin.toUpperCase()} wallet data.`);
        for (const wallet of walletList) {
          if (
            !wallet ||
            !wallet.address ||
            typeof wallet.address !== "string" ||
            wallet.address.trim() === ""
          )
            continue;
          const userWalletAddress = wallet.address.trim();
          console.log(
            `⏳ Processing ${coin.toUpperCase()} address: ${userWalletAddress.substring(
              0,
              10
            )}... for daily cron`
          );
          try {
            let rawWalletTx = [];
            let rawBalNum = null;
            let normalizedWalletTx = [];
            const coinLower = coin.toLowerCase();
            const coinUpper = coin.toUpperCase();

            if (coinLower === "eth") {
              rawWalletTx = await fetchEthereumTransactions(
                userWalletAddress /*, startDate, endDate */
              );
              normalizedWalletTx = normalizeEthereumTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchEthereumBalance(userWalletAddress);
            } else if (coinLower === "usdt") {
              rawWalletTx = await fetchUSDTTransactions(
                userWalletAddress /*, startDate, endDate */
              );
              normalizedWalletTx = normalizeUSDTTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchUSDTBalance(userWalletAddress);
            } else if (coinLower === "btc") {
              rawWalletTx = await fetchBitcoinTransactions(
                userWalletAddress /*, startDate, endDate */
              );
              normalizedWalletTx = normalizeBitcoinTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchBitcoinBalance(userWalletAddress);
            } else {
              console.warn(
                `⚠️ Unsupported wallet coin type: ${coin} in daily cron`
              );
              continue;
            }

            allTransactions.push(
              ...(Array.isArray(normalizedWalletTx) ? normalizedWalletTx : [])
            );

            if (
              rawBalNum !== null &&
              typeof rawBalNum === "number" &&
              !isNaN(rawBalNum)
            ) {
              collectedRawBalances.push({
                source: "wallet",
                asset: coinUpper,
                amount: rawBalNum,
                currency: coinUpper,
                address: userWalletAddress,
                name:
                  wallet.name ||
                  `${coinUpper} Wallet (${userWalletAddress.substring(
                    0,
                    6
                  )}...)`,
              });
            }
          } catch (error) {
            console.error(
              `❌ Error processing daily ${coin.toUpperCase()} wallet ${userWalletAddress.substring(
                0,
                10
              )}...:`,
              error.message,
              error.stack
            );
          }
        }
      }
    }

    // === CONSOLIDATE BALANCES AND STORE AS SINGLE DOCUMENT ===
    let totalBalanceUSD = 0;
    const balanceBreakdown = [];
    let cryptoCurrencyIdsForPriceFetch = new Set();
    collectedRawBalances.forEach((bal) => {
      if (bal.currency && bal.currency !== "USD" && bal.amount > 0) {
        // Check bal.currency exists
        const currencyUpper = bal.currency.toUpperCase();
        if (currencyUpper === "BTC")
          cryptoCurrencyIdsForPriceFetch.add("bitcoin");
        else if (currencyUpper === "ETH")
          cryptoCurrencyIdsForPriceFetch.add("ethereum");
        else if (currencyUpper === "USDT")
          cryptoCurrencyIdsForPriceFetch.add("tether");
        // Add more mappings for other CoinGecko IDs if necessary for other Binance assets
        // else cryptoCurrencyIdsForPriceFetch.add(currencyUpper.toLowerCase()); // Example, needs careful mapping
      }
    });

    const prices = await fetchCryptoPrices(
      Array.from(cryptoCurrencyIdsForPriceFetch)
    );
    console.log("💰 Daily Cron: Fetched Prices (USD):", prices);

    for (const bal of collectedRawBalances) {
      let usdValue = 0;
      if (bal.currency === "USD") {
        usdValue = bal.amount;
      } else if (bal.currency && prices[bal.currency.toUpperCase()]) {
        // Check bal.currency and price
        usdValue = bal.amount * prices[bal.currency.toUpperCase()];
      } else if (bal.amount > 0 && bal.currency) {
        // Only warn if amount > 0 and currency exists
        console.warn(
          `⚠️ Daily cron: No USD price for ${bal.currency}. Balance for ${
            bal.name || bal.asset
          } not converted.`
        );
      }

      if (
        bal.amount > 0 ||
        (bal.currency === "USD" && bal.amount !== undefined)
      ) {
        const breakdownItem = {
          source: bal.source,
          name: bal.name || `${bal.source} ${bal.asset}`,
          asset: bal.asset,
          amount: bal.amount,
          currency: bal.currency,
          usdValue: parseFloat(usdValue.toFixed(2)),
        };
        if (bal.address !== undefined) breakdownItem.address = bal.address;
        balanceBreakdown.push(breakdownItem);
        totalBalanceUSD += usdValue;
      }
    }
    const consolidatedBalanceData = {
      userId: userId,
      totalBalanceUSD: parseFloat(totalBalanceUSD.toFixed(2)),
      breakdown: balanceBreakdown,
      retrievedAt: new Date().toISOString(),
    };
    if (
      balanceBreakdown.length > 0 ||
      collectedRawBalances.some((b) => b.amount !== undefined)
    ) {
      // Save even if total is 0 but balances were processed
      const balanceDocRef = userRef.collection("balances").doc("summary");
      await balanceDocRef.set(consolidatedBalanceData);
      console.log(
        `💰 Daily cron: Consolidated balance summary saved. Total USD: ${consolidatedBalanceData.totalBalanceUSD}`
      );
    } else console.log("ℹ️ Daily cron: No balances to create summary.");

    // === STORE ONLY NEW TRANSACTIONS to /transactions ===
    const transactionsRef = userRef.collection("transactions");
    const existingSnap = await transactionsRef.select("txId").limit(5000).get();
    const existingIds = new Set(
      existingSnap.docs.map((doc) => doc.data()?.txId).filter(Boolean)
    );

    const newTransactions = allTransactions.filter(
      (tx) => tx.txId && !existingIds.has(tx.txId)
    );
    console.log(
      `✨ Daily cron: ${newTransactions.length} New Transactions to Save.`
    );
    if (newTransactions.length > 0) {
      const batch = db.batch();
      newTransactions.forEach((tx) => {
        const docRef = transactionsRef.doc();
        batch.set(docRef, {
          ...tx,
          userId: userId,
          retrievedAtSaaS: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.log(`🧾 Daily cron: New transactions batch committed.`);
    }

    console.log("✅ Daily Cron job executed successfully for user:", userId);
    if (res)
      res
        .status(200)
        .send(`Daily Cron job executed successfully for user ${userId}`);
  } catch (err) {
    console.error(
      "❌ Daily Cron Job Failed Overall for user " + userId + ":",
      err.message,
      err.stack
    );
    if (res) res.status(500).send("Daily Cron job failed");
  }
};

if (require.main === module) {
  (async () => {
    const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1";
    console.log(`Running daily cron job directly for test user: ${testUserId}`);
    const mockReq = { query: { userId: testUserId } }; // Simulate request object
    await runCronJob(mockReq, null);
  })();
}

module.exports = { runCronJob };
