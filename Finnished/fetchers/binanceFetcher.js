// const BINANCE_API_KEY = "ivsGtXBmg9zQ2ShTXKOORM6qzwdTbiswBdA5ziFyqHTrAHqYTTYy50sUMhVY8erg";
// const BINANCE_SECRET_KEY = "wDVQVrqx0QCZLXJ5RmgauPWM47HdgbbVRj6hlKaQbAahnAu7O6PXRKYM5cyw8GlB";
// services/binanceFetcher.js
const axios = require("axios");
const crypto = require("crypto");

// Removed hardcoded BINANCE_API_KEY and BINANCE_SECRET_KEY

const BASE_URL = "https://api.binance.com"; // Or testnet URL if needed: https://testnet.binance.vision

// Modified to accept apiSecret from credentials
const createSignature = (params, apiSecret) => {
  if (!apiSecret) {
    throw new Error(
      "API Secret is required to create a signature for Binance."
    );
  }
  const query = new URLSearchParams(params).toString();
  return crypto.createHmac("sha256", apiSecret).update(query).digest("hex");
};

// Removed global axiosInstance with hardcoded API key

// Modified to accept credentials, startDate, endDate
async function fetchDeposits(credentials, startDate, endDate) {
  const { apiKey, apiSecret } = credentials;
  if (!apiKey || !apiSecret) {
    console.error(
      "❌ Error fetching deposits: Missing apiKey or apiSecret in credentials."
    );
    return [];
  }

  const timestamp = Date.now();
  const params = {
    timestamp,
    // Binance API uses milliseconds for startTime and endTime
    startTime: startDate.getTime(),
    endTime: endDate.getTime(),
    // status: 1, // Optional: 0:pending,6:credited but cannot find sender,1:success
    // limit: 1000, // Default 1000
    // offset: 0,
  };
  const signature = createSignature(params, apiSecret);

  try {
    const res = await axios.get(`${BASE_URL}/sapi/v1/capital/deposit/hisrec`, {
      headers: { "X-MBX-APIKEY": apiKey },
      params: { ...params, signature },
    });
    console.log(`✅ Binance deposits fetched: ${res.data?.length || 0}`);
    return res.data || [];
  } catch (err) {
    console.error(
      "❌ Error fetching Binance deposits:",
      err.response?.data || err.message
    );
    // Check for specific Binance error codes if needed
    // e.g., if (err.response?.data?.code === -2014) { console.error("Invalid API Key format"); }
    return []; // Return empty array on error to allow other operations to continue
  }
}

// Modified to accept credentials, startDate, endDate
async function fetchWithdrawals(credentials, startDate, endDate) {
  const { apiKey, apiSecret } = credentials;
  if (!apiKey || !apiSecret) {
    console.error(
      "❌ Error fetching withdrawals: Missing apiKey or apiSecret in credentials."
    );
    return [];
  }

  const timestamp = Date.now();
  const params = {
    timestamp,
    // Binance API uses milliseconds for startTime and endTime
    startTime: startDate.getTime(),
    endTime: endDate.getTime(),
    // status: 6, // Optional: 0:Email Sent,1:Cancelled,2:Awaiting Approval,3:Rejected,4:Processing,5:Failure,6:Completed
    // limit: 1000,
  };
  const signature = createSignature(params, apiSecret);

  try {
    const res = await axios.get(
      `${BASE_URL}/sapi/v1/capital/withdraw/history`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        params: { ...params, signature },
      }
    );
    console.log(`✅ Binance withdrawals fetched: ${res.data?.length || 0}`);
    return res.data || [];
  } catch (err) {
    console.error(
      "❌ Error fetching Binance withdrawals:",
      err.response?.data || err.message
    );
    return []; // Return empty array on error
  }
}

// Modified to accept credentials, startDate, endDate
async function fetchBinanceTransactions(credentials, startDate, endDate) {
  if (!credentials) {
    console.error(
      "❌ fetchBinanceTransactions Error: Credentials not provided."
    );
    return { deposits: [], withdrawals: [] }; // Return empty structure
  }
  if (!startDate || !endDate) {
    console.error(
      "❌ fetchBinanceTransactions Error: startDate or endDate not provided."
    );
    return { deposits: [], withdrawals: [] };
  }

  // Fetch deposits and withdrawals concurrently
  const [deposits, withdrawals] = await Promise.all([
    fetchDeposits(credentials, startDate, endDate),
    fetchWithdrawals(credentials, startDate, endDate),
  ]);

  // console.log({ deposits, withdrawals }); // Already logged in individual functions
  return { deposits: deposits || [], withdrawals: withdrawals || [] };
}

module.exports = {
  fetchBinanceTransactions,
  // fetchDeposits and fetchWithdrawals could be exported if needed individually
};
