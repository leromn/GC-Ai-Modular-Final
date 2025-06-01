const express = require("express");
const router = express.Router();
const { runDailyCronForAllUsers } = require("../controllers/cron2.js");

router.get("/run-tasks", runDailyCronForAllUsers);

module.exports = router;
