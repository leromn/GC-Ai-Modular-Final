const express = require("express");
const router = express.Router();
const { addSingleTransaction } = require("../controllers/transactions");

// router.get("/", getUserTransactions);
router.post("/", addSingleTransaction);

module.exports = router;
