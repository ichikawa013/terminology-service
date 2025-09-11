// middleware/firebaseStore.js
import admin from "./firebase.js";

const db = admin.firestore();

/**
 * Save encounter (timeline entry) for a patient
 * @param {string} patientId 
 * @param {object} encounter 
 * @param {object} patientInfo - { name, age, gender }
 */
export async function saveTimelineEntry(patientId, encounter, patientInfo = {}) {
  if (!patientId || !encounter.encounterId) {
    throw new Error("Missing patientId or encounterId");
  }

  const ref = db
    .collection("patients")
    .doc(patientId)
    .collection("timeline")
    .doc(encounter.encounterId);

  const data = {
    ...encounter,
    patient: patientInfo, // store patient info
    timestamp: new Date().toISOString(), // server timestamp
  };

  await ref.set(data, { merge: true });
  return { success: true, data };
}

/**
 * Get all timeline entries for a patient
 * @param {string} patientId 
 */
export async function getTimeline(patientId) {
  const ref = db.collection("patients").doc(patientId).collection("timeline");
  const snapshot = await ref.orderBy("timestamp", "desc").get();

  const entries = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return entries;
}
