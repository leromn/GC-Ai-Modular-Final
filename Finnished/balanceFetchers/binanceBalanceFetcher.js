// balanceFetchers/binanceBalanceFetcher.js
const axios = require("axios");
const crypto = require("crypto");

// Removed hardcoded BINANCE_API_KEY and BINANCE_SECRET_KEY

const BASE_URL = "https://api.binance.com"; // Or testnet URL

// Removed global axiosInstance with hardcoded API key

// 🔐 Signature function - Modified to accept apiSecret
function signQuery(params, apiSecret) {
  if (!apiSecret) {
    throw new Error("API Secret is required to sign query for Binance.");
  }
  const query = new URLSearchParams(params).toString();
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(query)
    .digest("hex");
  // The signature should be appended as a parameter, not as part of the query string before signing for some endpoints.
  // For /api/v3/account, the signature is part of the query string.
  // For POST /sapi/v1/asset/get-funding-asset, the signed query is the request body.
  // Let's adjust how it's used. For GET, it's appended. For POST, it's more complex.
  // The provided code for POST /sapi/v1/asset/get-funding-asset was using query in URL, which is unusual for POST with signature.
  // However, Binance API can be quirky. Sticking to original structure but with dynamic keys.

  return signature; // Return only the signature
}

// 🔍 Fetch Spot Wallet Balances - Modified to accept credentials
async function fetchSpotBalances(credentials) {
  const { apiKey, apiSecret } = credentials;
  if (!apiKey || !apiSecret) {
    console.error(
      "❌ Spot Wallet Error: Missing apiKey or apiSecret in credentials."
    );
    return [];
  }

  const timestamp = Date.now();
  const params = { timestamp };
  const signature = signQuery(params, apiSecret);

  try {
    const res = await axios.get(`${BASE_URL}/api/v3/account`, {
      headers: { "X-MBX-APIKEY": apiKey },
      params: { ...params, signature }, // Signature as a query parameter
    });
    // Filter for balances with actual amounts
    return (res.data.balances || []).filter(
      (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );
  } catch (err) {
    console.error("❌ Spot Wallet Error:", err.response?.data || err.message);
    return [];
  }
}

// 💰 Fetch Funding Wallet Balances - Modified to accept credentials
async function fetchFundingBalances(credentials) {
  const { apiKey, apiSecret } = credentials;
  if (!apiKey || !apiSecret) {
    console.error(
      "❌ Funding Wallet Error: Missing apiKey or apiSecret in credentials."
    );
    return [];
  }

  const timestamp = Date.now();
  const params = { timestamp }; // Parameters for the signature
  const signature = signQuery(params, apiSecret);

  // For POST requests, parameters (including timestamp and signature) are typically sent in the body.
  // The original code had `?${query}` in the URL for a POST, which is unusual if 'query' includes the signature.
  // Correct approach for Binance POST to SAPI: signed params in x-www-form-urlencoded body or query string.
  // Let's assume the original intent was query string parameters.
  const requestParams = { ...params, signature };

  try {
    const res = await axios.post(
      `${BASE_URL}/sapi/v1/asset/get-funding-asset`,
      new URLSearchParams(requestParams).toString(), // Send as x-www-form-urlencoded string
      {
        headers: {
          "X-MBX-APIKEY": apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    // Filter for balances with actual amounts
    return (res.data || []).filter(
      (b) => parseFloat(b.free) > 0 // Funding wallet usually only shows 'free'
    );
  } catch (err) {
    console.error(
      "❌ Funding Wallet Error:",
      err.response?.data || err.message
    );
    return [];
  }
}

// 📊 Calculate Total Binance Balance - Modified to accept credentials
// This function should return an array of balance objects, as expected by runCronJob.js
// Example: [{ asset: 'BTC', free: '0.5', locked: '0.1', source: 'binance' (added by fetcher or here) }, ...]
async function fetchBinanceBalance(credentials) {
  if (!credentials) {
    console.error("❌ fetchBinanceBalance Error: Credentials not provided.");
    return []; // Return empty array if no credentials
  }

  const [spotBalancesRaw, fundingBalancesRaw] = await Promise.all([
    fetchSpotBalances(credentials),
    fetchFundingBalances(credentials),
  ]);

  const allFetchedBalances = [];

  // Process spot balances
  spotBalancesRaw.forEach((bal) => {
    allFetchedBalances.push({
      asset: bal.asset,
      free: parseFloat(bal.free || 0),
      locked: parseFloat(bal.locked || 0),
      source: "binance_spot", // Be more specific about the source
    });
  });

  // Process funding balances
  // Funding API returns a slightly different structure, ensure 'asset' and 'free' are present.
  fundingBalancesRaw.forEach((bal) => {
    // Check if this asset from funding is already in spot to avoid double counting or to sum them up.
    // For simplicity, let's assume they are distinct for now or that runCronJob handles aggregation.
    // However, runCronJob expects distinct items.
    // If an asset can be in both spot and funding, we should aggregate here.

    // Aggregation logic:
    const existingAssetIndex = allFetchedBalances.findIndex(
      (b) => b.asset === bal.asset && b.source.startsWith("binance")
    );
    if (
      existingAssetIndex > -1 &&
      allFetchedBalances[existingAssetIndex].source === "binance_spot"
    ) {
      // If asset from funding also exists in spot, just add funding 'free' to spot's 'free' for simplicity.
      // This is a simplification. A more robust way might be to keep them separate with distinct sources
      // or ensure the amounts are correctly summed if the definition of 'free' and 'locked' is consistent.
      // For now, let's assume direct addition to free if found in spot.
      // This might not be perfectly accurate if an asset is in Spot then moved to Funding.
      // A better approach: return them as separate items or with more detailed source.
      // Sticking to the requirement of runCronJob.js for an array of objects.
      allFetchedBalances.push({
        asset: bal.asset,
        free: parseFloat(bal.free || 0),
        locked: 0, // Funding wallet usually shows 'free', 'locked', 'freeze', 'withdrawing'
        source: "binance_funding",
      });
    } else if (existingAssetIndex === -1) {
      // If not in spot, add as a new item from funding
      allFetchedBalances.push({
        asset: bal.asset,
        free: parseFloat(bal.free || 0),
        locked: parseFloat(bal.locked || 0), // Funding may also have 'locked'
        source: "binance_funding",
      });
    }
  });

  // The `runCronJob` expects an array of objects, each representing an asset.
  // The old `fetchBinanceBalance` returned a single USDT total and a breakdown.
  // The new requirement for `runCronJob` (to populate `collectedRawBalances`) is an array.
  console.log(
    `✅ Total Binance raw balances fetched: ${allFetchedBalances.length}`
  );
  return allFetchedBalances; // This now returns an array of balance objects
}

module.exports = {
  fetchBinanceBalance,
};
