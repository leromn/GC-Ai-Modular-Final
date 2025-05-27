// fetchers/walletFetchers.js
const axios = require("axios");

const ETHERSCAN_API_KEY = "DRZX6JUN9KI8RIRTQVCBX6G6CD273UISQZ"; // Replace with your key
const BLOCKSTREAM_BASE_URL = "https://blockstream.info/api";

// === Ethereum Native Transactions ===
async function fetchEthereumTransactions(address) {
  const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await axios.get(url);
  return (res.data.result || []).slice(0, 10);
}

// === ERC20 USDT Transactions on Ethereum ===
async function fetchUSDTTransactions(address) {
  const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&contractaddress=0xdac17f958d2ee523a2206206994597c13d831ec7&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await axios.get(url);
  return (res.data.result || []).slice(0, 10);
}

// === Bitcoin Transactions via Blockstream ===
async function fetchBitcoinTransactions(address) {
  const txIdsRes = await axios.get(
    `${BLOCKSTREAM_BASE_URL}/address/${address}/txs`
  );
  return (txIdsRes.data || []).slice(0, 10);
}

// (async () => {
//   try {
//     const result = await fetchUSDTTransactions(
//       "0x00000000219ab540356cBB839Cbe05303d7705Fa"
//     );
//     console.log(result);
//   } catch (err) {
//     console.error("Error fetching transactions:", err.message);
//   }
// })();

module.exports = {
  fetchEthereumTransactions,
  fetchUSDTTransactions,
  fetchBitcoinTransactions,
};
