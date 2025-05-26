const db = require("../Finnished/firebase/firebaseClient");

async function runCronJob(req, res) {
  try {
    const userId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Example test user

    const notificationRef = db
      .collection("users")
      .doc(userId)
      .collection("notifications");

    const result = await notificationRef.add({
      message: "✅ Cron job executed!",
      triggeredAt: new Date().toISOString(),
    });

    console.log("✅ Cron job ran. Doc ID:", result.id);

    res.status(200).json({
      success: true,
      message: "Cron job ran and document was added.",
      docId: result.id,
    });
  } catch (error) {
    console.error("❌ Cron job error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { runCronJob };
