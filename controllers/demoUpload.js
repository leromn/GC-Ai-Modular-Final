const db = require("../Finnished/firebase/firebaseClient");
const { encrypt } = require("../utils/encryption");

const storeUserIntegrations = async () => {
  const userId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // Replace this with the authenticated user ID in real use
  const userRef = db.collection("users").doc(userId);

  const integrationsData = {
    paypal: {
      apiKey: encrypt(
        "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE"
      ),
      apiSecret: encrypt(
        "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH"
      ),
    },
    binance: {
      apiKey: encrypt(
        "ivsGtXBmg9zQ2ShTXKOORM6qzwdTbiswBdA5ziFyqHTrAHqYTTYy50sUMhVY8erg"
      ),
      apiSecret: encrypt(
        "wDVQVrqx0QCZLXJ5RmgauPWM47HdgbbVRj6hlKaQbAahnAu7O6PXRKYM5cyw8GlB"
      ),
    },
    wallets: {
      btc: [
        {
          address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
          platform: "satoshi Ledger",
        },
      ],
      eth: [
        {
          address: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
          platform: "MetaMask",
        },
      ],
      usdt: [
        {
          address: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
          platform: "MetaMask",
        },
      ],
    },
    banks: [
      {
        platform: "CBE",
        apiKey: encrypt("chaseApiKey123"),
        apiSecret: encrypt("oauthTokenABC"),
      },
      {
        platform: "Awash Bank",
        apiKey: encrypt("wellsApiKey456"),
        apiSecret: encrypt("oauthTokenXYZ"),
      },
    ],
  };

  try {
    await userRef.set(
      {
        integrations: integrationsData,
      },
      { merge: true }
    );

    console.log("✅ Integrations stored successfully");
  } catch (error) {
    console.error("❌ Error storing integrations:", error.message);
  }
};

storeUserIntegrations();
