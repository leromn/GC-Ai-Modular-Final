// utils/paypalNormalizer.js

function normalizePayPalTransactions(transactionList = []) {
  console.log("Paypal tx normalized");
  return transactionList.map((tx) => {
    const detail = tx.transaction_info || {};
    const payer = tx.payer_info || {};
    const receiver = tx?.transaction_info?.receiver_info || {};

    return {
      txId: detail.transaction_id || null,
      source: "paypal",
      type: determineType(detail),
      amount: parseFloat(detail.transaction_amount?.value || 0),
      currency: detail.transaction_amount?.currency_code || null,
      status: detail.transaction_status || "unknown",
      date: detail.transaction_initiation_date || null,
      from: payer.email_address || payer.account_id || "unknown",
      to: receiver.email_address || receiver.account_id || "unknown",
      balanceAfterTx: parseFloat(detail.ending_balance?.value || 0),
      balanceCurrency:
        detail.ending_balance?.currency_code ||
        detail.transaction_amount?.currency_code ||
        null,
      // raw: tx,
    };
  });
}

function determineType(detail) {
  const code = detail.transaction_event_code;
  const amount = parseFloat(detail.transaction_amount?.value || 0);

  // Basic mapping — you can expand this as needed
  if (code?.startsWith("T")) {
    if (amount > 0) return "deposit";
    if (amount < 0) return "withdrawal";
  }

  // Fallback
  return "transfer";
}

module.exports = {
  normalizePayPalTransactions,
};
