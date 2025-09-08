import fs from "fs-extra";
import csv from "csv-parser";

const inputFile = "who/ayurveda-terminology.csv";
const outputFile = "fhir/CodeSystem-who-ayurveda.json";

const concepts = [];

// Map section prefixes to names
const sectionMap = {
  "1": "1. Background concepts",
  "2": "2. Core concepts",
  "3": "3. Structure (anatomical terms)",
  "4": "4. Morbidity and diagnostic terms (general)",
};

// Helper to extract section name from Term ID
function getSection(termId) {
  const match = termId.match(/^ITA-(\d+)\./); // capture the first number
  if (!match) return "Unknown";
  const prefix = match[1];
  return sectionMap[prefix] || "Unknown";
}

async function parseCSV() {
  return new Promise((resolve) => {
    fs.createReadStream(inputFile)
      .pipe(csv())
      .on("headers", (headers) => {
        console.log("📑 CSV Headers detected:", headers);
      })
      .on("data", (row) => {
        const termId = row["Term ID"]?.trim();
        if (!termId) return;

        const english = row["English term"]?.trim();
        const desc = row["Description"]?.trim();
        const sanskritIAST = row["Sanskrit term in IAST"]?.trim();
        const sanskrit = row["Sanskrit term"]?.trim();
        const section = getSection(termId);

        concepts.push({
          code: termId,
          display: english || "Unnamed Term",
          definition: desc || english || "Definition unavailable",
          designation: [
            ...(sanskritIAST ? [{ language: "sa-Latn", value: sanskritIAST }] : []),
            ...(sanskrit ? [{ language: "sa-Deva", value: sanskrit }] : []),
          ],
          property: [
            {
              code: "section",
              valueString: section,
            },
          ],
        });
      })
      .on("end", resolve);
  });
}

(async () => {
  await parseCSV();

  const codeSystem = {
    resourceType: "CodeSystem",
    id: "who-ayurveda",
    url: "http://who.int/ayurveda/terminology",
    version: "2025-09",
    name: "WHO_Ayurveda_Terminology",
    status: "active",
    caseSensitive: true,
    content: "complete",
    text: {
      status: "generated",
      div: "<div xmlns='http://www.w3.org/1999/xhtml'>WHO International Terminologies of Ayurveda</div>",
    },
    concept: concepts,
  };

  fs.outputJsonSync(outputFile, codeSystem, { spaces: 2 });
  console.log(
    `✅ CodeSystem saved to ${outputFile} with ${concepts.length} concepts`
  );
})();
