// normalizers/walletNormalizers.js

function normalizeEthereumTransactions(transactions, userAddress) {
  return transactions.map((tx) => {
    const isSender = tx.from.toLowerCase() === userAddress.toLowerCase();
    return {
      txId: tx.hash,
      source: "ethereum",
      type: isSender ? "withdrawal" : "deposit",
      amount: parseFloat(tx.value) / 1e18,
      currency: "ETH",
      status: tx.isError === "0" ? "confirmed" : "failed",
      date: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      from: tx.from,
      to: tx.to,
      // raw: tx,
    };
  });
}

function normalizeUSDTTransactions(transactions = [], targetAddress) {
  return transactions.map((tx) => {
    const amount =
      parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));
    const type =
      tx.to.toLowerCase() === targetAddress.toLowerCase()
        ? "deposit"
        : "withdrawal";

    let date;
    try {
      date = new Date(parseInt(tx.timeStamp) * 1000).toISOString();
    } catch (err) {
      console.error("Invalid timestamp for tx:", tx.hash, tx.timeStamp);
      date = null;
    }

    return {
      txId: tx.hash,
      source: "ethereum",
      type,
      amount,
      currency: tx.tokenSymbol,
      status: "confirmed",
      date,
      from: tx.from,
      to: tx.to,
      // raw: tx,
    };
  });
}

function normalizeBitcoinTransactions(transactions, userAddress) {
  const results = [];

  transactions.forEach((tx) => {
    let type = null;
    let amount = 0;

    const vin = tx.vin || [];
    const vout = tx.vout || [];

    const isSender = vin.some(
      (input) =>
        input.prevout && input.prevout.scriptpubkey_address === userAddress
    );
    const isReceiver = vout.some(
      (output) => output.scriptpubkey_address === userAddress
    );

    if (isSender && !isReceiver) {
      type = "withdrawal";
      amount = vin
        .filter(
          (input) =>
            input.prevout && input.prevout.scriptpubkey_address === userAddress
        )
        .reduce((acc, input) => acc + input.prevout.value, 0);
    } else if (isReceiver && !isSender) {
      type = "deposit";
      amount = vout
        .filter((output) => output.scriptpubkey_address === userAddress)
        .reduce((acc, output) => acc + output.value, 0);
    } else {
      return; // Skip internal or ambiguous txs
    }

    results.push({
      txId: tx.txid,
      source: "bitcoin",
      type,
      amount: amount / 1e8,
      currency: "BTC",
      status: "confirmed",
      date: new Date(tx.status.block_time * 1000).toISOString(),
      from: vin.map((v) => v.prevout?.scriptpubkey_address).join(", "),
      to: vout.map((v) => v.scriptpubkey_address).join(", "),
      // raw: tx,
    });
  });

  return results;
}

module.exports = {
  normalizeEthereumTransactions,
  normalizeUSDTTransactions,
  normalizeBitcoinTransactions,
};
