import { PrismaClient } from "@prisma/client";
import fs from "fs-extra";

const prisma = new PrismaClient();

async function importCodeSystem(filePath) {
  const codeSystem = await fs.readJson(filePath);

  try {
    // ✅ Check if same version already exists
    const existing = await prisma.codeSystem.findFirst({
      where: { id: codeSystem.id, version: codeSystem.version },
    });

    if (existing) {
      console.log(
        `⚠️ Skipped ${filePath} – version ${codeSystem.version} already exists`
      );
      return;
    }

    // ✅ Deduplicate concepts
    const uniqueConcepts = Array.from(
      new Map(codeSystem.concept.map((c) => [c.code, c])).values()
    );

    // ✅ Insert with version + timestamp
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
            definition:
              c.definition !== undefined && c.definition !== null
                ? String(c.definition)
                : null,
            designations: c.designation ? JSON.stringify(c.designation) : null,
            properties: c.property ? JSON.stringify(c.property) : null,
          })),
        },
      },
    });

    console.log(
      `✅ Imported ${filePath} version ${codeSystem.version} into DB with ${uniqueConcepts.length} concepts`
    );
  } catch (err) {
    console.error(`❌ Failed to import ${filePath}:`, err.message);
  }
}

async function main() {
  const files = [
    "fhir/CodeSystem-ayurveda.json",
    "fhir/CodeSystem-siddha.json",
    "fhir/CodeSystem-unani.json",
    "fhir/CodeSystem-who-ayurveda.json",
    "icd11/parsed/CodeSystem-icd11-tm2.json",
    "icd11/parsed/CodeSystem-icd11-biomedicine.json",
  ];

  for (const file of files) {
    await importCodeSystem(file);
  }

  await prisma.$disconnect();
}

main();
