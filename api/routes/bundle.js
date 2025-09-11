// api/routes/bundle.js
import { saveTimelineEntry } from "../../middleware/firebaseStore.js";
import { translateCode } from "../Services/translateService.js";

export default async function bundleRoutes(fastify) {
  fastify.post("/fhir/Bundle", async (req, reply) => {
    const bundle = req.body;

    // --- Validate Bundle ---
    if (!bundle || bundle.resourceType !== "Bundle") {
      return reply.code(400).send({ error: "Invalid FHIR Bundle" });
    }

    try {
      // --- Extract resources ---
      const patient = bundle.entry.find(
        (e) => e.resource.resourceType === "Patient"
      )?.resource;

      const encounter = bundle.entry.find(
        (e) => e.resource.resourceType === "Encounter"
      )?.resource;

      const conditions = bundle.entry
        .filter((e) => e.resource.resourceType === "Condition")
        .map((e) => e.resource);

      if (!patient?.id || !encounter?.id) {
        return reply.code(400).send({
          error: "Bundle must include Patient and Encounter resources",
        });
      }

      // --- Extract patient demographics ---
      const patientData = {
        id: patient.id,
        name:
          patient.name
            ?.map((n) => `${n.given?.join(" ")} ${n.family || ""}`.trim())
            .join(", ") || "Unknown",
        gender: patient.gender || "unknown",
        birthDate: patient.birthDate || null,
      };

      // --- Map NAMASTE → ICD using translateService ---
      const mappedConditions = [];

      for (const cond of conditions) {
        const namasteCoding = cond.code.coding.find((c) =>
          c.system.includes("namaste")
        );
        if (!namasteCoding) continue;

        // Translate code using all ConceptMaps
        const translated = await translateCode(
          namasteCoding.code,
          namasteCoding.system,
          "http://id.who.int/icd/release/11/mms",
          false // plain JSON, not FHIR Parameters
        );

        let icdCode = "UNMAPPED";

        if (translated?.result?.length > 0) {
          icdCode = translated.result[0].code;

          // Optional: append ICD coding for traceability
          cond.code.coding.push({
            system: "http://id.who.int/icd/release/11/mms",
            code: icdCode,
            display: translated.result[0].display,
          });
        }

        mappedConditions.push({
          namaste: namasteCoding.code,
          icd11: icdCode,
        });
      }

      // --- Build encounter object ---
      const encounterData = {
        patient: patientData, // include demographics
        encounterId: encounter.id,
        doctorId: req.user?.uid || "unknown-doctor",
        conditions: mappedConditions,
        timestamp: new Date().toISOString(),
      };

      // --- Dry run mode ---
      if (req.query.dryRun === "true") {
        console.log("🧪 Dry run – encounter parsed:", encounterData);
        return reply.send({
          dryRun: true,
          patientId: patient.id,
          encounter: encounterData,
        });
      }

      // --- Save to Firestore ---
      const saved = await saveTimelineEntry(patient.id, encounterData);
      console.log("✅ Encounter saved:", saved.data);

      return reply.code(201).send({
        message: "Bundle processed successfully",
        patientId: patient.id,
        encounter: saved.data,
      });
    } catch (err) {
      console.error("❌ Error processing Bundle:", err);
      return reply
        .code(500)
        .send({ error: "Internal Server Error", details: err.message });
    }
  });
}
