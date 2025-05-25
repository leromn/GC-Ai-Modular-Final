const db = require("../Finnished/firebase/firebaseClient");

// GET /notifications - Fetch all notifications for the authenticated user
async function getNotifications(req, res) {
  try {
    // const userId = req.user.uid;
    const userId="k3LLnHvMbjgGlSxtzLXl9MjB63y1";

    const notificationsRef = db
      .collection("users")
      .doc(userId)
      .collection("notifications");

    const snapshot = await notificationsRef.orderBy("createdAt", "desc").get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(notifications)
    res.status(200).json({ notifications });
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

// POST /notifications - This would be used **internally** (from backend/admin) not exposed in router
async function addNotification(userId, notification) {
  try {
    const notificationsRef = db
      .collection("users")
      .doc(userId)
      .collection("notifications");

    await notificationsRef.add({
      ...notification,
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ Notification added for user: ${userId}`);
  } catch (err) {
    console.error("❌ Error adding notification:", err.message);
  }
}

//test
// const userId="k3LLnHvMbjgGlSxtzLXl9MjB63y1";
// const testNotification = {
//   title: "🔔 Second Notification",
//   message: "This is the second notification from the backend script.",
//   type: "info", // Optional: 'info', 'warning', 'error', etc.
// };

// (async () => {
//   try {
//     await addNotification(userId, testNotification);
//     console.log("✅ Notification test completed.");
//     await getNotifications("k3LLnHvMbjgGlSxtzLXl9MjB63y1")
//   } catch (err) {
//     console.error("❌ Test failed:", err.message);
//   }
// })();

module.exports = {
  getNotifications,
  addNotification,
};
