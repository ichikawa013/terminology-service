// authMiddleware.js
import admin from "./firebase.js";


export async function verifyFirebaseToken(req, reply) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing or invalid Authorization header" });
    }

    const idToken = authHeader.split(" ")[1];

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
    };
  } catch (err) {
    console.error("Firebase Auth Error:", err.message);
    return reply.code(401).send({ error: "Unauthorized" });
  }
}
