import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({
  logger: true
});

await fastify.register(cors, {
  origin: true
});

fastify.get('/', async () => {
  return { status: 'ok', service: 'CounselTech API', version: '1.0.0' };
});

fastify.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`CounselTech API running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
