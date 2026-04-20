import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';

export async function registerMarketingRoutes(app: FastifyInstance, pool: pg.Pool) {
  const logger = createLogger('marketing-routes');

  app.get('/v1/marketing/status', async () => {
    return { success: true, message: 'Marketing service stub active' };
  });

  logger.info('Marketing Intelligence stub routes registered');
}
