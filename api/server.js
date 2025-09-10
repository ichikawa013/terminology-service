import Fastify from 'fastify';
import lookupRoutes from './routes/lookup.js';
import translateRoutes from './routes/translate.js';
import fhirRoutes from './routes/fhir.js';
import bundleRoutes from './routes/bundle.js';

const server = Fastify({ logger: true });

// Register routes
server.register(lookupRoutes);
server.register(translateRoutes);
server.register(fhirRoutes);
server.register(bundleRoutes);

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Fastify API running on http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
