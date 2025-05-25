const express = require("express");
const router = express.Router();
const { getUserBalance, storeDailyBalance } = require("../controllers/balance");

router.get("/", getUserBalance);


module.exports = router;
