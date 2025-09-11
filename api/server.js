// api/index.js
import Fastify from 'fastify';
import lookupRoutes from './routes/lookup.js';
import translateRoutes from './routes/translate.js';
import fhirRoutes from './routes/fhir.js';
import bundleRoutes from './routes/bundle.js';
import timelineRoutes from './routes/timeline.js'; // ✅ added
import { verifyFirebaseToken } from '../middleware/auth.js';
import whoamiRoutes from './routes/whoami.js';

const server = Fastify({ logger: true });

// ✅ Always use Firebase auth middleware
server.addHook('preHandler', verifyFirebaseToken);

// Register routes
server.register(lookupRoutes);
server.register(translateRoutes);
server.register(fhirRoutes);
server.register(bundleRoutes);
server.register(timelineRoutes); // ✅ new
server.register(whoamiRoutes);

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
