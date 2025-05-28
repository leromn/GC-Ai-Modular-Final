// initializeUserData.js (or your chosen file name e.g., dataSyncService.js)
// Assuming this file is in a 'controllers' or 'services' directory
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

const initializeUserData = async (req, res) => {
  const userId = req?.body?.userId || req?.query?.userId;

  if (!userId) {
    console.error("initializeUserData: userId is required.");
    if (res) res.status(400).send("User ID is required.");
    return;
  }
  console.log(
    "🚀 Initializing data (transactions & balances) for new user:",
    userId
  );

  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.error(`❌ User ${userId} not found for initialization.`);
      if (res) res.status(404).send("User not found.");
      return;
    }
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};
    console.log("🔗 User integrations fetched for initialization.");

    let allTransactions = [];
    let collectedRawBalances = [];

    // === Determine Date Range for Transactions (Previous Full Month) ===
    const today = new Date();
    const txEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
    txEndDate.setHours(23, 59, 59, 999);
    const txStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    txStartDate.setHours(0, 0, 0, 0);
    console.log(
      `🗓️ Initial Transaction Fetch Range: ${txStartDate.toISOString()} to ${txEndDate.toISOString()}`
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
            txStartDate,
            txEndDate
          );
          console.log("📦 Initial Binance Transactions Data fetched.");
          const normalizedBinanceTx = normalizeBinanceTransactions(
            rawBinanceTxData || { deposits: [], withdrawals: [] }
          );
          allTransactions.push(...normalizedBinanceTx);
          console.log(
            `✅ Normalized ${normalizedBinanceTx.length} Initial Binance Transactions.`
          );

          const binanceBals = await fetchBinanceBalance(binanceCredentials);
          if (Array.isArray(binanceBals)) {
            binanceBals.forEach((bal) =>
              collectedRawBalances.push({
                source: bal.source || "binance",
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
            } Initial Binance balances collected.`
          );
        } catch (binanceError) {
          console.error(
            "❌ Error processing initial Binance data:",
            binanceError.message,
            binanceError.stack
          );
        }
      } else {
        console.warn(
          `⚠️ Failed to decrypt Binance API keys for user ${userId} during initialization.`
        );
      }
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
            txStartDate,
            txEndDate
          );
          console.log("📦 Initial PayPal Transactions fetched.");
          let normTx = normalizePayPalTransactions(rawTx);
          normTx = Array.isArray(normTx) ? normTx : [];
          allTransactions.push(...normTx);
          console.log(
            `✅ Normalized ${normTx.length} Initial PayPal Transactions.`
          );

          const payPalBals = await fetchPayPalBalance(paypalCredentials);
          if (Array.isArray(payPalBals)) {
            payPalBals.forEach((bal) => {
              if (bal && typeof bal.amount === "number" && bal.currency) {
                collectedRawBalances.push({
                  source: bal.source || "paypal",
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
          console.log(`📊 Initial PayPal balances collected.`);
        } catch (paypalError) {
          console.error(
            "❌ Error processing initial PayPal data:",
            paypalError.message,
            paypalError.stack
          );
        }
      } else {
        console.warn(
          `⚠️ Failed to decrypt PayPal API keys for user ${userId} during initialization.`
        );
      }
    }

    // ==== WALLETS ====
    const wallets = integrations.wallets || {};
    if (Object.keys(wallets).length > 0) {
      console.log("👛 Processing crypto wallets for initial data fetch.");
      for (const [coin, walletList] of Object.entries(wallets)) {
        if (!Array.isArray(walletList) || walletList.length === 0) continue;
        console.log(`🔍 Fetching initial ${coin.toUpperCase()} wallet data.`);
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
            )}... for initial fetch`
          );
          try {
            let rawWalletTx = [];
            let rawBalNum = null;
            let normalizedWalletTx = [];
            const coinLower = coin.toLowerCase();
            const coinUpper = coin.toUpperCase();

            if (coinLower === "eth") {
              rawWalletTx = await fetchEthereumTransactions(
                userWalletAddress /*, txStartDate, txEndDate */
              );
              normalizedWalletTx = normalizeEthereumTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchEthereumBalance(userWalletAddress);
            } else if (coinLower === "usdt") {
              rawWalletTx = await fetchUSDTTransactions(
                userWalletAddress /*, txStartDate, txEndDate */
              );
              normalizedWalletTx = normalizeUSDTTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchUSDTBalance(userWalletAddress);
            } else if (coinLower === "btc") {
              rawWalletTx = await fetchBitcoinTransactions(
                userWalletAddress /*, txStartDate, txEndDate */
              );
              normalizedWalletTx = normalizeBitcoinTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchBitcoinBalance(userWalletAddress);
            } else {
              console.warn(
                `⚠️ Unsupported wallet coin type: ${coin} in initial fetch`
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
              `❌ Error processing initial ${coin.toUpperCase()} wallet data for ${userWalletAddress}:`,
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
        const currencyUpper = bal.currency.toUpperCase();
        if (currencyUpper === "BTC")
          cryptoCurrencyIdsForPriceFetch.add("bitcoin");
        else if (currencyUpper === "ETH")
          cryptoCurrencyIdsForPriceFetch.add("ethereum");
        else if (currencyUpper === "USDT")
          cryptoCurrencyIdsForPriceFetch.add("tether");
      }
    });
    const prices = await fetchCryptoPrices(
      Array.from(cryptoCurrencyIdsForPriceFetch)
    );
    console.log("💰 Initial Sync: Fetched Prices (USD):", prices);

    for (const bal of collectedRawBalances) {
      let usdValue = 0;
      if (bal.currency === "USD") {
        usdValue = bal.amount;
      } else if (bal.currency && prices[bal.currency.toUpperCase()]) {
        usdValue = bal.amount * prices[bal.currency.toUpperCase()];
      } else if (bal.amount > 0 && bal.currency) {
        console.warn(
          `⚠️ Initial Sync: No USD price for ${bal.currency}. Balance for ${
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
      const balanceDocRef = userRef.collection("balances").doc("summary");
      await balanceDocRef.set(consolidatedBalanceData);
      console.log(
        `💰 Initial consolidated balance summary saved. Total USD: ${consolidatedBalanceData.totalBalanceUSD}`
      );
    } else console.log("ℹ️ Initial Sync: No balances to create summary.");

    // === STORE ONLY NEW TRANSACTIONS ===
    if (allTransactions.length > 0) {
      const transactionsRef = userRef.collection("transactions");
      const existingSnap = await transactionsRef
        .select("txId")
        .limit(5000)
        .get();
      const existingIds = new Set(
        existingSnap.docs.map((doc) => doc.data()?.txId).filter(Boolean)
      );

      const newTransactions = allTransactions.filter(
        (tx) => tx.txId && !existingIds.has(tx.txId)
      );
      console.log(
        `✨ ${newTransactions.length} New Initial Transactions to Save.`
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
        console.log(
          `🧾 Initial transactions batch committed for user ${userId}.`
        );
      }
    } else {
      console.log(
        `ℹ️ No initial transactions found or processed to save for user ${userId}.`
      );
    }

    console.log(
      "✅ User initialization (transactions & balances) completed for:",
      userId
    );
    if (res)
      res
        .status(200)
        .send(
          `Initialization for user ${userId} completed. Fetched ${allTransactions.length} potential transactions and ${balanceBreakdown.length} balance sources.`
        );
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
    const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Use a distinct test user ID
    console.log(
      `Running user data initialization directly for test user: ${testUserId}`
    );

    const userDocRef = db.collection("users").doc(testUserId);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.log(
        `Test user ${testUserId} does not exist. Creating with dummy integrations for test...`
      );
      await userDocRef.set(
        {
          email: `${testUserId}@example.com`,
          integrations: {
            /* Add dummy encrypted keys here if needed for test */
          },
        },
        { merge: true }
      );
      console.log(`Dummy user ${testUserId} created/updated.`);
    } else {
      console.log(`Test user ${testUserId} found.`);
    }

    const mockReq = { query: { userId: testUserId } }; // Simulate request
    await initializeUserData(mockReq, null);
  })();
}

module.exports = { initializeUserData };
