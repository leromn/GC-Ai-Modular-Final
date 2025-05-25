// binanceFetcher.js
const axios = require("axios");
const crypto = require("crypto");

const BINANCE_API_KEY = "ivsGtXBmg9zQ2ShTXKOORM6qzwdTbiswBdA5ziFyqHTrAHqYTTYy50sUMhVY8erg";
const BINANCE_SECRET_KEY = "wDVQVrqx0QCZLXJ5RmgauPWM47HdgbbVRj6hlKaQbAahnAu7O6PXRKYM5cyw8GlB";

const BASE_URL = "https://api.binance.com";

const createSignature = (params) => {
  const query = new URLSearchParams(params).toString();
  return crypto.createHmac("sha256", BINANCE_SECRET_KEY).update(query).digest("hex");
};

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "X-MBX-APIKEY": BINANCE_API_KEY,
  },
});

async function fetchDeposits() {
  const timestamp = Date.now();
  const params = {
    timestamp,
  };
  const signature = createSignature(params);

  try {
    const res = await axiosInstance.get("/sapi/v1/capital/deposit/hisrec", {
      params: { ...params, signature },
    });
    return res.data;
  } catch (err) {
    console.error("❌ Error fetching deposits:", err.response?.data || err.message);
    return [];
  }
}

async function fetchWithdrawals() {
  const timestamp = Date.now();
  const params = {
    timestamp,
  };
  const signature = createSignature(params);

  try {
    const res = await axiosInstance.get("/sapi/v1/capital/withdraw/history", {
      params: { ...params, signature },
    });
    return res.data;
  } catch (err) {
    console.error("❌ Error fetching withdrawals:", err.response?.data || err.message);
    return [];
  }
}

async function fetchBinanceTransactions() {
  const [deposits, withdrawals] = await Promise.all([
    fetchDeposits(),
    fetchWithdrawals(),
  ]);
  console.log({ deposits, withdrawals })
  return { deposits, withdrawals };
}

module.exports = {
  fetchBinanceTransactions,
};
