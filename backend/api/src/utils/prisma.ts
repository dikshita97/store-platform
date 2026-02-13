import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug('Prisma Query', { query: e.query, duration: e.duration });
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error', { message: e.message });
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
