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
  let conceptMap = null;

  // --- DB first
  const dbMaps = await prisma.conceptMap.findMany({ where: { sourceSystem, targetSystem } });
  for (const dbMap of dbMaps) {
    const mapJson = typeof dbMap.json === 'string' ? JSON.parse(dbMap.json) : dbMap.json;
    if (mapJson.group?.some(g => g.element?.some(el => el.code === code))) {
      conceptMap = mapJson;
      break;
    }
  }

  // --- JSON fallback
  if (!conceptMap) {
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
      if (map?.group?.some(g => g.source === sourceSystem && g.target === targetSystem)) {
        conceptMap = map;
        break;
      }
    }
  }

  if (!conceptMap) {
    return asFhir
      ? { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'No ConceptMap found' }] }
      : { result: [] };
  }

  // --- Find code in ConceptMap
  for (const group of conceptMap.group || []) {
    if (group.source !== sourceSystem || group.target !== targetSystem) continue;
    const element = group.element?.find(el => el.code === code);
    if (element?.target?.length) {
      return asFhir
        ? toFhirTranslateResult(element.target, targetSystem)
        : { result: element.target.map(t => ({ code: t.code, display: t.display, relationship: t.relationship })) };
    }
  }

  return asFhir
    ? { resourceType: 'OperationOutcome', issue: [{ severity: 'warning', code: 'not-found', diagnostics: 'No match for code' }] }
    : { result: [] };
}
