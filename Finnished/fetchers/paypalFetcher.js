// services/paypalFetcher.js
const axios = require("axios");
const BASE_URL = "https://api-m.sandbox.paypal.com";

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

async function fetchPayPalTransactions(startDate, endDate) {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(`${BASE_URL}/v1/reporting/transactions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      params: {
        start_date: startDate,
        end_date: endDate,
        fields: "all",
      },
    });
    console.log("Paypal tx fetched");
    return response.data.transaction_details;
  } catch (err) {
    console.error("PayPal Fetch Error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  fetchPayPalTransactions,
};
