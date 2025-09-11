//api\Services\translateService.js
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { loadJson } from '../utils/loadJson.js';

const prisma = new PrismaClient();
const mappingsDir = path.resolve('mappings');

// --- Convert matches -> FHIR `$translate`
function toFhirTranslateResult(matches, targetSystem) {
  return {
    resourceType: 'Parameters',
    parameter: [
      { name: 'result', valueBoolean: matches.length > 0 },
      ...matches.map(m => ({
        name: 'match',
        part: [
          { name: 'equivalence', valueCode: m.relationship || 'equivalent' },
          {
            name: 'concept',
            valueCoding: {
              system: targetSystem,
              code: m.code,
              display: m.display,
            },
          },
        ],
      })),
    ],
  };
}

export async function translateCode(code, sourceSystem, targetSystem, asFhir = true) {
  const matches = [];

  // --- DB first (collect from all ConceptMaps, not just one)
  const dbMaps = await prisma.conceptMap.findMany({ where: { sourceSystem, targetSystem } });
  for (const dbMap of dbMaps) {
    const mapJson = typeof dbMap.json === 'string' ? JSON.parse(dbMap.json) : dbMap.json;
    for (const group of mapJson.group || []) {
      if (group.source !== sourceSystem || group.target !== targetSystem) continue;
      for (const element of group.element || []) {
        if (element.code === code) {
          for (const target of element.target || []) {
            matches.push({
              code: target.code,
              display: target.display,
              relationship: target.relationship,
            });
          }
        }
      }
    }
  }

  // --- JSON fallback if nothing in DB
  if (!matches.length) {
    const candidates = [
      'ayurveda-to-icd11-biomed/ConceptMap.json',
      'ayurveda-to-icd11-tm2/ConceptMap.json',
      'siddha-to-icd11-biomed/ConceptMap.json',
      'siddha-to-icd11-tm2/ConceptMap.json',
      'unani-to-icd11-biomed/ConceptMap.json',
      'unani-to-icd11-tm2/ConceptMap.json',
    ];
    for (const f of candidates) {
      const map = await loadJson(path.join(mappingsDir, f));
      for (const group of map?.group || []) {
        if (group.source !== sourceSystem || group.target !== targetSystem) continue;
        for (const element of group.element || []) {
          if (element.code === code) {
            for (const target of element.target || []) {
              matches.push({
                code: target.code,
                display: target.display,
                relationship: target.relationship,
              });
            }
          }
        }
      }
    }
  }

  if (!matches.length) {
    return asFhir
      ? {
          resourceType: 'OperationOutcome',
          issue: [
            { severity: 'warning', code: 'not-found', diagnostics: 'No match for code' },
          ],
        }
      : { result: [] };
  }

  // --- Return all matches
  return asFhir
    ? toFhirTranslateResult(matches, targetSystem)
    : { result: matches };
}
