// generateConceptMap.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { distance } from "fastest-levenshtein";
import pkg from "natural";
const { TfIdf } = pkg;
import { createObjectCsvWriter } from "csv-writer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- CONFIG ----
const OUTPUT_DIR = path.join(__dirname, "mappings");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const SIM_THRESHOLD = 0.75;
const TOP_N = 3;

// Load synonyms if exists
let synonyms = {};
const synonymsPath = path.join(__dirname, "synonyms.json");
if (fs.existsSync(synonymsPath)) {
  const raw = JSON.parse(fs.readFileSync(synonymsPath, "utf-8"));
  synonyms = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), v])
  );
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
  const tfidf = new TfIdf();
  tfidf.addDocument(normalize(a));
  tfidf.addDocument(normalize(b));

  const vecA = [];
  const vecB = [];

  tfidf.listTerms(0).forEach((t) => {
    vecA.push(t.tfidf);
    vecB.push(tfidf.tfidf(t.term, 1));
  });

  const dot = vecA.reduce((sum, v, i) => sum + v * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(vecB.reduce((sum, v) => sum + v * v, 0));

  return normA && normB ? dot / (normA * normB) : 0;
}

function hybridSim(a, b) {
  return Math.max(levenshteinSim(a, b), cosineSim(a, b));
}

// helper: map your map_type -> R5 relationship token
function mapTypeToRelationship(mapType) {
  if (!mapType) return "related-to";
  const m = String(mapType).toLowerCase().trim();
  if (m === "equivalent" || m === "equal" || m === "exact") return "equivalent";
  if (m === "narrower") return "source-is-narrower-than-target";
  if (m === "broader") return "source-is-broader-than-target";
  if (m === "related" || m === "relatedto" || m === "related-to") return "related-to";
  return "related-to";
}

// helper: machine-friendly name from dataset id
function makeMachineName(id) {
  // e.g. "ayurveda-to-icd11-tm2" -> "AyurvedaToIcd11Tm2"
  return id
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join("");
}

// helper: canonical URIs for known systems (expand if you have more)
function canonicalSystemUri(systemKey) {
  const key = String(systemKey).toLowerCase();
  if (key.includes("namaste")) {
    return `http://namaste.gov.in/fhir/CodeSystem/${systemKey}`;
  }
  if (key.includes("icd11") || key.includes("icd-11") || key.includes("icd")) {
    // use WHO ICD-11 canonical release URI (acceptable to validator)
    return `http://id.who.int/icd/release/11/mms`;
  }
  // fallback to a namespaced URI that is NOT example.com
  return `http://namaste.gov.in/fhir/CodeSystem/${systemKey}`;
}

// ---- CSV Writer ----
async function writeCsv(file, rows) {
  const writer = createObjectCsvWriter({
    path: file,
    header: [
      { id: "dataset", title: "dataset" },
      { id: "sourceSystem", title: "source_system" },
      { id: "sourceCode", title: "source_code" },
      { id: "sourceDisplay", title: "source_display" },
      { id: "targetSystem", title: "target_system" },
      { id: "targetCode", title: "target_code" },
      { id: "targetDisplay", title: "target_display" },
      { id: "similarity", title: "similarity" },
      { id: "mapType", title: "map_type" },
    ],
  });

  // normalize rows to consistent types / precision
  const cleaned = rows.map(r => ({
    dataset: r.dataset ?? "",
    sourceSystem: r.sourceSystem ?? "",
    sourceCode: r.sourceCode ?? "",
    sourceDisplay: r.sourceDisplay ?? "",
    targetSystem: r.targetSystem ?? "",
    targetCode: r.targetCode ?? "",
    targetDisplay: r.targetDisplay ?? "",
    similarity: (r.similarity !== undefined && r.similarity !== null) ? Number(r.similarity).toFixed(3) : "",
    mapType: r.mapType ?? "related",
  }));

  await writer.writeRecords(cleaned);
  console.log(`✅ Wrote ${cleaned.length} rows to ${file}`);
}

