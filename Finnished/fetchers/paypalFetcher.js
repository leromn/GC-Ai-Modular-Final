// const PAYPAL_CLIENT_ID =
//   "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE";
// const PAYPAL_CLIENT_SECRET =
//   "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH";
// services/paypalFetcher.js
const axios = require("axios");
const BASE_URL = "https://api-m.sandbox.paypal.com"; // Or https://api-m.paypal.com for live

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
    // console.log("✅ PayPal access token acquired"); // Keep logging minimal for main functions
    return response.data.access_token;
  } catch (err) {
    console.error("❌ PayPal Auth Error:", err.response?.data || err.message);
    throw new Error(
      `PayPal authentication failed: ${
        err.response?.data?.error_description || err.message
      }`
    );
  }
}

function toPayPalDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error("toPayPalDate: Invalid date provided", date);
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

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
    `📅 Fetching PayPal transactions from ${formattedStart} to ${formattedEnd}`
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
        fields: "all",
        page_size: 100, // For testing, you might reduce this to see pagination sooner e.g., 5
      },
    });

    console.log("📄 PayPal API Response Info:");
    console.log(response.data);
    console.log("   Total Items:", response.data.total_items);
    console.log("   Total Pages:", response.data.total_pages);
    console.log(
      "   Transactions on this page:",
      response.data.transaction_details?.length || 0
    );
    if (response.data.links) {
      const nextLink = response.data.links.find((link) => link.rel === "next");
      if (nextLink) {
        console.log("   Next page available:", nextLink.href);
      } else {
        console.log("   No next page available.");
      }
    }

    return response.data.transaction_details || [];
  } catch (err) {
    console.error(
      "❌ PayPal Fetch Error:",
      err.response?.data || err.message,
      err.stack
    );
    throw err;
  }
}

module.exports = {
  fetchPayPalTransactions,
};

// === TEST FUNCTION BLOCK ===
async function testFetchWideRange() {
  console.log("\n--- Running PayPal Fetcher Wide Range Test ---");

  // --- !!! MANUALLY PUT YOUR SANDBOX KEYS HERE FOR THIS TEST !!! ---
  const TEST_PAYPAL_CLIENT_ID =
    "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE"; // Replace with your actual Sandbox Client ID
  const TEST_PAYPAL_CLIENT_SECRET =
    "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH"; // Replace with your actual Sandbox Client Secret
  // --- !!! MANUALLY PUT YOUR SANDBOX KEYS HERE FOR THIS TEST !!! ---

  if (
    !TEST_PAYPAL_CLIENT_ID ||
    !TEST_PAYPAL_CLIENT_SECRET ||
    TEST_PAYPAL_CLIENT_ID === "YOUR_SANDBOX_CLIENT_ID"
  ) {
    console.error(
      "❌ TEST ERROR: Please update TEST_PAYPAL_CLIENT_ID and TEST_PAYPAL_CLIENT_SECRET in the testFetchWideRange function."
    );
    return;
  }

  const testCredentials = {
    clientId: TEST_PAYPAL_CLIENT_ID,
    clientSecret: TEST_PAYPAL_CLIENT_SECRET,
  };

  // Define a wide date range for testing (e.g., last 60 days)
  const testEndDate = new Date(); // Today, up to current time
  testEndDate.setHours(23, 59, 59, 999); // End of today

  const testStartDate = new Date();
  testStartDate.setDate(testEndDate.getDate() - 30); // Go back 59 days to get 60 full days (today inclusive)
  testStartDate.setHours(0, 0, 0, 0); // Start of that day

  console.log(
    `[TEST] Using Client ID: ${testCredentials.clientId.substring(0, 10)}...`
  );
  console.log(
    `[TEST] Fetching for date range: ${testStartDate.toISOString()} to ${testEndDate.toISOString()}`
  );

  try {
    const transactions = await fetchPayPalTransactions(
      testCredentials,
      testStartDate,
      testEndDate
    );

    if (transactions.length > 0) {
      console.log(
        `\n[TEST] ✅ Successfully fetched ${transactions.length} transactions.`
      );
      console.log("[TEST] First few transactions (if any):");
      transactions.slice(0, 3).forEach((tx, index) => {
        console.log(`--- TX ${index + 1} ---`);
        console.log("  ID:", tx.transaction_info?.transaction_id);
        console.log(
          "  Date:",
          tx.transaction_info?.transaction_initiation_date
        );
        console.log("  Status:", tx.transaction_info?.transaction_status);
        console.log(
          "  Amount:",
          tx.transaction_info?.transaction_amount?.value,
          tx.transaction_info?.transaction_amount?.currency_code
        );
        console.log(
          "  Payer:",
          tx.payer_info?.email_address ||
            tx.payer_info?.payer_name?.alternate_full_name
        );
        // console.log(JSON.stringify(tx, null, 2)); // For full details of first few
      });
    } else {
      console.log(
        "\n[TEST] ℹ️ No transactions fetched for the wide date range."
      );
    }
  } catch (error) {
    console.error("\n[TEST] ❌ Test failed with an error:", error.message);
    if (error.response && error.response.data) {
      // console.error("[TEST] PayPal API Error Response:", JSON.stringify(error.response.data, null, 2));
    }
  }
  console.log("--- PayPal Fetcher Wide Range Test Completed ---");
}

// This block will only run if the script is executed directly: `node path/to/paypalFetcher.js`
if (require.main === module) {
  testFetchWideRange();
}
