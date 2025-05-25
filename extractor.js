const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Accepts links and processes based on known domains
async function processLink(siteUrl) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });

  const { hostname } = new URL(siteUrl);

  // Handle PDF download from CBE
  if (hostname.includes("apps.cbe.com.et")) {
    return await downloadPDF(siteUrl, httpsAgent);
  }

  // Handle HTML text extraction from Awash
  if (hostname.includes("awashpay.awashbank.com")) {
    return await extractHTMLText(siteUrl, httpsAgent);
  }

  // Unsupported link
  console.log("❌ Unsupported link type for now.");
  return { type: "unsupported", message: "This domain is not supported yet." };
}

// Downloads a PDF file from the given URL
async function downloadPDF(url, httpsAgent) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/pdf",
      },
    });

    const filename = `downloaded_${Date.now()}.pdf`;
    fs.writeFileSync(filename, response.data);

    console.log(`✅ PDF downloaded and saved as "${filename}"`);
    return { type: "pdf", file: filename };
  } catch (err) {
    console.error("❌ Failed to download PDF:", err.message);
    return { type: "error", error: err.message };
  }
}

// Extracts visible text from HTML body
async function extractHTMLText(url, httpsAgent) {
  try {
    const response = await axios.get(url, {
      httpsAgent,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(response.data);
    const visibleText = $("body").text().replace(/\s+/g, " ").trim();

    console.log("\n📝 Extracted Visible Text (first 500 chars):\n");
    console.log(visibleText.slice(0, 500) + "...");

    return { type: "text", text: visibleText };
  } catch (err) {
    console.error("❌ Failed to extract text:", err.message);
    return { type: "error", error: err.message };
  }
}

// const siteUrl = "https://cs.bankofabyssinia.com/slip/?trx=FT25090QDFL348902";//both dont work
// const siteUrl = "https://apps.cbe.com.et:100/?id=FT25100G65ZX56992362"; //pdf download works
// const siteUrl = "https://awashpay.awashbank.com:8225/-E3BF28E4B8C1-1B0EBQ"; //html page text extraction works

processLink(siteUrl);

module.exports = { processLink };
