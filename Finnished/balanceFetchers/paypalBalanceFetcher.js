// balanceFetchers/paypalBalanceFetcher.js
const axios = require("axios");

const BASE_URL = "https://api-m.sandbox.paypal.com"; // Change to live if needed

// Removed hardcoded PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET

// Modified to accept credentials
async function getAccessToken(credentials) {
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
    console.log("✅ PayPal access token acquired for balance check");
    return response.data.access_token;
  } catch (err) {
    console.error(
      "❌ PayPal Auth Error (for balance):",
      err.response?.data || err.message
    );
    throw new Error(
      `PayPal authentication failed (for balance): ${
        err.response?.data?.error_description || err.message
      }`
    );
  }
}

// Modified to accept credentials
// This function should return an array of balance objects, e.g., [{ currency: 'USD', amount: 123.45, source: 'paypal' }]
// or a single object if only one currency is expected. The cron job handles both cases.
async function fetchPayPalBalance(credentials) {
  if (!credentials) {
    console.error("❌ fetchPayPalBalance Error: Credentials not provided.");
    return null; // Or an empty array if multiple balances could be returned
  }

  const accessToken = await getAccessToken(credentials);

  try {
    const response = await axios.get(`${BASE_URL}/v1/reporting/balances`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      // Optional params: as_of_time (ISO 8601), currency_code
    });

    const allPayPalBalances = response.data.balances || [];
    const processedBalances = [];

    if (allPayPalBalances.length > 0) {
      allPayPalBalances.forEach((bal) => {
        if (bal.total_balance && bal.total_balance.value && bal.currency) {
          processedBalances.push({
            currency: bal.currency, // e.g., "USD", "EUR"
            amount: parseFloat(bal.total_balance.value),
            source: "paypal", // Added for consistency with how cron job processes
          });
        }
      });
      console.log(
        `✅ PayPal balances fetched: ${processedBalances.length} currency account(s).`
      );
      // If you strictly only care about USD and expect only one primary balance:
      // const usdBalance = processedBalances.find(b => b.currency === "USD");
      // return usdBalance || { currency: "USD", amount: 0, source: 'paypal' };
      // For flexibility, returning all fetched currency balances:
      return processedBalances.length > 0 ? processedBalances : null; // Return null if no processable balances
    } else {
      console.log("ℹ️ No PayPal balances found or returned by API.");
      return null; // Or an empty array
    }
  } catch (err) {
    console.error(
      "❌ PayPal Balance Fetch Error:",
      err.response?.data || err.message
    );
    throw err; // Propagate error
  }
}

module.exports = {
  fetchPayPalBalance,
};
