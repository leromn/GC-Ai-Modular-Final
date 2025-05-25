// index.js
const { fetchBinanceTransactions } = require("./fetcher/binanceFetcher");
const { normalizeBinanceTransactions } = require("./normalizer/binanceNormalizer");

(async () => {
  try {
    const rawData = await fetchBinanceTransactions();
    const normalized = normalizeBinanceTransactions(rawData);
    console.log("✅ Normalized Binance Transactions:");
    console.dir(normalized, { depth: null });
  } catch (err) {
    console.error("❌ Error processing Binance data:", err.message);
  }
})();
