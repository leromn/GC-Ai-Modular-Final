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

const runCronJob = async (req, res) => {
  const userId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1";
  console.log("🚀 Cron started for user:", userId);

  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.error(`❌ User ${userId} not found.`);
      if (res) res.status(404).send("User not found");
      return;
    }
    const userData = userSnap.data();
    const integrations = userData?.integrations || {};
    console.log("🔗 User integrations fetched.");

    let allTransactions = [];
    let collectedRawBalances = []; // Store raw balances before USD conversion

    // ==== BINANCE ====
    if (integrations.binance) {
      try {
        const rawBinanceTxData = await fetchBinanceTransactions(
          integrations.binance
        );
        console.log("📦 Raw Binance Transactions Data fetched.");
        const normalizedBinanceTx = normalizeBinanceTransactions(
          rawBinanceTxData || { deposits: [], withdrawals: [] }
        );
        allTransactions.push(...normalizedBinanceTx);
        console.log(
          `✅ Normalized ${normalizedBinanceTx.length} Binance Transactions.`
        );

        // Assuming fetchBinanceBalance returns an array of objects like:
        // [{ asset: 'BTC', free: '0.5', locked: '0.1', source: 'binance' (added by fetcher or here) }, ...]
        const binanceBals = await fetchBinanceBalance(integrations.binance);
        if (Array.isArray(binanceBals)) {
          binanceBals.forEach((bal) => {
            // Ensure structure for later processing
            collectedRawBalances.push({
              source: "binance",
              asset: bal.asset, // e.g., BTC, ETH, USDT
              amount: parseFloat(bal.free || 0) + parseFloat(bal.locked || 0), // Example: sum of free and locked
              currency: bal.asset, // Redundant but good for clarity
              name: `Binance ${bal.asset}`,
            });
          });
        }
        console.log(
          `📊 ${
            binanceBals ? binanceBals.length : 0
          } Binance balances collected.`
        );
      } catch (binanceError) {
        console.error(
          "❌ Error processing Binance data:",
          binanceError.message
        );
      }
    }

    // ==== PAYPAL ====
    if (integrations.paypal) {
      try {
        const endDate = new Date();
        const startDate = new Date();
        const daysAgo = 1;
        startDate.setTime(endDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const rawTx = await fetchPayPalTransactions(startDate, endDate);
        console.log("📦 Raw PayPal Transactions fetched.");
        let normTx = normalizePayPalTransactions(rawTx);
        normTx = Array.isArray(normTx) ? normTx : [];
        allTransactions.push(...normTx);
        console.log(`✅ Normalized ${normTx.length} PayPal Transactions.`);

        // Assuming fetchPayPalBalance returns an object like: { currency: 'USD', amount: 123.45 }
        // or an array of such objects if multiple PayPal balances/currencies
        const payPalBal = await fetchPayPalBalance(integrations.paypal);
        if (payPalBal) {
          // Could be single object or array
          (Array.isArray(payPalBal) ? payPalBal : [payPalBal]).forEach(
            (bal) => {
              if (bal && typeof bal.amount === "number" && bal.currency) {
                collectedRawBalances.push({
                  source: "paypal",
                  asset: bal.currency, // e.g., USD
                  amount: bal.amount,
                  currency: bal.currency,
                  name: `PayPal ${bal.currency}`,
                });
              }
            }
          );
        }
        console.log(`📊 PayPal balances collected.`);
      } catch (paypalError) {
        console.error("❌ Error processing PayPal data:", paypalError.message);
      }
    }

    // ==== WALLETS ====
    const wallets = integrations.wallets || {};
    if (Object.keys(wallets).length > 0) {
      console.log("👛 Processing crypto wallets.");
      for (const [coin, walletList] of Object.entries(wallets)) {
        if (!Array.isArray(walletList) || walletList.length === 0) continue;
        console.log(`🔍 Fetching ${coin.toUpperCase()} wallet data.`);
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
            )}...`
          );
          try {
            let rawWalletTx = [];
            let rawBalNum = null;
            let normalizedWalletTx = [];
            const coinLower = coin.toLowerCase();
            const coinUpper = coin.toUpperCase();

            if (coinLower === "eth") {
              rawWalletTx = await fetchEthereumTransactions(userWalletAddress);
              normalizedWalletTx = normalizeEthereumTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchEthereumBalance(userWalletAddress);
            } else if (coinLower === "usdt") {
              rawWalletTx = await fetchUSDTTransactions(userWalletAddress);
              normalizedWalletTx = normalizeUSDTTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchUSDTBalance(userWalletAddress);
            } else if (coinLower === "btc") {
              rawWalletTx = await fetchBitcoinTransactions(userWalletAddress);
              normalizedWalletTx = normalizeBitcoinTransactions(
                rawWalletTx || [],
                userWalletAddress
              );
              rawBalNum = await fetchBitcoinBalance(userWalletAddress);
            } else {
              console.warn(`⚠️ Unsupported wallet coin type: ${coin}`);
              continue;
            }

            allTransactions.push(...(normalizedWalletTx || []));
            console.log(
              `✅ Normalized ${
                normalizedWalletTx ? normalizedWalletTx.length : 0
              } ${coinUpper} Transactions for ${userWalletAddress.substring(
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
                `⚠️ No valid balance fetched for ${coinUpper} ${userWalletAddress.substring(
                  0,
                  10
                )}...`
              );
            }
          } catch (error) {
            console.error(
              `❌ Error processing ${coin.toUpperCase()} wallet ${userWalletAddress.substring(
                0,
                10
              )}...:`,
              error.message
            );
          }
        }
        console.log(`📊 Wallets for ${coin.toUpperCase()} processed.`);
      }
    }

    // === MODIFIED_START: CONSOLIDATE BALANCES AND STORE AS SINGLE DOCUMENT ===
    let totalBalanceUSD = 0;
    const balanceBreakdown = [];
    let cryptoCurrencyIdsForPriceFetch = new Set();

    // Collect all unique currency symbols that need USD conversion (non-USD cryptos)
    collectedRawBalances.forEach((bal) => {
      if (bal.currency !== "USD" && bal.amount > 0) {
        // Only fetch price for non-zero balances
        // Map to CoinGecko IDs (this mapping might need to be more sophisticated)
        if (bal.currency === "BTC")
          cryptoCurrencyIdsForPriceFetch.add("bitcoin");
        else if (bal.currency === "ETH")
          cryptoCurrencyIdsForPriceFetch.add("ethereum");
        else if (bal.currency === "USDT")
          cryptoCurrencyIdsForPriceFetch.add("tether");
        // Add more for other Binance assets if they are not USDT/BTC/ETH
        // else cryptoCurrencyIdsForPriceFetch.add(bal.currency.toLowerCase()); // Risky, CoinGecko IDs are specific
      }
    });

    const prices = await fetchCryptoPrices(
      Array.from(cryptoCurrencyIdsForPriceFetch)
    );
    console.log("💰 Fetched Prices (USD):", prices);
    //edited
    // ... other code ...

    for (const bal of collectedRawBalances) {
      let usdValue = 0;
      if (bal.currency === "USD") {
        usdValue = bal.amount;
      } else if (prices[bal.currency.toUpperCase()]) {
        usdValue = bal.amount * prices[bal.currency.toUpperCase()];
      } else if (bal.amount > 0) {
        console.warn(
          `⚠️ No USD price found for ${
            bal.currency
          }. Cannot convert balance for ${bal.name || bal.asset}.`
        );
      }

      if (bal.amount > 0 || bal.currency === "USD") {
        const breakdownItem = {
          // Create the base object
          source: bal.source,
          name: bal.name || `${bal.source} ${bal.asset}`,
          asset: bal.asset,
          amount: bal.amount,
          currency: bal.currency,
          usdValue: parseFloat(usdValue.toFixed(2)), // Also good to ensure USD value is a number
        };

        // === MODIFIED_START: Conditionally add address ===
        if (bal.address !== undefined) {
          breakdownItem.address = bal.address;
        }
        // === MODIFIED_END ===

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
      await balanceDocRef.set(consolidatedBalanceData); // No ignoreUndefinedProperties needed here if undefined is handled
      console.log(
        `💰 Consolidated balance summary saved to balances/summary. Total USD: ${consolidatedBalanceData.totalBalanceUSD}`
      );
    } else {
      console.log("ℹ️ No balances collected to create a summary.");
    }
    // ... rest of the code ...
    // === MODIFIED_END ===

    // === STORE ONLY NEW TRANSACTIONS to /transactions (remains the same) ===
    const transactionsRef = userRef.collection("transactions");
    // Consider optimizing this if it becomes slow. Fetching all docs can be expensive.
    // Maybe fetch only IDs or use a query with a recent timestamp limit if applicable.
    const existingSnap = await transactionsRef.select("txId").limit(5000).get();
    const existingIds = new Set(
      existingSnap.docs.map((doc) => doc.data()?.txId).filter(Boolean)
    );
    console.log(
      `📄 Found ${existingIds.size} existing transaction IDs (checked last 5000).`
    );

    const newTransactions = allTransactions.filter((tx) => {
      const id = tx.txId; // Assume all normalizers now produce 'txId'
      return id && !existingIds.has(id);
    });

    console.log(`✨ ${newTransactions.length} New Transactions to Save.`);

    if (newTransactions.length > 0) {
      const batch = db.batch(); // Create a new batch just for transactions
      newTransactions.forEach((tx) => {
        const docRef = transactionsRef.doc();
        batch.set(docRef, {
          ...tx,
          userId: userId,
          timestamp: new Date().toISOString(), // This is when SaaS got it, not tx date
        });
      });
      await batch.commit();
      console.log(`🧾 New transactions batch committed.`);
    }

    console.log("✅ Cron job executed successfully");
    console.log(`🧾 Transactions saved: ${newTransactions.length}`);
    console.log(
      `💰 Balances processed. Total sources in breakdown: ${balanceBreakdown.length}`
    );
  } catch (err) {
    console.error("❌ Cron Job Failed Overall:", err.message, err.stack);
    if (res) res.status(500).send("Cron job failed");
  }
};

if (require.main === module) {
  (async () => {
    try {
      await runCronJob();
    } catch (err) {
      console.error("❌ Error running cron directly", err.message);
    }
  })();
}

module.exports = { runCronJob };
