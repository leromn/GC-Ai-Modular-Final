const db = require("../Finnished/firebase/firebaseClient");

// GET /transactions - Fetch all transactions for the authenticated user
async function getUserTransactions(req, res) {
  try {
    // const userId = req.user.uid; // Assuming Firebase Auth middleware attaches this
    const userId="k3LLnHvMbjgGlSxtzLXl9MjB63y1";
    const transactionsRef = db.collection("users").doc(userId).collection("transactions");
    const snapshot = await transactionsRef.orderBy("savedAt", "desc").get();

    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ transactions });
  } catch (err) {
    console.error("❌ Error fetching transactions:", err.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

// POST /transactions - Add a new transaction for the user
async function addTransaction(req, res) {
  try {
    const userId = req.user.uid;
    const txData = req.body;

    const txRef = db
      .collection("users")
      .doc(userId)
      .collection("transactions")
      .doc();

    await txRef.set({
      ...txData,
      savedAt: new Date().toISOString(),
    });

    res.status(201).json({ message: "Transaction added", id: txRef.id });
  } catch (err) {
    console.error("❌ Error adding transaction:", err.message);
    res.status(500).json({ error: "Failed to add transaction" });
  }
}

module.exports = {
  getUserTransactions,
  addTransaction,
};
