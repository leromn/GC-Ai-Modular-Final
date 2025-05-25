const express = require("express");
const router = express.Router();
const { getAnalysis } = require("../controllers/integrations");

router.get("/", getAnalysis);
router.get("/export", exportToCSV);

module.exports = router;
