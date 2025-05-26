const express = require("express");
const router = express.Router();
const { runCronJob } = require("../controllers/cron.js");

router.get("/run-tasks", runCronJob);

module.exports = router;
