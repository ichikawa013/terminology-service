import fs from "fs-extra";
import axios from "axios";
import qs from "qs";
import "dotenv/config";

// -------------------- WHO API Auth -------------------- //
async function getToken() {
  const body = qs.stringify({
    client_id: process.env.WHO_CLIENT_ID,
    client_secret: process.env.WHO_CLIENT_SECRET,
    scope: "icdapi_access",
    grant_type: "client_credentials",
  });

  const res = await axios.post(
    "https://icdaccessmanagement.who.int/connect/token",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return res.data.access_token;
}

// -------------------- ICD Entity Fetch -------------------- //
async function fetchEntity(token, entityId) {
  try {
    const res = await axios.get(entityId, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "API-Version": "v2",
        "Accept-Language": "en",
      },
    });
    return res.data;
  } catch (err) {
    console.error(
      `❌ Failed to fetch ${entityId}: ${err.response?.status} ${err.response?.statusText}`
    );
    return null;
  }
}

// -------------------- Recursive Crawl -------------------- //
async function fetchHierarchy(
  token,
  entityId,
  concepts = [],
  visited = new Set(),
  depth = 0
) {
  if (visited.has(entityId)) return concepts; // avoid cycles
  visited.add(entityId);

  const entity = await fetchEntity(token, entityId);
  if (!entity) return concepts;

  // Log progress
  const indent = " ".repeat(depth * 2);
  console.log(
    `${indent}📥 Fetched: ${entity["@id"]} → ${
      entity.title?.["@value"] || "[No Title]"
    }`
  );

  // Add FHIR concept
  concepts.push(buildICDConcept(entity));

  // Traverse children
  if (entity.child) {
    for (const child of entity.child) {
      await fetchHierarchy(token, child, concepts, visited, depth + 1);
    }
  }
  return concepts;
}

// -------------------- Build FHIR -------------------- //
function buildICDConcept(entity) {
  const code = entity["@id"].split("/").pop();
  const display = entity.title?.["@value"] || "Unnamed ICD11 TM2 Entity";

  const definition = [
    entity.definition?.["@value"],
    entity.longDefinition?.["@value"],
  ]
    .filter(Boolean)
    .join(" ");

  return {
    code,
    display,
    definition: definition || display || "Definition unavailable",
  };
}

function buildICDCodeSystem(concepts) {
  return {
    resourceType: "CodeSystem",
    id: "icd11-tm2",
    url: "http://id.who.int/icd/entity/1147241349", // TM2 root
    version: "2025-09",
    name: "ICD11_TM2",
    status: "active",
    caseSensitive: true, // ✅ best practice
    content: "complete",
    text: {
      status: "generated", // ✅ narrative to remove warnings
      div: "<div xmlns='http://www.w3.org/1999/xhtml'>ICD-11 TM2 CodeSystem generated from WHO API</div>",
    },
    concept: concepts,
  };
}

// -------------------- Runner -------------------- //
(async () => {
  try {
    const token = await getToken();

    console.log("🚀 Starting ICD-11 TM2 crawl...");
    const rootId = "http://id.who.int/icd/entity/1147241349"; // TM2 root
    const concepts = await fetchHierarchy(token, rootId);

    const codeSystem = buildICDCodeSystem(concepts);
    const outFile = "icd11/parsed/CodeSystem-icd11-tm2.json";

    fs.outputJsonSync(outFile, codeSystem, { spaces: 2 });
    console.log(
      `✅ ICD-11 TM2 CodeSystem saved to ${outFile} with ${concepts.length} concepts`
    );
  } catch (err) {
    console.error("❌ Error fetching ICD-11 TM2:", err.message);
  }
})();
