const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const ExcelJS = require("exceljs");
const Tesseract = require("tesseract.js");
const fileType = require("file-type");
const https = require("https");

// Helpers (unchanged)
async function extractTextFromImage(buffer) {
  const {
    data: { text },
  } = await Tesseract.recognize(buffer, "eng");
  return text;
}

async function extractTextFromPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromWord(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function extractTextFromExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  let text = "";
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      text += row.values.slice(1).join(" ") + "\n";
    });
  });
  return text;
}

async function extractTextFromBuffer(buffer) {
  const type = await fileType.fromBuffer(buffer);
  if (!type) throw new Error("Unable to determine file type.");

  switch (type.mime) {
    case "application/pdf":
      console.log("pdf recieved");
      return await extractTextFromPDF(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      console.log("word recieved");
      return await extractTextFromWord(buffer);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      console.log("Excel recieved");
      return await extractTextFromExcel(buffer);
    case "image/png":
    case "image/jpeg":
      console.log("image recieved");
      return await extractTextFromImage(buffer);
    default:
      throw new Error(`Unsupported file type: ${type.mime}`);
  }
}

// Extracts visible text from HTML body
async function extractHTMLText(url, httpsAgent) {
  // const httpsAgent = new https.Agent({ rejectUnauthorized: false });
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

// This is the main function. It only processes files or URLs
async function extractTextFromInput({ file, fileUrl }) {
  let buffer;
  let rawText;

  if (file) {
    console.log("File");
    buffer = file.data;
    rawText = await extractTextFromBuffer(buffer);
  } else if (fileUrl) {
    console.log("url");
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const { hostname } = new URL(fileUrl);

    // Handle PDF download from CBE
    if (hostname.includes("apps.cbe.com.et")) {
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
        httpsAgent,
      });
      buffer = Buffer.from(response.data);
      rawText = await extractTextFromBuffer(buffer);
    }

    // Handle HTML text extraction from Awash
    if (hostname.includes("awashpay.awashbank.com")) {
      rawText = await extractHTMLText(siteUrl, httpsAgent);
    }
  } else {
    throw new Error("No file or URL provided.");
    //fix this to reenter the field
  }

  return rawText;
}

module.exports = {
  extractTextFromInput,
};
