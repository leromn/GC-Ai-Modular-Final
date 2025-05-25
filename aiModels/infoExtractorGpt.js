const axios = require("axios");

const OPENAI_API_KEY =
  "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"; // Replace with your actual API key
const API_URL = "https://api.openai.com/v1/chat/completions";

const categoriesList = [
  "Income",
  "Housing",
  "Food",
  "Transportation",
  "Healthcare",
  "Insurance",
  "Debt Payment",
  "Savings",
  "Entertainment",
  "Miscellaneous",
];

async function extractInvoiceInfo(owner, invoiceText = sampleInvoiceText) {
  const prompt = `
You are a data extractor. From the following text, extract these fields:

- Payment Date only (return as transDate variable exactly as it is written on the input select the date only)
- Account Holder (return as transOwner variable)
- bank name(return as bankName variable)
- Total Amount(number only) (return as "transAmount" variable)
- IBAN (if available) (return as IBAN variable)
- Country (return as country variable)
-transaction reason (is available) (return as reason variable)
- is it "income" or "expense" for the account holder (return as cashflow variable)
- does the account holder name exactly match ${owner} ? (return as isMine variable)
- Category (choose ONLY from this list: ${categoriesList.join(
    ", "
  )}) (return as category variable)

Return the result as valid JSON only.

---
${invoiceText}
---
`;

  const start = Date.now();

  try {
    const response = await axios
      .post(
        API_URL,
        {
          model: "gpt-4o-mini", // Or "gpt-4" if you have access
          messages: [
            {
              role: "system",
              content:
                "You are a professional invoice data extractor. Always return only clean, valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
      .then(console.log("gpt working"));
    // console.log(response.data.choices[0]);
    console.log(invoiceText);

    const duration = ((Date.now() - start) / 1000).toFixed(2);

    const extractedText = response.data.choices[0].message.content.trim();

    const cleanedText = extractedText.replace(/```json|```/g, "").trim();

    const extractedJson = JSON.parse(cleanedText);
    console.log("\n📤 Extracted Invoice Info:\n");
    console.log(extractedJson.transAmount);
    console.log(`\n⏱️ Took: ${duration} seconds`);

    return extractedJson;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// 🧪 Example usage
const sampleInvoiceText = `Commercial Bank of Ethiopia
VAT Invoice / Customer Receipt
Customer Name:
ERMIAS ASSEFA TIBEBU
Payment / Transaction Information
Payer ERMIAS ASSEFA TIBEBU
Account 1****8778
Receiver ESRAEL ASEFFA HUNDE
Account 1****2362
Payment Date & Time 4/10/2025, 12:50:00 PM
Transferred Amount 105.00 ETB
Country: Ethiopia
`;

// extractInvoiceInfo("ERMIAS ASSEFA TIBEBU", sampleInvoiceText);

// 📤 Export it so you can use in other files
module.exports = { extractInvoiceInfo };
