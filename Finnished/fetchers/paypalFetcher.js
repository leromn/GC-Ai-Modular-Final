// const PAYPAL_CLIENT_ID =
//   "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE";
// const PAYPAL_CLIENT_SECRET =
//   "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH";

// services/paypalFetcher.js
const axios = require("axios");
const BASE_URL = "https://api-m.sandbox.paypal.com"; // Or https://api-m.paypal.com for live

// Removed hardcoded PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET

async function getAccessToken(credentials) {
  // Accept credentials
  const { clientId, clientSecret } = credentials;
  if (!clientId || !clientSecret) {
    console.error(
      "❌ PayPal Auth Error: Missing clientId or clientSecret in credentials."
    );
    throw new Error(
      "PayPal client ID or secret not provided for authentication."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    console.log("✅ PayPal access token acquired");
    return response.data.access_token;
  } catch (err) {
    console.error("❌ PayPal Auth Error:", err.response?.data || err.message);
    // It's good to throw a more specific error or let the original error propagate
    throw new Error(
      `PayPal authentication failed: ${
        err.response?.data?.error_description || err.message
      }`
    );
  }
}

// Utility to format date in the required format
function toPayPalDate(date) {
  // Ensure date is a valid Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error("toPayPalDate: Invalid date provided", date);
    // Fallback or throw error, here returning current date as a very rough fallback
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Modified to accept credentials, startDate, endDate
async function fetchPayPalTransactions(credentials, startDate, endDate) {
  if (!credentials) {
    console.error(
      "❌ fetchPayPalTransactions Error: Credentials not provided."
    );
    throw new Error("PayPal credentials are required.");
  }
  if (!startDate || !endDate) {
    console.error(
      "❌ fetchPayPalTransactions Error: startDate or endDate not provided."
    );
    throw new Error(
      "Start date and end date are required for fetching PayPal transactions."
    );
  }

  const accessToken = await getAccessToken(credentials);

  const formattedStart = toPayPalDate(startDate);
  const formattedEnd = toPayPalDate(endDate);

  console.log(
    "📅 Fetching PayPal transactions from",
    formattedStart,
    "to",
    formattedEnd
  );

  try {
    const response = await axios.get(`${BASE_URL}/v1/reporting/transactions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      params: {
        start_date: formattedStart,
        end_date: formattedEnd,
        fields: "all", // "transaction_info,payer_info,shipping_info,auction_info,cart_info,incentive_info,store_info"
        page_size: 100, // Max 500
        // consider 'balance_affecting_records_only': true if you only want those
      },
    });

    console.log(
      "✅ PayPal transactions fetched:",
      response.data.transaction_details?.length || 0
    );
    return response.data.transaction_details || [];
  } catch (err) {
    console.error("❌ PayPal Fetch Error:", err.response?.data || err.message);
    // Propagate the error so the calling function can handle it
    throw err;
  }
}

module.exports = {
  fetchPayPalTransactions,
  // getAccessToken could be exported if needed elsewhere, but typically internal
};
