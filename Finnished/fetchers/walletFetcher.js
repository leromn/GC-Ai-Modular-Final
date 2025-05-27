// fetchers/walletFetchers.js
const axios = require("axios");

// It's highly recommended to store API keys in environment variables
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY || "DRZX6JUN9KI8RIRTQVCBX6G6CD273UISQZ"; // Fallback only for example
const BLOCKSTREAM_BASE_URL = "https://blockstream.info/api";
const USDT_CONTRACT_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7"; // USDT on Ethereum

const DEFAULT_TX_LIMIT = 10; // How many recent transactions to fetch

// === Ethereum Native Transactions ===
async function fetchEthereumTransactions(address) {
  if (!address) return [];
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const res = await axios.get(url);
    // Etherscan returns status "0" if no transactions, or "1" if successful. Result can be an empty array or string "No transactions found".
    if (res.data && res.data.status === "1" && Array.isArray(res.data.result)) {
      return res.data.result.slice(0, DEFAULT_TX_LIMIT);
    }
    if (res.data && res.data.message === "No transactions found") {
      return [];
    }
    console.warn(
      `fetchEthereumTransactions: Unexpected Etherscan response for ${address}:`,
      res.data.message || res.data.result
    );
    return [];
  } catch (error) {
    console.error(
      `Error fetching Ethereum transactions for ${address}:`,
      error.message
    );
    return [];
  }
}

// === ERC20 USDT Transactions on Ethereum ===
async function fetchUSDTTransactions(address) {
  // address is an Ethereum address
  if (!address) return [];
  try {
    const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const res = await axios.get(url);
    if (res.data && res.data.status === "1" && Array.isArray(res.data.result)) {
      return res.data.result.slice(0, DEFAULT_TX_LIMIT);
    }
    if (res.data && res.data.message === "No transactions found") {
      return [];
    }
    console.warn(
      `fetchUSDTTransactions: Unexpected Etherscan response for ${address}:`,
      res.data.message || res.data.result
    );
    return [];
  } catch (error) {
    console.error(
      `Error fetching USDT transactions for ${address}:`,
      error.message
    );
    return [];
  }
}

// === Bitcoin Transactions via Blockstream ===
async function fetchBitcoinTransactions(address) {
  if (!address) return [];
  try {
    // First, get transaction IDs
    const txsUrl = `${BLOCKSTREAM_BASE_URL}/address/${address}/txs`;
    const txsRes = await axios.get(txsUrl);
    if (txsRes.data && Array.isArray(txsRes.data)) {
      // Blockstream already returns tx objects, not just IDs here.
      // The example used slice(0,10), so we'll keep that.
      return txsRes.data.slice(0, DEFAULT_TX_LIMIT);
    }
    return [];
  } catch (error) {
    // Blockstream might return 400 for invalid address, or empty array if no txs
    if (
      error.response &&
      (error.response.status === 400 || error.response.status === 404)
    ) {
      console.log(
        `fetchBitcoinTransactions: Address ${address} invalid or no transactions found (status ${error.response.status}).`
      );
      return [];
    }
    console.error(
      `Error fetching Bitcoin transactions for ${address}:`,
      error.message
    );
    return [];
  }
}

module.exports = {
  fetchEthereumTransactions,
  fetchUSDTTransactions,
  fetchBitcoinTransactions,
};
