const axios = require("axios");

const ETHERSCAN_API_KEY = "DRZX6JUN9KI8RIRTQVCBX6G6CD273UISQZ";
const BLOCKSTREAM_BASE_URL = "https://blockstream.info/api";
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

// === ETH Balance ===
async function fetchEthereumBalance(address) {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const res = await axios.get(url);
    const balanceInETH = parseFloat(res.data.result) / 1e18;
    return balanceInETH;
  } catch (err) {
    console.error("ETH Fetch Error:", err.message);
    return 0;
  }
}

// === USDT Balance (ERC-20) ===
async function fetchUSDTBalance(address) {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0xdac17f958d2ee523a2206206994597c13d831ec7&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const res = await axios.get(url);
    const balanceInUSDT = parseFloat(res.data.result) / 1e6;
    return balanceInUSDT;
  } catch (err) {
    console.error("USDT Fetch Error:", err.message);
    return 0;
  }
}

// === BTC Balance ===
async function fetchBitcoinBalance(address) {
  try {
    const res = await axios.get(`${BLOCKSTREAM_BASE_URL}/address/${address}`);
    const balanceInBTC =
      parseFloat(
        res.data.chain_stats.funded_txo_sum - res.data.chain_stats.spent_txo_sum
      ) / 1e8;
    return balanceInBTC;
  } catch (err) {
    console.error("BTC Fetch Error:", err.message);
    return 0;
  }
}

// === Get Prices (USD) ===
async function fetchCryptoPrices() {
  try {
    const res = await axios.get(
      `${COINGECKO_API}?ids=bitcoin,ethereum,tether&vs_currencies=usd`
    );
    return {
      BTC: res.data.bitcoin.usd,
      ETH: res.data.ethereum.usd,
      USDT: res.data.tether.usd,
    };
  } catch (err) {
    console.error("Price Fetch Error:", err.message);
    return { BTC: 0, ETH: 0, USDT: 0 };
  }
}

// === 🧮 Total Wallet Value in USD ===
async function fetchTotalWalletBalance({ ethAddress, btcAddress }) {
  const [eth, usdt, btc, prices] = await Promise.all([
    fetchEthereumBalance(ethAddress),
    fetchUSDTBalance(ethAddress),
    fetchBitcoinBalance(btcAddress),
    fetchCryptoPrices(),
  ]);

  const totalUSD = eth * prices.ETH + usdt * prices.USDT + btc * prices.BTC;

  return {
    currency: "USD",
    amount: totalUSD,
    breakdown: {
      ETH: { amount: eth, usd: eth * prices.ETH },
      USDT: { amount: usdt, usd: usdt * prices.USDT },
      BTC: { amount: btc, usd: btc * prices.BTC },
    },
  };
}

(async () => {
  const balance = await fetchTotalWalletBalance({
    ethAddress: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    btcAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  });

  console.log("Total Wallet Balance in USD:", balance);
})();

module.exports = {
  fetchTotalWalletBalance,
};
