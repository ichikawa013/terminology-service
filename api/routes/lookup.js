// api/routes/lookup.js
import { lookupConcept } from '../Services/lookupService.js';

export default async function lookupRoutes(fastify) {
  fastify.get('/lookup', async (request, reply) => {
    const { q, system } = request.query;

    if (!q) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: 'Missing required query param: q',
      });
    }

    try {
      const results = await lookupConcept(q, system);

      if (!results || results.length === 0) {
        return reply.code(200).send({ results: [] });
      }

      return reply.code(200).send({ results });
    } catch (err) {
      console.error('❌ Error in /lookup route:', err);
      return reply.code(500).send({
        error: 'InternalServerError',
        message: err.message,
      });
    }
  });
}
