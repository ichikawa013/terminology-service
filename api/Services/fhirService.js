import path from 'path';
import fs from 'fs-extra';
import { PrismaClient } from '@prisma/client';
import { loadJson } from '../utils/loadJson.js';
import { systemToFileMap } from '../utils/systemMap.js';

const prisma = new PrismaClient();
const fhirDir = path.resolve('fhir');

// --- Convert DB CodeSystem -> FHIR
function toFhirCodeSystem(dbResource) {
  return {
    resourceType: 'CodeSystem',
    id: dbResource.id,
    url: dbResource.url,
    version: dbResource.version,
    name: dbResource.name,
    status: dbResource.status,
    content: dbResource.content,
    concept: dbResource.concepts.map((c) => ({
      code: c.code,
      display: c.display,
      definition: c.definition,
      designation: c.designations ? JSON.parse(c.designations) : undefined,
      property: c.properties ? JSON.parse(c.properties) : undefined,
    })),
  };
}

export async function getCodeSystem(idOrUrl, asFhir = true) {
  try {
    // 1. DB first
    const dbResource = await prisma.codeSystem.findFirst({
      where: { OR: [{ id: idOrUrl }, { url: idOrUrl }] },
      include: { concepts: true },
    });

    if (dbResource) return asFhir ? toFhirCodeSystem(dbResource) : dbResource;

    // 2. JSON fallback
    const fileName =
      systemToFileMap[idOrUrl] ||
      `CodeSystem-${idOrUrl.split('/').pop()}.json`;
    const filePath = path.join(fhirDir, fileName);

    if (!(await fs.pathExists(filePath))) return null;
    const json = await loadJson(filePath);
    return asFhir ? json : json;
  } catch (err) {
    console.error(`❌ Failed to get CodeSystem ${idOrUrl}`, err.message);
    return null;
  }
}
