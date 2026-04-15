import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  listStandardGates, getStandardGate,
  type GateMatrix,
} from '@sven/quantum-sim/gates';
import {
  createCircuit, addGate, simulate, measure, measureMultiple,
  applyNoise, circuitToAscii, estimateQuantumVolume,
  type QuantumCircuit, type SimulationResult, type NoiseModel,
} from '@sven/quantum-sim/simulator';
import {
  runQAOA, runGroverSearch, generateQuantumRandom,
  runQuantumAnnealing, optimizePortfolio,
  type QAOAProblem, type AnnealingProblem,
} from '@sven/quantum-sim/algorithms';
import {
  listBackends, getBackend, estimateCost,
  type BackendProfile,
} from '@sven/quantum-sim/hardware';

const logger = createLogger('gateway-quantum');

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

async function requireTenantMembership(pool: pg.Pool, request: any, reply: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  const userId = String(request.userId || '').trim();
  if (!orgId) {
    reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    return null;
  }
  const membership = await pool.query(
    `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [orgId, userId],
  );
  if (membership.rows.length === 0) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Active organization membership required' } });
    return null;
  }
  return orgId;
}

export async function registerQuantumRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Gates ───────────────────────────────────────────────────────────
  app.get('/v1/quantum/gates', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const gates = listStandardGates();
      return { success: true, data: gates };
    } catch (err) {
      logger.error('quantum/gates error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list gates' } });
    }
  });

  app.get('/v1/quantum/gates/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as Record<string, string>;
    try {
      const gate = getStandardGate(id);
      if (!gate) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Gate "${id}" not found` } });
      }
      return { success: true, data: gate };
    } catch (err) {
      logger.error('quantum/gates/:id error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get gate' } });
    }
  });

  // ── Circuit Simulation ──────────────────────────────────────────────
  app.post('/v1/quantum/simulate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { num_qubits = 2, gates: gateOps = [], shots = 1024, noise } = request.body as Record<string, any>;
    if (num_qubits < 1 || num_qubits > 20) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'num_qubits must be between 1 and 20' } });
    }
    try {
      let circuit = createCircuit(num_qubits);
      for (const op of gateOps) {
        const gate = getStandardGate(op.gate);
        if (!gate) {
          return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `Unknown gate: ${op.gate}` } });
        }
        circuit = addGate(circuit, gate, op.qubits);
      }
      const result = simulate(circuit);
      let probabilities = result.probabilities;
      if (noise) {
        probabilities = applyNoise(probabilities, noise as NoiseModel);
      }
      const measurements = measureMultiple({ ...result, probabilities }, shots);
      const ascii = circuitToAscii(circuit);
      const jobId = uuidv7();
      try {
        await pool.query(
          `INSERT INTO quantum_jobs (id, org_id, user_id, circuit_def, backend, status, result, created_at)
           VALUES ($1, $2, $3, $4, 'local_sim', 'completed', $5, NOW())`,
          [jobId, orgId, request.userId, JSON.stringify({ num_qubits, gates: gateOps }), JSON.stringify({ probabilities, measurements: Object.fromEntries(measurements) })],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { job_id: jobId, probabilities, measurements: Object.fromEntries(measurements), ascii } };
    } catch (err) {
      logger.error('quantum/simulate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Simulation failed' } });
    }
  });

  app.post('/v1/quantum/volume', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { qubits = 5, gate_error_rate = 0.001 } = request.body as Record<string, any>;
    try {
      const profile = estimateQuantumVolume(qubits, gate_error_rate);
      return { success: true, data: profile };
    } catch (err) {
      logger.error('quantum/volume error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Quantum volume estimation failed' } });
    }
  });

  // ── Algorithms ──────────────────────────────────────────────────────
  app.post('/v1/quantum/qaoa', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { problem, layers = 3, shots = 1024 } = request.body as Record<string, any>;
    if (!problem) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'problem object required' } });
    }
    try {
      const result = runQAOA(problem as QAOAProblem, layers, shots);
      return { success: true, data: result };
    } catch (err) {
      logger.error('quantum/qaoa error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'QAOA failed' } });
    }
  });

  app.post('/v1/quantum/grover', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { num_qubits = 4, target_index, shots = 1024 } = request.body as Record<string, any>;
    if (target_index === undefined || typeof target_index !== 'number') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target_index number required' } });
    }
    try {
      const result = runGroverSearch(num_qubits, target_index, shots);
      return { success: true, data: result };
    } catch (err) {
      logger.error('quantum/grover error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Grover search failed' } });
    }
  });

  app.post('/v1/quantum/random', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { num_bits = 256 } = request.body as Record<string, any>;
    if (num_bits < 1 || num_bits > 4096) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'num_bits must be between 1 and 4096' } });
    }
    try {
      const result = generateQuantumRandom(num_bits);
      return { success: true, data: result };
    } catch (err) {
      logger.error('quantum/random error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'QRNG failed' } });
    }
  });

  app.post('/v1/quantum/annealing', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { problem, max_iterations = 1000 } = request.body as Record<string, any>;
    if (!problem) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'problem object required' } });
    }
    try {
      const result = runQuantumAnnealing(problem as AnnealingProblem, max_iterations);
      return { success: true, data: result };
    } catch (err) {
      logger.error('quantum/annealing error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Quantum annealing failed' } });
    }
  });

  app.post('/v1/quantum/portfolio', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { returns, covariance, risk_tolerance = 0.5 } = request.body as Record<string, any>;
    if (!Array.isArray(returns) || !Array.isArray(covariance)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'returns array and covariance matrix required' } });
    }
    try {
      const result = optimizePortfolio(returns, covariance, risk_tolerance);
      return { success: true, data: result };
    } catch (err) {
      logger.error('quantum/portfolio error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Portfolio optimization failed' } });
    }
  });

  // ── Hardware Backends ───────────────────────────────────────────────
  app.get('/v1/quantum/backends', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const backends = listBackends();
      return { success: true, data: backends };
    } catch (err) {
      logger.error('quantum/backends error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list backends' } });
    }
  });

  app.post('/v1/quantum/cost-estimate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { backend_id, num_qubits, num_gates, shots } = request.body as Record<string, any>;
    if (!backend_id) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'backend_id required' } });
    }
    try {
      const backend = getBackend(backend_id);
      if (!backend) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Backend "${backend_id}" not found` } });
      }
      const cost = estimateCost(backend_id, num_qubits || 5, num_gates || 10, shots || 1024);
      return { success: true, data: cost };
    } catch (err) {
      logger.error('quantum/cost-estimate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Cost estimation failed' } });
    }
  });

  app.get('/v1/quantum/jobs', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, backend, status, created_at FROM quantum_jobs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Quantum jobs schema not available' } });
      }
      throw err;
    }
  });

  logger.info('Quantum Simulation routes registered (/v1/quantum/*)');
}
