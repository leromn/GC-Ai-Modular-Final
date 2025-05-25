const db = require("../Finnished/firebase/firebaseClient");
const { encrypt, decrypt } = require("../utils/encryption");

// GET /api/integrations
async function getIntegrations(req, res) {
  const userId = req.user.uid;

  try {
    const doc = await db.collection("users").doc(userId).get();
    const data = doc.data();

    if (!data || !data.integrations) {
      return res.status(200).json({});
    }

    const integrations = data.integrations;

    // Decrypt secrets
    if (integrations.paypal) {
      integrations.paypal.clientSecret = decrypt(
        integrations.paypal.clientSecret
      );
    }

    if (integrations.binance) {
      integrations.binance.apiSecret = decrypt(integrations.binance.apiSecret);
    }

    integrations.banks = (integrations.banks || []).map((bank) => ({
      ...bank,
      apiKey: decrypt(bank.apiKey),
      accessToken: decrypt(bank.accessToken),
    }));

    res.status(200).json(integrations);
  } catch (err) {
    console.error("❌ Error fetching integrations:", err.message);
    res.status(500).json({ error: "Failed to fetch integrations." });
  }
}

// POST /api/integrations
async function updateIntegration(req, res) {
  const userId = req.user.uid;
  const data = req.body;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const currentData = userDoc.exists ? userDoc.data() : {};

    const updates = {};

    // === PAYPAL ===
    if (data.paypal) {
      updates["integrations.paypal"] = {
        clientId: data.paypal.clientId,
        clientSecret: encrypt(data.paypal.clientSecret),
        addedAt: new Date().toISOString(),
      };
    }

    // === BINANCE ===
    if (data.binance) {
      updates["integrations.binance"] = {
        apiKey: data.binance.apiKey,
        apiSecret: encrypt(data.binance.apiSecret),
        addedAt: new Date().toISOString(),
      };
    }

    // === WALLETS (append to each coin) ===
    if (data.wallets) {
      const existingWallets = currentData?.integrations?.wallets || {};
      const mergedWallets = { ...existingWallets };

      for (const [coin, newWallets] of Object.entries(data.wallets)) {
        mergedWallets[coin] = [...(existingWallets[coin] || []), ...newWallets];
      }

      updates["integrations.wallets"] = mergedWallets;
    }

    // === BANKS (append as object entries by unique ID) ===
    if (data.banks && Array.isArray(data.banks)) {
      const existingBanks = currentData?.integrations?.banks || {};
      const mergedBanks = { ...existingBanks };

      for (const bank of data.banks) {
        const bankId =
          bank.name?.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
        mergedBanks[bankId] = {
          name: bank.name,
          apiKey: encrypt(bank.apiKey),
          accessToken: encrypt(bank.accessToken),
          addedAt: new Date().toISOString(),
        };
      }

      updates["integrations.banks"] = mergedBanks;
    }

    // === Save merged updates ===
    await userRef.set(updates, { merge: true });

    res
      .status(200)
      .json({ success: true, message: "✅ Integrations updated." });
  } catch (err) {
    console.error("❌ Error updating integrations:", err.message);
    res.status(500).json({ error: "Failed to update integrations." });
  }
}

module.exports = {
  getIntegrations,
  updateIntegration,
};
