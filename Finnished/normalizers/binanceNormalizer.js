// binanceNormalizer.js
function normalizeBinanceTransactions({ deposits = [], withdrawals = [] }) {
  const normalized = [];

  deposits.forEach((tx) => {
    normalized.push({
      txId: tx.txId || null,
      source: "binance",
      type: "deposit",
      amount: parseFloat(tx.amount),
      currency: tx.coin,
      status: tx.status === 1 ? "completed" : "pending",
      date: new Date(tx.insertTime).toISOString(),
      from: tx.address || "unknown",
      to: "binance",
      // raw: tx,
    });
  });

  withdrawals.forEach((tx) => {
    normalized.push({
      txId: tx.id || null,
      source: "binance",
      type: "withdrawal",
      amount: parseFloat(tx.amount),
      currency: tx.coin,
      status: tx.status === 6 ? "completed" : "pending",
      date: new Date(tx.applyTime).toISOString(),
      from: "binance",
      to: tx.address || "unknown",
      // raw: tx,
    });
  });

  return normalized;
}

module.exports = {
  normalizeBinanceTransactions,
};