async function writeDualCsv(baseDir, rows) {
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  const fullFile = path.join(baseDir, "full.csv");
  await writeCsv(fullFile, rows);

  const filtered = rows.filter(
    (r) => parseFloat(r.similarity) >= SIM_THRESHOLD || (r.mapType && String(r.mapType).toLowerCase() === "equivalent")
  );
  const cleanFile = path.join(baseDir, "clean.csv");
  await writeCsv(cleanFile, filtered);

  console.log(
    `📊 ${path.basename(baseDir)}: kept ${filtered.length}/${rows.length} rows (threshold=${SIM_THRESHOLD})`
  );

  return { full: fullFile, clean: cleanFile };
}

// ---- DOMAIN FILTER ----
const KEYWORDS = ["vata", "pitta", "kapha", "sukra", "dosha", "mamsa", "rakt", "meda"];
function keywordFilter(src, tgt) {
  const srcNorm = normalize(src);
  const tgtNorm = normalize(tgt);

  for (const kw of KEYWORDS) {
    if (srcNorm.includes(kw) && !tgtNorm.includes(kw)) {
      return false;
    }
  }
  return true;
}

// ---- MAPPING FUNCTION ----
function getBestMatches(sourceConcepts, targetConcepts, topN, dataset, sourceSystem, targetSystem) {
  const targetMap = Object.fromEntries(targetConcepts.map((t) => [normalize(t.display), t]));

  return sourceConcepts.flatMap((src) => {
    const srcDisplay = src.display || src.code;
    const srcKey = normalize(srcDisplay);

    // 1. Synonyms first
    if (synonyms[srcKey]) {
      return synonyms[srcKey]
        .map((targetText) => {
          const tgt = targetMap[normalize(targetText)];
          if (tgt) {
            return {
              dataset,
              sourceSystem,
              sourceCode: src.code,
              sourceDisplay: srcDisplay,
              targetSystem,
              targetCode: tgt.code,
              targetDisplay: tgt.display,
              similarity: 1.0,
              mapType: "equivalent",
            };
          }
          return null;
        })
        .filter(Boolean);
    }

    // 2. Fallback to hybrid similarity
    const scored = targetConcepts
      .filter((tgt) => keywordFilter(srcDisplay, tgt.display || tgt.code))
      .map((tgt) => ({
        targetCode: tgt.code,
        targetDisplay: tgt.display,
        score: hybridSim(srcDisplay, tgt.display || tgt.code),
      }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((best) => {
        let mapType = "related";
        if (best.score > 0.85) mapType = "equivalent";

        return {
          dataset,
          sourceSystem,
          sourceCode: src.code,
          sourceDisplay: srcDisplay,
          targetSystem,
          targetCode: best.targetCode,
          targetDisplay: best.targetDisplay,
          similarity: best.score,
          mapType,
        };
      });
  });
}

// ---- GENERATE CONCEPTMAP JSON (R5-compliant) ----
function generateConceptMapJson(cleanCsvPath, sourceSystemKey, targetSystemKey, datasetUrlBase = "http://namaste.gov.in/fhir/ConceptMap", version = "1.0.0") {
  // read CSV (simple split approach consistent with your current writer)
  const raw = fs.readFileSync(cleanCsvPath, "utf-8").trim();
  if (!raw) {
    console.warn("Empty CSV:", cleanCsvPath);
    return;
  }

  const rows = raw
    .split("\n")
    .slice(1)
    .map(line => line.split(","))
    .filter(arr => arr.length >= 7)
    .map(arr => ({
      sourceCode: arr[2],
      sourceDisplay: arr[3],
      targetCode: arr[5],
      targetDisplay: arr[6],
      mapType: arr[8] || "related"
    }));

  // group targets by sourceCode so we produce one element per source code
  const elementsMap = new Map();
  for (const r of rows) {
    if (!r.sourceCode) continue;
    const key = r.sourceCode;
    if (!elementsMap.has(key)) {
      elementsMap.set(key, {
        code: r.sourceCode,
        display: r.sourceDisplay,
        target: []
      });
    }
    // push target with required R5 'relationship'
    elementsMap.get(key).target.push({
      code: r.targetCode,
      display: r.targetDisplay,
      relationship: mapTypeToRelationship(r.mapType)
    });
  }

  const datasetId = path.basename(path.dirname(cleanCsvPath)); // e.g. "ayurveda-to-icd11-tm2"
  const machineName = makeMachineName(datasetId);
  const title = `${machineName} ConceptMap`;

  const sourceUri = canonicalSystemUri(sourceSystemKey);
  const targetUri = canonicalSystemUri(targetSystemKey);

  const conceptMap = {
    resourceType: "ConceptMap",
    id: datasetId,
    url: `${datasetUrlBase}/${datasetId}`,
    version,
    name: machineName,
    title,
    status: "draft",
    experimental: true,
    date: new Date().toISOString(),
    publisher: "NAMASTE Terms Team",
    description: `Auto-generated ConceptMap for ${datasetId}`,
    group: [
      {
        source: sourceUri,
        target: targetUri,
        element: Array.from(elementsMap.values())
      }
    ]
  };

  const outputPath = cleanCsvPath.replace("clean.csv", "ConceptMap.json");
  fs.writeFileSync(outputPath, JSON.stringify(conceptMap, null, 2));
  console.log(`📦 ConceptMap JSON written to ${outputPath}`);
}

// ---- RUN ----
async function generateMappings() {
  // Load CodeSystems
  const ayurveda = JSON.parse(fs.readFileSync("fhir/CodeSystem-ayurveda.json", "utf-8")).concept;
  const siddha = JSON.parse(fs.readFileSync("fhir/CodeSystem-siddha.json", "utf-8")).concept;
  const unani = JSON.parse(fs.readFileSync("fhir/CodeSystem-unani.json", "utf-8")).concept;
  const tm2 = JSON.parse(fs.readFileSync("icd11/parsed/CodeSystem-icd11-tm2.json", "utf-8")).concept;
  const biomed = JSON.parse(fs.readFileSync("icd11/parsed/CodeSystem-icd11-biomedicine.json", "utf-8")).concept;

  // Define mapping jobs
  const jobs = [
    { dataset: "ayurveda-to-icd11-tm2", source: ayurveda, sourceSys: "namaste-ayurveda", target: tm2, targetSys: "icd11-tm2" },
    { dataset: "siddha-to-icd11-tm2", source: siddha, sourceSys: "namaste-siddha", target: tm2, targetSys: "icd11-tm2" },
    { dataset: "unani-to-icd11-tm2", source: unani, sourceSys: "namaste-unani", target: tm2, targetSys: "icd11-tm2" },
    { dataset: "ayurveda-to-icd11-biomed", source: ayurveda, sourceSys: "namaste-ayurveda", target: biomed, targetSys: "icd11-biomed" },
    { dataset: "siddha-to-icd11-biomed", source: siddha, sourceSys: "namaste-siddha", target: biomed, targetSys: "icd11-biomed" },
    { dataset: "unani-to-icd11-biomed", source: unani, sourceSys: "namaste-unani", target: biomed, targetSys: "icd11-biomed" },
  ];

  for (const job of jobs) {
    console.log(`\n🔍 Processing ${job.dataset}...`);
    const matches = getBestMatches(job.source, job.target, TOP_N, job.dataset, job.sourceSys, job.targetSys);
    const { clean: cleanCsv } = await writeDualCsv(
      path.join(OUTPUT_DIR, job.dataset),
      matches
    );

    generateConceptMapJson(
      cleanCsv,
      job.sourceSys,
      job.targetSys,
      `http://namaste.gov.in/fhir/ConceptMap`
    );
  }
}

generateMappings().catch((err) => console.error("❌ Error:", err));
