// generateConceptMapCsv.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { distance } from "fastest-levenshtein";
import pkg from "natural";
const { NGrams, TfIdf } = pkg;
import { createObjectCsvWriter } from "csv-writer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- CONFIG ----
const OUTPUT_DIR = path.join(__dirname, "mappings");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Load synonyms if exists
let synonyms = {};
const synonymsPath = path.join(__dirname, "synonyms.json");
if (fs.existsSync(synonymsPath)) {
  synonyms = JSON.parse(fs.readFileSync(synonymsPath, "utf-8"));
  console.log(`📖 Loaded synonyms (${Object.keys(synonyms).length})`);
}

// ---- UTILITIES ----
function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function levenshteinSim(a, b) {
  const d = distance(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

function cosineSim(a, b) {
  const { TfIdf } = pkg;
  const tfidf = new TfIdf();

  tfidf.addDocument(normalize(a));
  tfidf.addDocument(normalize(b));

  const vecA = [];
  const vecB = [];

  tfidf.listTerms(0).forEach(t => {
    vecA.push(t.tfidf);
    const termB = tfidf.tfidf(t.term, 1);
    vecB.push(termB);
  });

  // Cosine similarity = dot(vecA, vecB) / (||A|| * ||B||)
  const dot = vecA.reduce((sum, v, i) => sum + v * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(vecB.reduce((sum, v) => sum + v * v, 0));

  return normA && normB ? dot / (normA * normB) : 0;
}


function hybridSim(a, b) {
  return Math.max(levenshteinSim(a, b), cosineSim(a, b));
}

// ---- CORE MAPPING ----
async function writeCsv(file, rows) {
  const writer = createObjectCsvWriter({
    path: file,
    header: [
      { id: "sourceCode", title: "source_code" },
      { id: "sourceDisplay", title: "source_display" },
      { id: "targetCode", title: "target_code" },
      { id: "targetDisplay", title: "target_display" },
      { id: "similarity", title: "similarity" },
      { id: "mapType", title: "map_type" },
    ],
  });
  await writer.writeRecords(rows);
  console.log(`✅ Wrote ${rows.length} rows to ${file}`);
}

function getBestMatches(sourceConcepts, targetConcepts, topN = 3) {
  return sourceConcepts.flatMap((src) => {
    const srcDisplay = src.display || src.code;

    // 1. Check synonyms dictionary
    if (synonyms[srcDisplay]) {
      return synonyms[srcDisplay].map((targetText) => {
        const tgt = targetConcepts.find(
          (t) => normalize(t.display) === normalize(targetText)
        );
        if (tgt) {
          return {
            sourceCode: src.code,
            sourceDisplay: srcDisplay,
            targetCode: tgt.code,
            targetDisplay: tgt.display,
            similarity: 1.0,
            mapType: "equivalent",
          };
        }
        return null;
      }).filter(Boolean);
    }

    // 2. Fallback to hybrid similarity
    const scored = targetConcepts.map((tgt) => ({
      targetCode: tgt.code,
      targetDisplay: tgt.display,
      score: hybridSim(srcDisplay, tgt.display || tgt.code),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((best) => ({
        sourceCode: src.code,
        sourceDisplay: srcDisplay,
        targetCode: best.targetCode,
        targetDisplay: best.targetDisplay,
        similarity: best.score.toFixed(3),
        mapType: best.score > 0.8 ? "equivalent" : "related",
      }));
  });
}

// ---- RUN ----
async function generateMappings() {
  console.log("\n🔍 Processing NAMASTE ayurveda...");

  // Example: load concepts (replace with your JSON paths)
  const namasteAyurveda = JSON.parse(fs.readFileSync("fhir/CodeSystem-ayurveda.json", "utf-8")).concept;
  const icd11tm2 = JSON.parse(fs.readFileSync("icd11/parsed/CodeSystem-icd11-tm2.json", "utf-8")).concept;
  const icd11biomed = JSON.parse(fs.readFileSync("icd11/parsed/CodeSystem-icd11-biomedicine.json", "utf-8")).concept;
  const whoAyurveda = JSON.parse(fs.readFileSync("fhir/CodeSystem-who-ayurveda.json", "utf-8")).concept;

  await writeCsv(
    path.join(OUTPUT_DIR, "ayurveda-to-icd11-tm2.csv"),
    getBestMatches(namasteAyurveda, icd11tm2)
  );

  await writeCsv(
    path.join(OUTPUT_DIR, "ayurveda-to-icd11-biomed.csv"),
    getBestMatches(namasteAyurveda, icd11biomed)
  );

  await writeCsv(
    path.join(OUTPUT_DIR, "who-ayurveda-to-ayurveda.csv"),
    getBestMatches(whoAyurveda, namasteAyurveda)
  );

  // repeat for siddha/unani
  console.log("\n🔍 Processing NAMASTE siddha...");
  const namasteSiddha = JSON.parse(fs.readFileSync("fhir/CodeSystem-siddha.json", "utf-8")).concept;
  await writeCsv(
    path.join(OUTPUT_DIR, "siddha-to-icd11-tm2.csv"),
    getBestMatches(namasteSiddha, icd11tm2)
  );
  await writeCsv(
    path.join(OUTPUT_DIR, "siddha-to-icd11-biomed.csv"),
    getBestMatches(namasteSiddha, icd11biomed)
  );

  console.log("\n🔍 Processing NAMASTE unani...");
  const namasteUnani = JSON.parse(fs.readFileSync("fhir/CodeSystem-unani.json", "utf-8")).concept;
  await writeCsv(
    path.join(OUTPUT_DIR, "unani-to-icd11-tm2.csv"),
    getBestMatches(namasteUnani, icd11tm2)
  );
  await writeCsv(
    path.join(OUTPUT_DIR, "unani-to-icd11-biomed.csv"),
    getBestMatches(namasteUnani, icd11biomed)
  );
}

generateMappings().catch((err) => console.error("❌ Error:", err));
