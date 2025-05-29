// services/notificationService.js
const db = require("../Finnished/firebase/firebaseClient"); // Adjust path as needed

/**
 * Adds a new notification for a specific user to the global notifications collection.
 *
 * @param {string} userId - The ID of the user to send the notification to.
 * @param {object} notificationData - The notification content.
 * @param {string} notificationData.title - The title of the notification.
 * @param {string} notificationData.message - The main message content.
 * @param {string} [notificationData.type='info'] - Type of notification (e.g., 'info', 'warning', 'error', 'success').
 * @param {object} [notificationData.link] - Optional link object { path: '/some/route', queryParams: { id: '123'} }
 * @param {object} [notificationData.metadata] - Any other custom metadata.
 * @returns {Promise<string|null>} The ID of the newly created notification document, or null on failure.
 */
async function createNotification(userId, notificationData) {
  if (
    !userId ||
    !notificationData ||
    !notificationData.title ||
    !notificationData.message
  ) {
    console.error(
      "❌ createNotification: userId, title, and message are required."
    );
    return null;
  }

  try {
    const notificationsCollectionRef = db.collection("allUserNotifications");

    const newNotification = {
      userId: userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || "info", // Default to 'info'
      link: notificationData.link || null, // Store as null if not provided
      metadata: notificationData.metadata || null,
      isRead: false, // Notifications start as unread
      createdAt: new Date().toISOString(),
      // You could add a 'readAt' field to be updated when the user reads it.
    };

    const docRef = await notificationsCollectionRef.add(newNotification);
    console.log(
      `✅ Notification added with ID: ${docRef.id} for user: ${userId}`
    );
    return docRef.id;
  } catch (err) {
    console.error("❌ Error adding notification:", err.message, err.stack);
    return null;
  }
}

/**
 * Fetches all notifications for a specific user from the global notifications collection.
 *
 * @param {string} userId - The ID of the user whose notifications are to be fetched.
 * @param {object} [options] - Optional query options.
 * @param {number} [options.limit=25] - Max number of notifications to fetch.
 * @param {boolean} [options.unreadOnly=false] - If true, fetches only unread notifications.
 * @returns {Promise<Array<object>>} An array of notification objects, or an empty array on failure/no notifications.
 */
async function getUserNotifications(userId, options = {}) {
  if (!userId) {
    console.error("❌ getUserNotifications: userId is required.");
    return [];
  }

  try {
    const notificationsCollectionRef = db.collection("allUserNotifications");
    let query = notificationsCollectionRef.where("userId", "==", userId);

    if (options.unreadOnly) {
      query = query.where("isRead", "==", false);
    }

    query = query.orderBy("createdAt", "desc"); // Always order by creation date

    if (
      options.limit &&
      typeof options.limit === "number" &&
      options.limit > 0
    ) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(25); // Default limit
    }

    const snapshot = await query.get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(
      `✅ Fetched ${notifications.length} notifications for user: ${userId}`
    );
    return notifications;
  } catch (err) {
    console.error(
      "❌ Error fetching notifications for user " + userId + ":",
      err.message,
      err.stack
    );
    return []; // Return empty array on error
  }
}

/**
 * Marks a specific notification as read for a user.
 *
 * @param {string} userId - The ID of the user. (Used for verification, though notificationId is primary key)
 * @param {string} notificationId - The ID of the notification to mark as read.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) {
    console.error(
      "❌ markNotificationAsRead: userId and notificationId are required."
    );
    return false;
  }
  try {
    const notificationRef = db
      .collection("allUserNotifications")
      .doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      console.warn(
        `⚠️ Notification ${notificationId} not found for marking as read.`
      );
      return false;
    }

    // Optional: Verify the notification belongs to the user trying to mark it as read
    if (notificationDoc.data().userId !== userId) {
      console.warn(
        `⚠️ User ${userId} attempted to mark notification ${notificationId} not belonging to them.`
      );
      return false; // Or throw an authorization error
    }

    await notificationRef.update({
      isRead: true,
      readAt: new Date().toISOString(), // Optional: timestamp when it was read
    });
    console.log(
      `✅ Notification ${notificationId} marked as read for user: ${userId}`
    );
    return true;
  } catch (err) {
    console.error(
      "❌ Error marking notification as read:",
      err.message,
      err.stack
    );
    return false;
  }
}

/**
 * Marks all unread notifications as read for a user.
 * @param {string} userId
 * @returns {Promise<number>} The number of notifications marked as read.
 */
