// src/routes/translate.js
import { translateCode } from '../Services/translateService.js';

export default async function translateRoutes(fastify) {
  fastify.post('/translate', async (request, reply) => {
    const { code, system, target } = request.body || {};

    if (!code || !system || !target) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: 'Missing required fields: code, system, target',
      });
    }

    try {
      const result = await translateCode(code, system, target);

      if (!result) {
        console.log(`No mapping found for "${code}" in ${system} → ${target}`);
        return reply.code(404).send({
          error: 'NotFound',
          message: `No mapping found for ${code} in ${system} → ${target}`,
        });
      }

      console.log(
        `✅ Translation found for "${code}" in ${system} → ${target}:`,
        result
      );

      return reply.code(200).send({ result });
    } catch (err) {
      console.error('❌ Error in /translate route:', err);
      return reply.code(500).send({
        error: 'InternalServerError',
        message: err.message,
      });
    }
  });
}
