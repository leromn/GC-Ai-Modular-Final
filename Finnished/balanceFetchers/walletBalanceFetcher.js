const axios = require("axios");

// It's highly recommended to store API keys in environment variables
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY || "DRZX6JUN9KI8RIRTQVCBX6G6CD273UISQZ"; // Fallback only for example
const BLOCKSTREAM_BASE_URL = "https://blockstream.info/api";
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

// === ETH Balance ===
async function fetchEthereumBalance(address) {
  if (!address || typeof address !== "string" || address.trim() === "") {
    console.warn(
      "fetchEthereumBalance: ETH address is invalid or empty. Skipping fetch."
    );
    return null; // Return null for error/invalid input
  }
  try {
    const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const res = await axios.get(url);
    if (res.data && res.data.status === "1" && res.data.result) {
      const balanceInETH = parseFloat(res.data.result) / 1e18;
      return isNaN(balanceInETH) ? 0 : balanceInETH; // Ensure a number, even if API gives weird result
    } else {
      console.error(
        `ETH Fetch Error for ${address}: Invalid Etherscan response. Message: ${res.data.message}, Result: ${res.data.result}`
      );
      return null;
    }
  } catch (err) {
    console.error(`ETH Fetch Error for address ${address}:`, err.message);
    return null;
  }
}

// === USDT Balance (ERC-20 on Ethereum) ===
async function fetchUSDTBalance(address) {
  // address here is an Ethereum address
  if (!address || typeof address !== "string" || address.trim() === "") {
    console.warn(
      "fetchUSDTBalance: ETH address for USDT is invalid or empty. Skipping fetch."
    );
    return null;
  }
  try {
    const USDT_CONTRACT_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7";
    const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const res = await axios.get(url);
    if (res.data && res.data.status === "1" && res.data.result) {
      const balanceInUSDT = parseFloat(res.data.result) / 1e6; // USDT has 6 decimals
      return isNaN(balanceInUSDT) ? 0 : balanceInUSDT;
    } else {
      console.error(
        `USDT Fetch Error for ${address}: Invalid Etherscan response. Message: ${res.data.message}, Result: ${res.data.result}`
      );
      return null;
    }
  } catch (err) {
    console.error(`USDT Fetch Error for address ${address}:`, err.message);
    return null;
  }
}

// === BTC Balance ===
async function fetchBitcoinBalance(address) {
  if (!address || typeof address !== "string" || address.trim() === "") {
    console.warn(
      "fetchBitcoinBalance: BTC address is invalid or empty. Skipping fetch."
    );
    return null;
  }
  try {
    const res = await axios.get(`${BLOCKSTREAM_BASE_URL}/address/${address}`);
    if (res.data && res.data.chain_stats) {
      const balanceInSatoshis =
        (res.data.chain_stats.funded_txo_sum || 0) -
        (res.data.chain_stats.spent_txo_sum || 0);
      const balanceInBTC = parseFloat(balanceInSatoshis) / 1e8;
      return isNaN(balanceInBTC) ? 0 : balanceInBTC;
    } else {
      console.error(
        `BTC Fetch Error for ${address}: Invalid Blockstream response structure.`
      );
      return null;
    }
  } catch (err) {
    if (err.response && err.response.status === 400) {
      // Blockstream returns 400 for invalid address format, sometimes 404 for not found
      console.log(
        `BTC address ${address} likely invalid or not found on Blockstream (status ${err.response.status}), assuming 0 balance for this attempt.`
      );
      return 0; // Treat as 0 balance if address is confirmed not found/invalid by API
    }
    console.error(`BTC Fetch Error for address ${address}:`, err.message);
    return null; // For other errors, return null
  }
}

// === Get Prices (USD) ===
// Expand this list as needed for all currencies from Binance/PayPal that aren't USD
async function fetchCryptoPrices(
  currencyIds = ["bitcoin", "ethereum", "tether"]
) {
  if (!Array.isArray(currencyIds) || currencyIds.length === 0) {
    console.warn("fetchCryptoPrices: No currency IDs provided.");
    return {};
  }
  try {
    const idsParam = currencyIds.join(",");
    const res = await axios.get(
      `${COINGECKO_API}?ids=${idsParam}&vs_currencies=usd`
    );
    // Transform the response to be { 'SYMBOL': price } e.g. { 'BTC': 50000, 'ETH': 3000 }
    // CoinGecko returns keys like 'bitcoin', 'ethereum'. We need to map them.
    const prices = {};
    Object.keys(res.data).forEach((key) => {
      // Basic mapping, can be made more robust
      if (key === "bitcoin") prices["BTC"] = res.data[key].usd;
      else if (key === "ethereum") prices["ETH"] = res.data[key].usd;
      else if (key === "tether") prices["USDT"] = res.data[key].usd;
      // Add more mappings here if fetchCryptoPrices is used for other Binance assets
      else prices[key.toUpperCase()] = res.data[key].usd; // Fallback for other IDs
    });
    return prices;
  } catch (err) {
    console.error("Price Fetch Error:", err.message);
    return {}; // Return empty object on error, so lookups yield undefined
  }
}

module.exports = {
  fetchEthereumBalance,
  fetchUSDTBalance,
  fetchBitcoinBalance,
  fetchCryptoPrices,
};
