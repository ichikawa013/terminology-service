// api/utils/systemMap.js
// Map common incoming system identifiers (url, id, filename stems) to local files
export const systemToFileMap = {
  // NAMASTE / local CodeSystems (adjust file names if yours differ)
  "http://namaste.gov.in/fhir/CodeSystem/namaste-ayurveda": "CodeSystem-ayurveda.json",
  "http://namaste.gov.in/fhir/CodeSystem/namaste-siddha": "CodeSystem-siddha.json",
  "http://namaste.gov.in/fhir/CodeSystem/namaste-unani": "CodeSystem-unani.json",
  // Variants / shortened ids
  "namaste-ayurveda": "CodeSystem-ayurveda.json",
  "namaste-siddha": "CodeSystem-siddha.json",
  "namaste-unani": "CodeSystem-unani.json",
  "ayurveda": "CodeSystem-ayurveda.json",
  "siddha": "CodeSystem-siddha.json",
  "unani": "CodeSystem-unani.json",

  // WHO ICD-11 module canonical
  "http://id.who.int/icd/release/11/mms": "CodeSystem-icd11-tm2.json",        // tm2 file (change if yours named biomedicine/tm2 differently)
  "http://id.who.int/icd/entity/146209201": "CodeSystem-icd11-tm2.json",
  "icd11-tm2": "CodeSystem-icd11-tm2.json",
  "icd11-biomed": "CodeSystem-icd11-biomedicine.json",
  "http://id.who.int/icd/release/11": "CodeSystem-icd11-biomedicine.json"
};
