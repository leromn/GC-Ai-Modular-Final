const axios = require("axios");

const BASE_URL = "https://api-m.sandbox.paypal.com"; // Change to live if needed
const PAYPAL_CLIENT_ID =
  "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE";
const PAYPAL_CLIENT_SECRET =
  "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH";

async function getAccessToken() {
  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (err) {
    console.error("PayPal Auth Error:", err.response?.data || err.message);
    throw err;
  }
}

async function fetchPayPalBalance() {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(`${BASE_URL}/v1/reporting/balances`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const balances = response.data.balances || [];
    const usdBalance = balances.find((b) => b.currency === "USD");
    console.log(usdBalance);
    return {
      currency: "USD",
      amount: parseFloat(usdBalance?.total_balance?.value || 0),
    };
  } catch (err) {
    console.error(
      "PayPal Balance Fetch Error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

async function checkBalance() {
  const balance = await fetchPayPalBalance();
  console.log("Current PayPal Balance:", balance);
}

// checkBalance();

module.exports = {
  fetchPayPalBalance,
};
