export default async function whoamiRoutes(fastify, options) {
  fastify.get('/whoami', async (req, reply) => {
    // req.user is set by authMiddleware.js
    if (!req.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    return { user: req.user };
  });
}