async function markAllNotificationsAsRead(userId) {
  if (!userId) {
    console.error("markAllNotificationsAsRead: userId is required.");
    return 0;
  }
  try {
    const unreadNotifications = await getUserNotifications(userId, {
      unreadOnly: true,
      limit: 500,
    }); // Limit batch size

    if (unreadNotifications.length === 0) {
      console.log(
        `ℹ️ No unread notifications to mark as read for user ${userId}.`
      );
      return 0;
    }

    const batch = db.batch();
    unreadNotifications.forEach((notification) => {
      const notificationRef = db
        .collection("allUserNotifications")
        .doc(notification.id);
      batch.update(notificationRef, {
        isRead: true,
        readAt: new Date().toISOString(),
      });
    });

    await batch.commit();
    console.log(
      `✅ Marked ${unreadNotifications.length} notifications as read for user ${userId}.`
    );
    return unreadNotifications.length;
  } catch (error) {
    console.error(
      "❌ Error marking all notifications as read:",
      error.message,
      error.stack
    );
    return 0;
  }
}

// === TEST BLOCK ===
// This block will only run if the script is executed directly (e.g., `node path/to/notificationService.js`)
if (require.main === module) {
  (async () => {
    console.log("\n--- Running Notification Service Test ---");
    const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Use a consistent ID for testing

    // 1. Create a new notification
    console.log(
      `\n[TEST] Attempting to create a notification for user: ${testUserId}`
    );
    const notificationData1 = {
      title: "Test Notification Title",
      message: "This is a test message from the notification service script.",
      type: "info",
      link: { path: "/dashboard" },
      metadata: { source: "direct_script_test" },
    };
    const newNotificationId1 = await createNotification(
      testUserId,
      notificationData1
    );

    if (!newNotificationId1) {
      console.error("[TEST] Failed to create the first notification.");
      return; // Stop test if creation fails
    }

    // 2. Create another notification to test 'markAllAsRead'
    console.log(
      `\n[TEST] Attempting to create a second notification for user: ${testUserId}`
    );
    const notificationData2 = {
      title: "Another Important Update!",
      message: "Please review your account settings.",
      type: "warning",
    };
    const newNotificationId2 = await createNotification(
      testUserId,
      notificationData2
    );

    // 3. Get all notifications for the user
    console.log(`\n[TEST] Fetching all notifications for user: ${testUserId}`);
    let notifications = await getUserNotifications(testUserId, { limit: 5 });
    console.log(
      "[TEST] Fetched notifications:",
      JSON.stringify(notifications, null, 2)
    );

    // 4. Get unread notifications for the user
    console.log(
      `\n[TEST] Fetching unread notifications for user: ${testUserId}`
    );
    let unreadNotifications = await getUserNotifications(testUserId, {
      unreadOnly: true,
      limit: 5,
    });
    console.log(
      "[TEST] Fetched unread notifications:",
      JSON.stringify(unreadNotifications, null, 2)
    );

    // 5. Mark the first notification as read (if it was created)
    if (newNotificationId1) {
      console.log(
        `\n[TEST] Attempting to mark notification ${newNotificationId1} as read for user: ${testUserId}`
      );
      await markNotificationAsRead(testUserId, newNotificationId1);

      // Fetch again to see the change
      notifications = await getUserNotifications(testUserId, { limit: 5 });
      console.log(
        "[TEST] Notifications after marking one as read:",
        JSON.stringify(
          notifications.find((n) => n.id === newNotificationId1),
          null,
          2
        )
      );
    }

    // 6. Mark all (remaining) unread notifications as read
    console.log(
      `\n[TEST] Attempting to mark all unread notifications as read for user: ${testUserId}`
    );
    const markedCount = await markAllNotificationsAsRead(testUserId);
    console.log(
      `[TEST] Number of notifications marked as read in bulk: ${markedCount}`
    );

    // 7. Fetch unread notifications again (should be empty or fewer)
    console.log(
      `\n[TEST] Fetching unread notifications after markAllAsRead for user: ${testUserId}`
    );
    unreadNotifications = await getUserNotifications(testUserId, {
      unreadOnly: true,
      limit: 5,
    });
    console.log(
      "[TEST] Fetched unread notifications (should be empty or less):",
      JSON.stringify(unreadNotifications, null, 2)
    );

    console.log("\n--- Notification Service Test Completed ---");
  })().catch((err) => {
    console.error("❌ Test script failed with an error:", err);
  });
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
