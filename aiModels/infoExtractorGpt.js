const axios = require("axios");

const OPENAI_API_KEY =
  "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"; // Replace with your actual API key
const API_URL = "https://api.openai.com/v1/chat/completions";

const categoriesList = [
  "Income",
  "Housing & Utilities",
  "Food & Groceries",
  "Transportation",
  "Healthcare",
  "Shopping & Entertainment",
  "Transfers & Payments",
  "Other Expenses",
];

async function extractInvoiceInfo(owner, invoiceText) {
  const prompt = `
You are a data extractor. From the following text, extract these fields:

- Payment Date only (return as transDate variable exactly as it is written on the input select the date only)
- Account Holder (return as transOwner variable)
- bank name(return as bankName variable)
- Total Amount(number only) (return as "transAmount" variable)
-transaction reason Type of service (return as reason variable)
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
    // console.log(invoiceText);

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
const sampleInvoiceText1 = `Commercial Bank of Ethiopia
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
const sampleInvoiceText = `Commercial Bank of Ethiopia
VAT Invoice / Customer Receipt 
Company Address & Other Information
Country:
City:
Address:
Postal code:
SWIFT Code::
Email:
Tel:
Fax:
Tin:
VAT Receipt No:
VAT Registration No:
VAT Registration Date:
Ethiopia
Addis Ababa
Ras Desta Damtew St, 01, Kirkos
255
CBETETAA
info@cbe.com.et
251-551-50-04
251-551-45-22
0000006966
FT25143S3K98
011140
01/01/2003
Customer Information
Customer Name:
Region:
City:
Sub City:
Wereda/Kebele:
VAT Registration No:
VAT Registration Date:
TIN (TAX ID):
Branch:
ESRAEL ASEFFA HUNDE
LOME
_
_
_
20210102
_
DIRE FOKA BRANCH
Payment / Transaction Information
Payer
ESRAEL ASEFFA HUNDE
Account
Receiver
Account
Payment Date & Time
Reference No. (VAT Invoice No)
Reason / Type of service
Transferred Amount
1****2362
EYOBE TSEGAYE SIELE
1****3291
5/22/2025, 9:08:00 PM
FT25143S3K98
Food done via Mobile
500.00 ETB
Commission or Service Charge
0.00 ETB
15% VAT on Commission
0.00 ETB
Total amount debited from customers account
500.00 ETB
Amount in Word
ETB  Five Hundred & Zero cent
`;
// Assuming extractInvoiceInfo and sampleInvoiceText are defined above this block

// if (require.main === module) {
//   // Define and immediately invoke the async function
//   (async () => {
//     try {
//       // It's good practice to wrap async operations in try...catch
//       console.log(
//         await extractInvoiceInfo("ERMIAS ASSEFA TIBEBU", sampleInvoiceText)
//       );
//       console.log("--- Test execution finished ---");
//     } catch (error) {
//       console.error("--- Test execution failed ---");
//       console.error("Error during test execution:", error);
//     }
//   })(); // <--- Add () here to call the function
// }

// 📤 Export it so you can use in other files
module.exports = { extractInvoiceInfo };
