// src/routes/fhir.js
import { getCodeSystem } from '../Services/fhirService.js';

export default async function fhirRoutes(fastify) {
  fastify.get('/fhir/CodeSystem/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const resource = await getCodeSystem(id);

      if (!resource) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `CodeSystem ${id} not found`,
        });
      }

      return reply.code(200).send(resource); // must return raw FHIR JSON
    } catch (err) {
      console.error('❌ Error in /fhir/CodeSystem route:', err);
      return reply.code(500).send({
        error: 'InternalServerError',
        message: err.message,
      });
    }
  });
}
