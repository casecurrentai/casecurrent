import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const fastify = Fastify({
  logger: true
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

await fastify.register(cors, {
  origin: true
});

fastify.get('/', async () => {
  return { status: 'ok', service: 'CounselTech API', version: '1.0.0' };
});

fastify.get('/health', async () => {
  let dbStatus = 'unknown';
  let orgCount = 0;
  
  try {
    const result = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW()`;
    const orgs = await prisma.organization.count();
    dbStatus = 'connected';
    orgCount = orgs;
  } catch (error) {
    dbStatus = 'disconnected';
  }
  
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
    orgCount
  };
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
