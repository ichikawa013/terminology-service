// firebase.js
import admin from "firebase-admin";
import { readFileSync } from "fs";
import "dotenv/config";


if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var is missing!");
}

// Read service account JSON
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
