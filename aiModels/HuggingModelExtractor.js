const axios = require("axios");

const HUGGING_FACE_API_KEY = "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"; // Replace with your token
const API_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";

const headers = {
  Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
  "Content-Type": "application/json",
};

async function extractInvoiceInfo(invoiceText, owner) {
  const prompt = `
You are a data extractor. From the following text, extract these fields:

- Payment Date only
- Account Holder 
- Total Amount
- IBAN (if available)
- Country
- is it debit or credit for the account holder
- does the account holder name exactly match ${owner} ?

Return the result as valid JSON only.

---
${invoiceText}
---
`;

  const start = Date.now();

  try {
    const response = await axios.post(
      API_URL,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 300,
          return_full_text: false,
        },
      },
      { headers }
    );

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log("\n📤 Extracted Invoice Info:\n");
    console.log(response.data[0].generated_text);
    console.log(`\n⏱️ Took: ${duration} seconds`);

    return response.data[0].generated_text;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// 🧪 Example usage
var sampleInvoiceText = `Commercial Bank of Ethiopia
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
FT25100G65ZX
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
ERMIAS ASSEFA TIBEBU
AMBO.CITY
_
_
_
20220101
_
Ambo Branch
Payment / Transaction Information
Payer ERMIAS ASSEFA TIBEBU
Account 1****8778
Receiver ESRAEL ASEFFA HUNDE
Account 1****2362
Payment Date & Time 4/10/2025, 12:50:00 PM
Reference No. (VAT Invoice No) FT25100G65ZX
Reason / Type of service in done via Mobile
Transferred Amount 105.00 ETB
Commission or Service Charge 0.00 ETB
15% VAT on Commission 0.00 ETB
Total amount debited from customers account 105.00 ETB
Amount in Word ETB One Hundred Five & Zero cents

`;

sampleInvoiceText2 = `Customer receipt
Download
NARRATIVE	ATM TRANSACTION
AMOUNT	300.00
DEBIT ACCOUNT NAME	NURU HUSEN YIMAM
TRANSACTION TYPE	ATM CASH WITHDRAWAL
DEBIT ACCOUNT	1******02
TRANSACTION REFERENCE	FT25090QDFL3
TRANSACTION DATE	30/03/25 09:54
The Choice For All
Contactcenter@bankofabyssinia.com
8397 or +25115183981
Gambia St, Legehar, Addis Ababa

Swift: - ABYSETAA, Addis Ababa, Ethiopia`;

extractInvoiceInfo(sampleInvoiceText);

// Export the function to make it available in other files
module.exports = { extractInvoiceInfo };
