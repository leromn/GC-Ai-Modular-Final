const {
  fetchEthereumTransactions,
  fetchUSDTTransactions,
  fetchBitcoinTransactions,
} = require("./fetchers/walletFetcher");

const {
  normalizeEthereumTransactions,
  normalizeUSDTTransactions,
  normalizeBitcoinTransactions,
} = require("./normalizers/walletNormalizer");

async function main() {
  // Replace these with actual wallet addresses
  const ethAddress = "0x00000000219ab540356cBB839Cbe05303d7705Fa"; //first chain both usdt and eth
  //  "0x00000000219ab540356cBB839Cbe05303d7705Fa"
  const btcAddress = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"; //satoshi wallet

  try {
    // === Ethereum (Native ETH) ===
    const ethTxs = await fetchEthereumTransactions(ethAddress);
    const normalizedEthTxs = normalizeEthereumTransactions(ethTxs, ethAddress);
    console.log("✅ Ethereum Transactions:");
    console.log(normalizedEthTxs);

    // === Ethereum USDT (ERC-20) ===
    const usdtTxs = await fetchUSDTTransactions(ethAddress);
    const normalizedUsdtTxs = normalizeUSDTTransactions(usdtTxs, ethAddress);
    console.log("\n✅ USDT Transactions:");
    console.log(normalizedUsdtTxs);

    // === Bitcoin ===
    const btcTxs = await fetchBitcoinTransactions(btcAddress);

    const normalizedBtcTxs = normalizeBitcoinTransactions(btcTxs, btcAddress);
    console.log("\n✅ Bitcoin Transactions:");
    console.log(normalizedBtcTxs);
  } catch (error) {
    console.error(
      "❌ Error fetching or normalizing transactions:",
      error.message
    );
  }
}

main();
