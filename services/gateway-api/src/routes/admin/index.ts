import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';

export async function registerAdminRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  // stub
}
