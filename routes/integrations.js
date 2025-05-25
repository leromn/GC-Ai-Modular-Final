const express = require("express");
const router = express.Router();
const { getIntegrations, updateIntegration } = require("../controllers/integrations");

router.get("/", getIntegrations);
router.post("/", updateIntegration);

module.exports = router;
