import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ledger } from '@sven/treasury';

const TX_KINDS = [
  'revenue', 'payout', 'transfer', 'refund', 'fee',
  'compute_cost', 'upgrade', 'donation', 'seed', 'reserve_move', 'adjustment',
] as const;

const PostSchema = z.object({
  orgId: z.string().min(1),
  accountId: z.string().min(1),
  kind: z.enum(TX_KINDS),
  amount: z.union([z.string(), z.number()]).transform(String),
  currency: z.string().default('USD'),
  source: z.string().min(1),
  sourceRef: z.string().nullable().optional(),
  description: z.string().optional(),
  approvalId: z.string().nullable().optional(),
  counterAccountId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TransferSchema = z.object({
  orgId: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(String),
  currency: z.string().default('USD'),
  kind: z.enum(TX_KINDS).default('transfer'),
  source: z.string().default('internal'),
  description: z.string().optional(),
  approvalId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function registerTransactionRoutes(app: FastifyInstance, ledger: Ledger) {
  app.post('/credit', async (req, reply) => {
    const parsed = PostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const tx = await ledger.credit(parsed.data);
      return reply.code(201).send(tx);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message, code: (err as { code?: string }).code });
    }
  });

  app.post('/debit', async (req, reply) => {
    const parsed = PostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const tx = await ledger.debit(parsed.data);
      return reply.code(201).send(tx);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message, code: (err as { code?: string }).code });
    }
  });

  app.post('/transfer', async (req, reply) => {
    const parsed = TransferSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const out = await ledger.transfer(parsed.data);
      return reply.code(201).send(out);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message, code: (err as { code?: string }).code });
    }
  });

  app.get<{ Querystring: { accountId?: string; orgId?: string; limit?: string } }>('/transactions', async (req, reply) => {
    if (!req.query.accountId && !req.query.orgId) return reply.code(400).send({ error: 'accountId or orgId required' });
    const orgId = req.query.orgId ?? '';
    const txs = await ledger.listTransactions(
      orgId,
      req.query.accountId,
      req.query.limit ? Number(req.query.limit) : 100,
    );
    return txs;
  });
}
