const express = require("express");
const router = express.Router();
const {
  getIntegrations,
  updateIntegration,
} = require("../controllers/integrations");
const authenticate = require("../middleware/firebaseAuth");

// router.get("/", authenticate, getIntegrations);
router.post("/", authenticate, updateIntegration);

module.exports = router;
