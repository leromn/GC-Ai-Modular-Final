const express = require("express");
const router = express.Router();
const { getUserTransactions, addTransaction } = require("../controllers/transactions");

router.get("/", getUserTransactions);
router.post("/", addTransaction);

module.exports = router;
