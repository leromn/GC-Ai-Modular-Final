const admin = require("firebase-admin");
// const fs = require("fs");
// const path = require("path");
require("dotenv").config();

// const serviceAccountPath = path.resolve(__dirname, "serviceAccountKey.json");
// const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });

  console.log("firebase connected from ENV successfully");
}

const db = admin.firestore();

module.exports = db;
