// utils/encryption.js
const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
// IMPORTANT: Ensure ENCRYPTION_SECRET is set in your environment for production.
// The default key is for development/testing only and should be changed.
const SECRET_KEY_FROM_ENV = process.env.ENCRYPTION_SECRET;
const DEFAULT_SECRET_KEY = "!23456789oabcdef123456789oabcdef"; // 32 chars

// Use environment variable if available, otherwise use default (log a warning for default)
let secretKeyToUse;
if (SECRET_KEY_FROM_ENV && SECRET_KEY_FROM_ENV.length === 32) {
  secretKeyToUse = SECRET_KEY_FROM_ENV;
} else {
  if (SECRET_KEY_FROM_ENV) {
    console.warn(
      "ENCRYPTION_SECRET from env is not 32 characters long. Using default secret key. THIS IS INSECURE FOR PRODUCTION."
    );
  } else {
    console.warn(
      "ENCRYPTION_SECRET environment variable not set. Using default secret key. THIS IS INSECURE FOR PRODUCTION."
    );
  }
  secretKeyToUse = DEFAULT_SECRET_KEY;
}

const IV_LENGTH = 16;

// Encrypt a string (You provided this, keeping it for completeness if you need it server-side too)
function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(secretKeyToUse),
      iv
    );
    let encrypted = cipher.update(text, "utf8", "hex"); // Specify input encoding
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw error; // Re-throw or handle appropriately
  }
}

// Decrypt a string
function decrypt(encryptedText) {
  if (
    !encryptedText ||
    typeof encryptedText !== "string" ||
    !encryptedText.includes(":")
  ) {
    console.error(
      "decrypt: Invalid encryptedText format. Expected 'iv:encryptedData'. Received:",
      encryptedText
    );
    return null; // Or throw error
  }
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      console.error(
        "decrypt: Invalid encryptedText format. Splitting by ':' did not yield 2 parts."
      );
      return null;
    }
    const ivHex = parts[0];
    const encryptedHex = parts[1];

    const iv = Buffer.from(ivHex, "hex");
    // Ensure IV is correct length
    if (iv.length !== IV_LENGTH) {
      console.error(
        `decrypt: Invalid IV length. Expected ${IV_LENGTH}, got ${iv.length}`
      );
      return null;
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(secretKeyToUse), // Use the determined secret key
      iv
    );
    let decrypted = decipher.update(encryptedHex, "hex", "utf8"); // Specify output encoding
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error(
      "Decryption failed for text:",
      encryptedText,
      "Error:",
      error.message
    );
    return null; // Return null on failure to allow graceful handling
  }
}

module.exports = { encrypt, decrypt }; // Exporting decrypt which is primarily needed by cron
