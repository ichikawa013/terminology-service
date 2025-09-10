import { PrismaClient } from "@prisma/client";
import fs from "fs-extra";
import path from "path";

const prisma = new PrismaClient();

// ------------------- IMPORT CODESYSTEM -------------------
async function importCodeSystem(filePath) {
  const codeSystem = await fs.readJson(filePath);

  try {
    // ✅ Check if same version already exists
    const existing = await prisma.codeSystem.findFirst({
      where: { id: codeSystem.id, version: codeSystem.version },
    });

    if (existing) {
      console.log(
        `⚠️ Skipped CodeSystem ${filePath} – version ${codeSystem.version} already exists`
      );
      return;
    }

    // ✅ Deduplicate concepts
    const uniqueConcepts = Array.from(
      new Map(codeSystem.concept.map((c) => [c.code, c])).values()
    );

    // ✅ Insert CodeSystem + Concepts
    await prisma.codeSystem.create({
      data: {
        id: codeSystem.id,
        url: codeSystem.url,
        version: codeSystem.version,
        name: codeSystem.name,
        status: codeSystem.status,
        content: codeSystem.content,
        importedAt: new Date(),
        concepts: {
          create: uniqueConcepts.map((c) => ({
            code: String(c.code),
            display: String(c.display ?? ""),
            definition: c.definition ?? null,
            designations: c.designation ?? null,
            properties: c.property ?? null,
          })),
        },
      },
    });

    console.log(
      `✅ Imported CodeSystem ${filePath} version ${codeSystem.version} with ${uniqueConcepts.length} concepts`
    );
  } catch (err) {
    console.error(`❌ Failed to import CodeSystem ${filePath}:`, err.message);
  }
}

// ------------------- IMPORT CONCEPTMAP -------------------
async function importConceptMap(filePath) {
  const conceptMap = await fs.readJson(filePath);

  try {
    const existing = await prisma.conceptMap.findFirst({
      where: { id: conceptMap.id, version: conceptMap.version },
    });

    if (existing) {
      console.log(
        `⚠️ Skipped ConceptMap ${filePath} – version ${conceptMap.version} already exists`
      );
      return;
    }

    // Extract source + target system
    const group = conceptMap.group?.[0] ?? {};
    const sourceSystem = group.source ?? "unknown";
    const targetSystem = group.target ?? "unknown";

    // ✅ Insert ConceptMap with raw JSON
    await prisma.conceptMap.create({
      data: {
        id: conceptMap.id,
        url: conceptMap.url,
        version: conceptMap.version,
        sourceSystem,
        targetSystem,
        json: conceptMap,
        importedAt: new Date(),
      },
    });

    console.log(
      `✅ Imported ConceptMap ${filePath} version ${conceptMap.version} (${sourceSystem} → ${targetSystem})`
    );
  } catch (err) {
    console.error(`❌ Failed to import ConceptMap ${filePath}:`, err.message);
  }
}

// ------------------- MAIN -------------------
async function main() {
  const codeSystemFiles = [
    "fhir/CodeSystem-ayurveda.json",
    "fhir/CodeSystem-siddha.json",
    "fhir/CodeSystem-unani.json",
    "fhir/CodeSystem-who-ayurveda.json",
    "icd11/parsed/CodeSystem-icd11-tm2.json",
    "icd11/parsed/CodeSystem-icd11-biomedicine.json",
  ];

  const conceptMapFiles = [
    "mappings/ayurveda-to-icd11-tm2/ConceptMap.json",
    "mappings/siddha-to-icd11-tm2/ConceptMap.json",
    "mappings/unani-to-icd11-tm2/ConceptMap.json",
    "mappings/ayurveda-to-icd11-biomed/ConceptMap.json",
    "mappings/siddha-to-icd11-biomed/ConceptMap.json",
    "mappings/unani-to-icd11-biomed/ConceptMap.json",
  ];

  // Import CodeSystems
  for (const file of codeSystemFiles) {
    await importCodeSystem(file);
  }

  // Import ConceptMaps
  for (const file of conceptMapFiles) {
    await importConceptMap(file);
  }

  await prisma.$disconnect();
}

main();
