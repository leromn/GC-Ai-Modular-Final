const axios = require("axios");
const crypto = require("crypto");

// Replace with your actual keys (testnet or mainnet)
const BINANCE_API_KEY =
  "ivsGtXBmg9zQ2ShTXKOORM6qzwdTbiswBdA5ziFyqHTrAHqYTTYy50sUMhVY8erg";
const BINANCE_SECRET_KEY =
  "wDVQVrqx0QCZLXJ5RmgauPWM47HdgbbVRj6hlKaQbAahnAu7O6PXRKYM5cyw8GlB";

const BASE_URL = "https://api.binance.com";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "X-MBX-APIKEY": BINANCE_API_KEY },
});

// 🔐 Signature function
function signQuery(params) {
  const query = new URLSearchParams(params).toString();
  const signature = crypto
    .createHmac("sha256", BINANCE_SECRET_KEY)
    .update(query)
    .digest("hex");
  return `${query}&signature=${signature}`;
}

// 🔍 Fetch Spot Wallet Balances
async function fetchSpotBalances() {
  const timestamp = Date.now();
  const query = signQuery({ timestamp });

  try {
    const res = await axiosInstance.get(`/api/v3/account?${query}`);
    return res.data.balances.filter(
      (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );
  } catch (err) {
    console.error("Spot Wallet Error:", err.response?.data || err.message);
    return [];
  }
}

// 💰 Fetch Funding Wallet Balances
async function fetchFundingBalances() {
  const timestamp = Date.now();
  const query = signQuery({ timestamp });

  try {
    const res = await axiosInstance.post(
      `/sapi/v1/asset/get-funding-asset?${query}`,
      {}
    );
    return res.data.filter(
      (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );
  } catch (err) {
    console.error("Funding Wallet Error:", err.response?.data || err.message);
    return [];
  }
}

// 📊 Calculate Total Binance Balance
async function fetchBinanceBalance() {
  const spot = await fetchSpotBalances();
  const funding = await fetchFundingBalances();

  const combined = [...spot, ...funding];

  const balancesByAsset = {};

  for (const item of combined) {
    const asset = item.asset;
    const free = parseFloat(item.free || 0);
    const locked = parseFloat(item.locked || 0);
    const total = free + locked;

    if (!balancesByAsset[asset]) balancesByAsset[asset] = 0;
    balancesByAsset[asset] += total;
  }

  // Optionally, return only stablecoins or a single value
  const totalUSDT = balancesByAsset["USDT"] || 0;

  return {
    currency: "USDT",
    amount: totalUSDT,
    breakdown: balancesByAsset, // optional: remove if only totalUSDT is needed
  };
}

// async function checkBalance() {
//   const balance = await fetchBinanceBalance();
//   console.log("Current Binance Balance:", balance);
// }

// checkBalance();
module.exports = {
  fetchBinanceBalance,
};
