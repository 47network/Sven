import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  scanSource, listRules, getRule,
  BUILTIN_RULES, type SastRule, type SastReport,
} from '@sven/security-toolkit/sast';
import {
  auditDependencies, matchVulnerabilities, classifyLicense,
  checkTyposquat, type PackageDep, type DepAuditReport,
} from '@sven/security-toolkit/dependency-audit';
import {
  scanForSecrets, type SecretScanReport,
} from '@sven/security-toolkit/secret-scanner';
import {
  auditDockerCompose, auditTlsCerts, auditEnvFile,
  generateInfraReport,
  type DockerComposeService, type TlsCertInfo, type InfraAuditReport,
} from '@sven/security-toolkit/infra-scanner';
import {
  listScenarios, getScenario,
  BUILTIN_SCENARIOS, type PentestReport,
} from '@sven/security-toolkit/pentest';
import {
  generateSecurityPosture, postureToMarkdown,
  type SecurityPosture,
} from '@sven/security-toolkit/report';

const logger = createLogger('gateway-security');

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

export async function registerSecurityToolkitRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── SAST ────────────────────────────────────────────────────────────
  app.post('/v1/security/sast/scan', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { source, file_path = 'unknown.ts', rules } = request.body as Record<string, any>;
    if (!source || typeof source !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'source string required' } });
    }
    try {
      const findings = scanSource(source, file_path, rules || BUILTIN_RULES);
      const scanId = uuidv7();
      try {
        await pool.query(
          `INSERT INTO security_scans (id, org_id, user_id, scan_type, target, findings, severity_summary, created_at)
           VALUES ($1, $2, $3, 'sast', $4, $5, $6, NOW())`,
          [scanId, orgId, request.userId, file_path, JSON.stringify(findings), JSON.stringify({ total: findings.length })],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { scan_id: scanId, findings, total: findings.length } };
    } catch (err) {
      logger.error('security/sast/scan error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'SAST scan failed' } });
    }
  });

  app.get('/v1/security/sast/rules', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const rules = listRules();
      return { success: true, data: rules };
    } catch (err) {
      logger.error('security/sast/rules error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list SAST rules' } });
    }
  });

  // ── Dependency Audit ────────────────────────────────────────────────
  app.post('/v1/security/dependencies/audit', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { dependencies } = request.body as Record<string, any>;
    if (!Array.isArray(dependencies) || dependencies.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'dependencies array required' } });
    }
    try {
      const deps: PackageDep[] = dependencies.map((d: Record<string, any>) => ({
        name: d.name,
        version: d.version,
        isDev: d.is_dev || false,
      }));
      const report = auditDependencies(deps);
      return { success: true, data: report };
    } catch (err) {
      logger.error('security/dependencies/audit error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Dependency audit failed' } });
    }
  });

  app.post('/v1/security/dependencies/typosquat', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { package_name } = request.body as Record<string, any>;
    if (!package_name || typeof package_name !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'package_name string required' } });
    }
    try {
      const result = checkTyposquat(package_name);
      return { success: true, data: result };
    } catch (err) {
      logger.error('security/dependencies/typosquat error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Typosquat check failed' } });
    }
  });

  // ── Secret Scanning ─────────────────────────────────────────────────
  app.post('/v1/security/secrets/scan', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { content, file_path = 'unknown' } = request.body as Record<string, any>;
    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }
    try {
      const files = new Map<string, string>([[file_path, content]]);
      const report = scanForSecrets(files);
      return { success: true, data: report };
    } catch (err) {
      logger.error('security/secrets/scan error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Secret scan failed' } });
    }
  });

  // ── Infrastructure Scanning ─────────────────────────────────────────
  app.post('/v1/security/infra/docker', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { services } = request.body as Record<string, any>;
    if (!Array.isArray(services) || services.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'services array required' } });
    }
    try {
      const findings = auditDockerCompose(services as DockerComposeService[]);
      const report = generateInfraReport(findings);
      return { success: true, data: report };
    } catch (err) {
      logger.error('security/infra/docker error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Docker audit failed' } });
    }
  });

  app.post('/v1/security/infra/tls', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { certs } = request.body as Record<string, any>;
    if (!Array.isArray(certs) || certs.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'certs array required' } });
    }
    try {
      const findings = auditTlsCerts(certs as TlsCertInfo[]);
      const report = generateInfraReport(findings);
      return { success: true, data: report };
    } catch (err) {
      logger.error('security/infra/tls error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'TLS audit failed' } });
    }
  });

  app.post('/v1/security/infra/env', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { content, file_path = '.env' } = request.body as Record<string, any>;
    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }
    try {
      const findings = auditEnvFile(content, file_path);
      const report = generateInfraReport(findings);
      return { success: true, data: report };
    } catch (err) {
      logger.error('security/infra/env error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Env file audit failed' } });
    }
  });

  // ── Pentest Scenarios ───────────────────────────────────────────────
  app.get('/v1/security/pentest/scenarios', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const scenarios = listScenarios();
      return { success: true, data: scenarios };
    } catch (err) {
      logger.error('security/pentest/scenarios error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list scenarios' } });
    }
  });

  app.get('/v1/security/pentest/scenarios/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as Record<string, string>;
    try {
      const scenario = getScenario(id);
      if (!scenario) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Scenario "${id}" not found` } });
      }
      return { success: true, data: scenario };
    } catch (err) {
      logger.error('security/pentest/scenarios/:id error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get scenario' } });
    }
  });

  // ── Security Posture ────────────────────────────────────────────────
  app.post('/v1/security/posture', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    try {
      const posture = generateSecurityPosture({
        sast: body.sast || null,
        dependencies: body.dependencies || null,
        secrets: body.secrets || null,
        infrastructure: body.infrastructure || null,
        pentest: body.pentest || null,
      });
      const markdown = postureToMarkdown(posture);
      return { success: true, data: { posture, markdown } };
    } catch (err) {
      logger.error('security/posture error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Security posture generation failed' } });
    }
  });

  app.get('/v1/security/scans', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, scan_type, target, severity_summary, created_at FROM security_scans WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Security scans schema not available' } });
      }
      throw err;
    }
  });

  logger.info('Security Toolkit routes registered (/v1/security/*)');
}
