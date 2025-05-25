const express = require("express");
const router = express.Router();
const { addNotification, getNotifications } = require("../controllers/notifications");

// router.post("/", addNotification); //user can not add notification from their side
router.get("/", getNotifications);

module.exports = router;
