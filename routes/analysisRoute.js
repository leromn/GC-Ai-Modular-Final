const express = require("express");
const router = express.Router();
const { analyzeFinancialData } = require("../controllers/analysisController");

// POST /api/analyze
router.post("/", analyzeFinancialData);

// GET request: http://localhost:5000/api/extract-html?siteUrl=https://example.com
// https://h8thrv-5000.csb.app/api/analyze/extract-html?siteUrl=https://apps.cbe.com.et:100/?id=FT25100G65ZX56992362


module.exports = router;
