import path from 'path';
import fs from 'fs-extra';
import { PrismaClient } from '@prisma/client';
import { loadJson } from '../utils/loadJson.js';
import { systemToFileMap } from '../utils/systemMap.js';
import { glob } from 'glob';

const prisma = new PrismaClient();
const fhirDir = path.resolve('fhir');

function fileForSystem(system) {
  if (!system) return null;
  if (systemToFileMap[system]) return systemToFileMap[system];
  const last = system.split('/').pop();
  if (systemToFileMap[last]) return systemToFileMap[last];
  return `CodeSystem-${last}.json`;
}

// --- Convert to FHIR `$lookup`
function toFhirLookupResult(match, system) {
  return {
    resourceType: 'Parameters',
    parameter: [
      { name: 'name', valueString: system },
      { name: 'display', valueString: match.display },
      { name: 'code', valueCode: match.code },
      {
        name: 'designation',
        part: [
          { name: 'language', valueCode: 'en' },
          { name: 'value', valueString: match.display },
        ],
      },
      { name: 'definition', valueString: match.definition || '' },
    ],
  };
}

export async function lookupConcept(q, system, asFhir = true) {
  try {
    const qnorm = (q || '').trim();
    if (!qnorm) return asFhir ? [] : { results: [] };

    // --- 1) DB lookup
    if (system) {
      const codeSystem = await prisma.codeSystem.findFirst({
        where: { OR: [{ url: system }, { id: system }] },
      });

      if (codeSystem) {
        const concepts = await prisma.concept.findMany({
          where: {
            codeSystemId: codeSystem.id,
            OR: [
              { code: { contains: qnorm, mode: 'insensitive' } },
              { display: { contains: qnorm, mode: 'insensitive' } },
            ],
          },
          take: 20,
        });

        if (concepts.length > 0) {
          return asFhir
            ? toFhirLookupResult(concepts[0], system)
            : { results: concepts.map(c => ({ code: c.code, display: c.display, definition: c.definition })) };
        }
      }

      // --- JSON fallback
      const fileName = fileForSystem(system);
      const filePath = path.join(fhirDir, fileName);
      if (await fs.pathExists(filePath)) {
        const cs = await loadJson(filePath);
        const found = (cs.concept || []).filter(c =>
          (c.code || '').toLowerCase().includes(qnorm.toLowerCase()) ||
          (c.display || '').toLowerCase().includes(qnorm.toLowerCase())
        );

        if (found.length > 0) {
          return asFhir
            ? toFhirLookupResult(found[0], cs.url || system)
            : { results: found.map(c => ({ code: c.code, display: c.display, definition: c.definition })) };
        }
      }

      return asFhir
        ? { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'No match found' }] }
        : { results: [] };
    }

    // --- 2) If system not specified, search NAMASTE systems
    const namasteSystems = await prisma.codeSystem.findMany({
      where: {
        OR: [
          { id: { contains: 'namaste', mode: 'insensitive' } },
          { name: { contains: 'NAMASTE', mode: 'insensitive' } },
          { url: { contains: 'namaste', mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    for (const cs of namasteSystems) {
      const concepts = await prisma.concept.findMany({
        where: {
          codeSystemId: cs.id,
          OR: [
            { code: { contains: qnorm, mode: 'insensitive' } },
            { display: { contains: qnorm, mode: 'insensitive' } },
          ],
        },
        take: 20,
      });
      if (concepts.length) {
        return asFhir
          ? toFhirLookupResult(concepts[0], cs.url || cs.id)
          : { results: concepts.map(c => ({ code: c.code, display: c.display, definition: c.definition, system: cs.url })) };
      }
    }

    // --- 3) JSON NAMASTE files
    const jsonFiles = glob.sync(path.join(fhirDir, 'CodeSystem-*.json'));
    for (const jf of jsonFiles) {
      const cs = await loadJson(jf);
      const found = (cs.concept || []).filter(c =>
        (c.code || '').toLowerCase().includes(qnorm.toLowerCase()) ||
        (c.display || '').toLowerCase().includes(qnorm.toLowerCase())
      );
      if (found.length) {
        return asFhir
          ? toFhirLookupResult(found[0], cs.url || cs.id || jf)
          : { results: found.map(c => ({ code: c.code, display: c.display, definition: c.definition, system: cs.url })) };
      }
    }

    return asFhir
      ? { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'No match found' }] }
      : { results: [] };
  } catch (err) {
    console.error('❌ lookupConcept error:', err);
    return asFhir
      ? { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: err.message }] }
      : { results: [] };
  }
}
