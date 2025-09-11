// middleware/testFirestore.js
import { saveTimelineEntry, getTimeline } from "./firebaseStore.js";
import "dotenv/config";


async function run() {
  try {
    const patientId = "patient123"; // sample patient
    const encounter = {
      encounterId: "enc001",
      doctorId: "doctorABC",
      conditions: [
        { namaste: "AYU123", icd11: "TM2:456" },
        { namaste: "SID456", icd11: "BIO:789" },
      ],
    };

    // Save encounter
    console.log("👉 Saving encounter...");
    const saveResult = await saveTimelineEntry(patientId, encounter);
    console.log("✅ Saved:", saveResult);

    // Fetch timeline
    console.log("\n👉 Fetching timeline...");
    const timeline = await getTimeline(patientId);
    console.log("✅ Timeline:", JSON.stringify(timeline, null, 2));

  } catch (err) {
    console.error("❌ Error:", err);
  }
}

run();
