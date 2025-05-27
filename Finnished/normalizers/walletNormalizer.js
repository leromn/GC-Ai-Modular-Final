// normalizers/walletNormalizer.js

function normalizeEthereumTransactions(transactions, userAddress) {
  if (!Array.isArray(transactions) || !userAddress) return [];
  return transactions
    .map((tx) => {
      const isSender = tx.from.toLowerCase() === userAddress.toLowerCase();
      return {
        txId: tx.hash,
        source: "ethereum",
        asset: "ETH",
        type: isSender ? "withdrawal" : "deposit",
        amount: parseFloat(tx.value) / 1e18,
        currency: "ETH",
        status: tx.isError === "0" ? "confirmed" : "failed",
        date: tx.timeStamp
          ? new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString()
          : null,
        fromAddress: tx.from,
        toAddress: tx.to,
        fee:
          tx.gasUsed && tx.gasPrice
            ? (parseInt(tx.gasUsed, 10) * parseInt(tx.gasPrice, 10)) / 1e18
            : undefined,
        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 10) : null,
      };
    })
    .filter((tx) => tx.amount > 0);
}

function normalizeUSDTTransactions(transactions = [], targetAddress) {
  if (!Array.isArray(transactions) || !targetAddress) return [];
  return transactions
    .map((tx) => {
      const tokenDecimal = parseInt(tx.tokenDecimal, 10);
      if (isNaN(tokenDecimal) || tokenDecimal <= 0) {
        console.warn(
          `Invalid tokenDecimal for USDT tx ${tx.hash}: ${tx.tokenDecimal}. Amount will be 0 or incorrect.`
        );
        // return null; // Decide if to skip or proceed with potentially incorrect amount
      }
      // Ensure tx.value is a string that can be parsed or a number
      const value =
        typeof tx.value === "string" ? parseFloat(tx.value) : tx.value;
      const amount =
        typeof value === "number" && !isNaN(value) && tokenDecimal > 0
          ? value / Math.pow(10, tokenDecimal)
          : 0; // Default to 0 if value or tokenDecimal is problematic

      const type =
        tx.to.toLowerCase() === targetAddress.toLowerCase()
          ? "deposit"
          : "withdrawal";

      let date;
      try {
        // Ensure tx.timeStamp is a string that can be parsed or a number
        const timeStamp =
          typeof tx.timeStamp === "string"
            ? parseInt(tx.timeStamp, 10)
            : tx.timeStamp;
        date =
          typeof timeStamp === "number" && !isNaN(timeStamp)
            ? new Date(timeStamp * 1000).toISOString()
            : null;
      } catch (err) {
        console.error(
          "Invalid timestamp for USDT tx:",
          tx.hash,
          tx.timeStamp,
          err
        );
        date = null;
      }

      return {
        txId: tx.hash,
        source: "ethereum_erc20",
        asset: tx.tokenSymbol || "USDT",
        type,
        amount,
        currency: tx.tokenSymbol || "USDT",
        status: "confirmed",
        date,
        fromAddress: tx.from,
        toAddress: tx.to,
        contractAddress: tx.contractAddress,
        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 10) : null,
      };
    })
    .filter((tx) => tx && tx.amount > 0);
}

function normalizeBitcoinTransactions(transactions, userAddress) {
  if (!Array.isArray(transactions) || !userAddress) return [];
  const results = [];

  transactions.forEach((tx) => {
    let type = null;
    let netAmountUser = 0;

    const vin = tx.vin || [];
    const vout = tx.vout || [];

    let totalSpentByUser = 0;
    vin.forEach((input) => {
      if (input.prevout && input.prevout.scriptpubkey_address === userAddress) {
        totalSpentByUser += input.prevout.value || 0;
      }
    });

    let totalReceivedByUser = 0;
    vout.forEach((output) => {
      if (output.scriptpubkey_address === userAddress) {
        totalReceivedByUser += output.value || 0;
      }
    });

    netAmountUser = totalReceivedByUser - totalSpentByUser;

    if (netAmountUser > 0) {
      type = "deposit";
    } else if (netAmountUser < 0) {
      type = "withdrawal";
    } else {
      return; // Skip if no net change for the user or complex tx
    }

    // === MODIFIED_START: Bitcoin Date Fix ===
    let date = null;
    if (
      tx.status &&
      tx.status.block_time &&
      !isNaN(Number(tx.status.block_time))
    ) {
      try {
        date = new Date(Number(tx.status.block_time) * 1000).toISOString();
      } catch (e) {
        console.error(
          `Error converting Bitcoin tx timestamp for ${tx.txid}: ${tx.status.block_time}`,
          e
        );
        date = null; // Fallback to null if Date conversion fails for any reason
      }
    } else {
      console.warn(
        `Missing or invalid block_time for Bitcoin tx ${tx.txid}:`,
        tx.status?.block_time
      );
    }
    // === MODIFIED_END ===

    results.push({
      txId: tx.txid,
      source: "bitcoin",
      asset: "BTC",
      type,
      amount: Math.abs(netAmountUser) / 1e8,
      currency: "BTC",
      status: tx.status && tx.status.confirmed ? "confirmed" : "pending",
      date, // Use the safely created date
      involvedAddresses: [
        ...new Set([
          ...vin.map((v) => v.prevout?.scriptpubkey_address).filter(Boolean),
          ...vout.map((v) => v.scriptpubkey_address).filter(Boolean),
        ]),
      ],
      fee: typeof tx.fee === "number" ? tx.fee / 1e8 : undefined,
      blockHeight: tx.status?.block_height
        ? parseInt(tx.status.block_height, 10)
        : null,
    });
  });

  return results;
}

module.exports = {
  normalizeEthereumTransactions,
  normalizeUSDTTransactions,
  normalizeBitcoinTransactions,
};
