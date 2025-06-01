const express = require("express");
const router = express.Router();
const { exportUserTransactions } = require("../controllers/exportController"); // Adjust path
const authenticate = require("../middleware/firebaseAuth");

// Example:
// router.get('/export/transactions', yourAuthMiddleware, exportUserTransactions); // With auth
router.get("/transactions", authenticate, exportUserTransactions); // For testing (ensure you pass testUserId in query)

// app.use('/api', router);
module.exports = router;
