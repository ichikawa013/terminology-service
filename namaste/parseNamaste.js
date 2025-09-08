import fs from "fs-extra";
import { parse } from "csv-parse";

const files = [
  { path: "namaste/raw/NATIONAL AYURVEDA MORBIDITY CODES.csv", system: "ayurveda" },
  { path: "namaste/raw/NATIONAL SIDDHA MORBIDITY CODES.csv", system: "siddha" },
  { path: "namaste/raw/NATIONAL UNANI MORBIDITY CODES.csv", system: "unani" },
];

// --- Helper functions --- //

// normalize row keys
function normalizeRow(row) {
  const norm = {};
  for (let key in row) {
    norm[key.trim().toLowerCase()] = (row[key] || "").trim();
  }
  return norm;
}

// clean code: remove spaces, replace illegal chars
function cleanCode(code) {
  return code
    ? code.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9\-_\.]/g, "")
    : null;
}

// strip HTML tags (for safe plain-text definition)
function stripHtml(input) {
  return input ? input.replace(/<\/?[^>]+(>|$)/g, "").trim() : "";
}

// ensure definition is not empty
function safeDefinition(definition, display) {
  if (definition && definition.trim() !== "") {
    return definition.trim();
  }
  if (display && display.trim() !== "") {
    return `Definition for ${display.trim()} not provided.`;
  }
  return "No definition available.";
}

// build FHIR CodeSystem
function buildCodeSystem(system, concepts) {
  return {
    resourceType: "CodeSystem",
    id: `namaste-${system}`,
    url: `http://example.org/fhir/CodeSystem/namaste-${system}`,
    version: "2025-09",
    name: `NAMASTE_${system.toUpperCase()}`,
    status: "active",
    caseSensitive: true, // ✅ required
    content: "complete",
    text: { // ✅ narrative
      status: "generated",
      div: `<div xmlns="http://www.w3.org/1999/xhtml">
              NAMASTE ${system} morbidity codes terminology
            </div>`
    },
    concept: concepts,
  };
}

// --- Process files --- //

files.forEach(({ path, system }) => {
  const concepts = [];
  const seenCodes = new Set(); // ✅ prevent duplicates

  fs.createReadStream(path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on("data", (rawRow) => {
      const row = normalizeRow(rawRow);

      let code = cleanCode(row["namc_code"]);
      let display = row["namc_term"]?.trim() || null;

      // Skip rows without code or display
      if (!code || !display) return;

      // ✅ Deduplication check
      if (seenCodes.has(code)) {
        console.warn(`⚠️ Duplicate code skipped in ${system}: ${code} (${display})`);
        return;
      }
      seenCodes.add(code);

      let definition = "";
      if (system === "ayurveda") {
        definition = safeDefinition(stripHtml(row["long_definition"]), display);
      } else if (system === "siddha") {
        definition = safeDefinition(stripHtml(row["long_definition"] || row["refrence"]), display);
      } else if (system === "unani") {
        definition = safeDefinition(stripHtml(row["long_definition"] || row["short_definition"]), display);
      }

      concepts.push({
        code,
        display,
        definition,
      });
    })
    .on("end", () => {
      const codeSystem = buildCodeSystem(system, concepts);
      const outFile = `fhir/CodeSystem-${system}.json`;
      fs.outputJsonSync(outFile, codeSystem, { spaces: 2 });
      console.log(`✅ Generated ${outFile} with ${concepts.length} concepts`);
    })
    .on("error", (error) => {
      console.error(`❌ Error parsing ${system} CSV:`, error.message);
    });
});
