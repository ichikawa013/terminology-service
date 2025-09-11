// middleware/getToken.js
import fetch from "node-fetch";
import 'dotenv/config';

const apiKey = process.env.FIREBASE_WEB_API_KEY; // 👈 from Firebase project settings
const email = "doctor@example.com";         // 👈 must exist in Firebase Auth
const password = "123456";            // 👈 exact password you set

async function getToken() {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await res.json();
    console.log("Firebase Response:", data);

    if (data.idToken) {
      console.log("\n✅ ID Token:", data.idToken);
    } else {
      console.error("\n❌ Failed to get ID Token. Check error above.");
    }
  } catch (err) {
    console.error("Request failed:", err);
  }
}

getToken();
