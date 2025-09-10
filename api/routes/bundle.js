// api/routes/bundle.js
import prisma from '../lib/prisma.js';

export default async function bundleRoutes(fastify) {
  fastify.post('/fhir/Bundle', async (req, reply) => {
    const bundle = req.body;

    if (!bundle || bundle.resourceType !== 'Bundle') {
      return reply.code(400).send({ error: 'Invalid FHIR Bundle' });
    }

    try {
      const patient = bundle.entry.find(e => e.resource.resourceType === 'Patient')?.resource;
      const encounter = bundle.entry.find(e => e.resource.resourceType === 'Encounter')?.resource;

      const conditions = bundle.entry
        .filter(e => e.resource.resourceType === 'Condition')
        .map(e => e.resource);

      // Save the full Bundle JSON for traceability
      const savedBundle = await prisma.bundle.create({
        data: { data: bundle }
      });

      const storedConditions = [];
      for (const cond of conditions) {
        const namasteCoding = cond.code.coding.find(c => c.system.includes('namaste'));
        let icdMatches = cond.code.coding.filter(c => c.system.includes('icd'));

        if (!namasteCoding) {
          return reply.code(400).send({
            error: 'Condition must include a NAMASTE coding',
            condition: cond.id
          });
        }

        // If no ICD mappings yet → try translating
        if (!icdMatches.length) {
          const { translateCode } = await import('../Services/translateService.js');
          const translated = await translateCode(
            namasteCoding.code,
            namasteCoding.system,
            "http://id.who.int/icd/release/11/mms"
          );

          if (translated?.length) {
            icdMatches = translated.map(t => ({
              system: "http://id.who.int/icd/release/11/mms",
              code: t.code,
              display: t.display
            }));

            // Push all into the Condition FHIR resource
            cond.code.coding.push(...icdMatches);
          } else {
            // 🚑 Demo fallback if unmapped
            const fallback = {
              system: "http://id.who.int/icd/release/11/mms",
              code: "ZZZ999",
              display: "Unmapped Condition (Demo Fallback)"
            };
            icdMatches = [fallback];
            cond.code.coding.push(fallback);
          }
        }

        // Save to DB — store primary ICD + full Condition JSON
        const stored = await prisma.conditionLog.create({
          data: {
            namasteCode: namasteCoding.code,
            icdCode: icdMatches[0].code, // primary ICD
            data: cond                   // contains all codings
          }
        });

        storedConditions.push({
          id: stored.id,
          namaste: namasteCoding.code,
          icd: icdMatches.map(i => i.code) // return all ICD codes
        });
      }

      return reply.code(201).send({
        message: 'Bundle processed successfully',
        bundleId: savedBundle.id,
        conditions: storedConditions
      });

    } catch (err) {
      console.error('❌ Error processing Bundle:', err);
      return reply.code(500).send({ error: 'Internal Server Error', details: err.message });
    }
  });
}
