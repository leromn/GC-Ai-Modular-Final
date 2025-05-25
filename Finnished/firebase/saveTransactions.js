const db = require("./firebaseClient");

// Save an array of transactions under a user document
async function saveTransactionsForUser(userId, transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    console.warn("⚠️ No transactions to save.");
    return;
  }

  const userRef = db.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({ createdAt: new Date().toISOString() });
      console.log(`✅ Created user document for '${userId}'`);
    }

    const batch = db.batch();

    transactions.forEach((tx) => {
      const txRef = userRef.collection("transactions").doc(); // Auto-ID
      batch.set(txRef, {
        ...tx,
        savedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
    console.log(`✅ Saved ${transactions.length} transactions for ${userId}`);
  } catch (err) {
    console.error("❌ Error saving transactions:", err.message);
  }
}

module.exports = {
  saveTransactionsForUser,
};
