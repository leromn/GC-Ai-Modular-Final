// initializeUser.js (or a more suitable name like dataSyncService.js)
const db = require("../Finnished/firebase/firebaseClient"); // Adjust path
const { decrypt } = require("../utils/encryption"); // Adjust path

// === FETCHERS (Transaction and Balance fetchers needed) ===
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
  fetchCryptoPrices, // Import fetchCryptoPrices
} = require("../Finnished/balanceFetchers/walletBalanceFetcher");

// === NORMALISERS ===
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

// Renamed function to reflect it now handles balances too
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
    let collectedRawBalances = []; // To store balances before USD conversion

    // === Determine Date Range for Transactions (Previous Full Month) ===
    const today = new Date();
    // End date is the last moment of the last day of the previous month
    const txEndDate = new Date(today.getFullYear(), today.getMonth(), 0); // Day 0 of current month = last day of prev month
    txEndDate.setHours(23, 59, 59, 999);

    // Start date is the first moment of the first day of the previous month
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
          // Fetch Transactions
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

          // Fetch Balances
          const binanceBals = await fetchBinanceBalance(binanceCredentials);
          if (Array.isArray(binanceBals)) {
            binanceBals.forEach((bal) =>
              collectedRawBalances.push({
                source: "binance",
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
            binanceError.message
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
      const decryptedClientId = decrypt(integrations.paypal.apiKey);
      const decryptedClientSecret = decrypt(integrations.paypal.apiSecret);
      if (decryptedClientId && decryptedClientSecret) {
        const paypalCredentials = {
          clientId: decryptedClientId,
          clientSecret: decryptedClientSecret,
        };
        try {
          // Fetch Transactions
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

          // Fetch Balances
          const payPalBal = await fetchPayPalBalance(paypalCredentials);
          if (payPalBal) {
            (Array.isArray(payPalBal) ? payPalBal : [payPalBal]).forEach(
              (bal) => {
                if (bal && typeof bal.amount === "number" && bal.currency) {
                  collectedRawBalances.push({
                    source: "paypal",
                    asset: bal.currency,
                    amount: bal.amount,
                    currency: bal.currency,
                    name: `PayPal ${bal.currency}`,
                  });
                }
              }
            );
          }
          console.log(`📊 Initial PayPal balances collected.`);
        } catch (paypalError) {
          console.error(
            "❌ Error processing initial PayPal data:",
            paypalError.message
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

            // TODO: Update wallet fetchers if they need to respect txStartDate, txEndDate for a full historical sync
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

            allTransactions.push(...(normalizedWalletTx || []));
            console.log(
              `✅ Normalized ${
                normalizedWalletTx ? normalizedWalletTx.length : 0
              } Initial ${coinUpper} Tx for ${userWalletAddress.substring(
                0,
                10
              )}...`
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
            } else {
              console.warn(
                `⚠️ No valid initial balance fetched for ${coinUpper} ${userWalletAddress.substring(
                  0,
                  10
                )}...`
              );
            }
          } catch (error) {
            console.error(
              `❌ Error processing initial ${coin.toUpperCase()} wallet data for ${userWalletAddress}:`,
              error.message
            );
          }
        }
        console.log(
          `📊 Initial wallets data for ${coin.toUpperCase()} processed.`
        );
      }
    }

    // === CONSOLIDATE BALANCES AND STORE AS SINGLE DOCUMENT ===
    let totalBalanceUSD = 0;
    const balanceBreakdown = [];
    let cryptoCurrencyIdsForPriceFetch = new Set();
    collectedRawBalances.forEach((bal) => {
      if (bal.currency !== "USD" && bal.amount > 0) {
        if (bal.currency === "BTC")
          cryptoCurrencyIdsForPriceFetch.add("bitcoin");
        else if (bal.currency === "ETH")
          cryptoCurrencyIdsForPriceFetch.add("ethereum");
        else if (bal.currency === "USDT")
          cryptoCurrencyIdsForPriceFetch.add("tether");
        // Add more mappings here if necessary
      }
    });
    const prices = await fetchCryptoPrices(
      Array.from(cryptoCurrencyIdsForPriceFetch)
    );
    console.log("💰 Fetched Prices (USD) for initial data sync:", prices);

    for (const bal of collectedRawBalances) {
      let usdValue = 0;
      if (bal.currency === "USD") usdValue = bal.amount;
      else if (prices[bal.currency.toUpperCase()])
        usdValue = bal.amount * prices[bal.currency.toUpperCase()];
      else if (bal.amount > 0)
        console.warn(`⚠️ Initial Sync: No USD price for ${bal.currency}.`);

      if (bal.amount > 0 || bal.currency === "USD") {
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
    if (balanceBreakdown.length > 0) {
      const balanceDocRef = userRef.collection("balances").doc("summary");
      await balanceDocRef.set(consolidatedBalanceData);
      console.log(
        `💰 Initial consolidated balance summary saved. Total USD: ${consolidatedBalanceData.totalBalanceUSD}`
      );
    } else console.log("ℹ️ Initial Sync: No balances to create summary.");

    // === STORE ONLY NEW TRANSACTIONS (similar logic to cron job) ===
    if (allTransactions.length > 0) {
      const transactionsRef = userRef.collection("transactions");
      const existingSnap = await transactionsRef
        .select("txId")
        .limit(5000)
        .get(); // Check against recently added, good enough for init
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

// Direct run block for testing initializeUserData
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
      // You would need your `encrypt` function here if keys are actually encrypted during user setup
      // For simplicity, I'm assuming keys are already in their "encrypted" string format from your example
      await userDocRef.set(
        {
          email: `${testUserId}@example.com`,
          // MAKE SURE these apiKey/apiSecret values are DUMMY and NOT your real encrypted ones.
          // For a true test, you'd use the encrypt() function you have to prepare these.
          integrations: {
            // Example:
            // paypal: { apiKey: "enc:fakePayPalClientId", apiSecret: "enc:fakePayPalSecret" },
            // binance: { apiKey: "enc:fakeBinanceApiKey", apiSecret: "enc:fakeBinanceApiSecret" },
            // wallets: { eth: [{ address: "0x00000000219ab540356cBB839Cbe05303d7705Fa", platform: "Test" }] }
          },
        },
        { merge: true }
      ); // Use merge to avoid overwriting other fields if user doc partially exists
      console.log(
        `Dummy user ${testUserId} created/updated with placeholder integrations.`
      );
    } else {
      console.log(`Test user ${testUserId} found.`);
    }

    const mockReq = { query: { userId: testUserId } };
    await initializeUserData(mockReq, null);
  })();
}

module.exports = { initializeUserData }; // Export the renamed function
