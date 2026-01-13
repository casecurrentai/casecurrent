import { PrismaClient, Prisma } from '../apps/api/src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from './env';

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
export { Prisma };
