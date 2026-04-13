import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  hexToOklch, oklchToHex, generateHarmony, generatePalette,
  generateTheme, evaluateContrast, simulateColorBlindness,
  themeToCSS, type ColorBlindnessType,
} from '@sven/design-system/color';
import {
  generateTypeScale, getFontPairing, getAvailableMoods,
  analyzeReadability, typeScaleToCSS,
} from '@sven/design-system/typography';
import {
  getEasing, simulateSpring, composeAnimation,
  generateStagger, type AnimationIntent,
} from '@sven/design-system/motion';
import {
  generateSpacingScale, generateGrid, generateAutoFitGrid,
  getLayoutPattern, getLayoutPatterns, getZIndexLayers,
  spacingScaleToCSS,
} from '@sven/design-system/layout';

const logger = createLogger('gateway-design');

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

export async function registerDesignRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Color ───────────────────────────────────────────────────────────
  app.post('/v1/design/color/palette', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { seed_hex = '#6366f1', harmony = 'analogous', name } = request.body as Record<string, any>;
    try {
      const palette = generatePalette(seed_hex, harmony, name);
      return { success: true, data: palette };
    } catch (err) {
      logger.error('design/color/palette error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Palette generation failed' } });
    }
  });

  app.post('/v1/design/color/theme', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { seed_hex = '#6366f1' } = request.body as Record<string, any>;
    try {
      const theme = generateTheme(seed_hex);
      const css = themeToCSS(theme);
      return { success: true, data: { theme, css } };
    } catch (err) {
      logger.error('design/color/theme error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Theme generation failed' } });
    }
  });

  app.post('/v1/design/color/contrast', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { foreground, background } = request.body as Record<string, any>;
    if (!foreground || !background) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'foreground and background hex colors required' } });
    }
    try {
      const result = evaluateContrast(foreground, background);
      return { success: true, data: result };
    } catch (err) {
      logger.error('design/color/contrast error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Contrast check failed' } });
    }
  });

  app.post('/v1/design/color/blindness', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { hex, type = 'deuteranopia' } = request.body as Record<string, any>;
    if (!hex) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'hex color required' } });
    }
    try {
      const simulated = simulateColorBlindness(hex, type as ColorBlindnessType);
      return { success: true, data: { original: hex, simulated, type } };
    } catch (err) {
      logger.error('design/color/blindness error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Color blindness simulation failed' } });
    }
  });

  // ── Typography ──────────────────────────────────────────────────────
  app.post('/v1/design/typography/scale', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { base_size = 16, ratio = 'major-third' } = request.body as Record<string, any>;
    try {
      const scale = generateTypeScale(base_size, ratio);
      const css = typeScaleToCSS(scale);
      return { success: true, data: { scale, css } };
    } catch (err) {
      logger.error('design/typography/scale error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Type scale generation failed' } });
    }
  });

  app.post('/v1/design/typography/pairing', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { mood = 'professional' } = request.body as Record<string, any>;
    try {
      const pairing = getFontPairing(mood);
      const moods = getAvailableMoods();
      if (!pairing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `No pairing for mood "${mood}". Available: ${moods.join(', ')}` } });
      }
      return { success: true, data: { pairing, available_moods: moods } };
    } catch (err) {
      logger.error('design/typography/pairing error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Font pairing failed' } });
    }
  });

  app.post('/v1/design/typography/readability', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { font_size = 16, line_height = 1.5, line_width_chars = 75, letter_spacing = 0 } = request.body as Record<string, any>;
    try {
      const analysis = analyzeReadability({ fontSizePx: font_size, lineHeight: line_height, lineWidthChars: line_width_chars, letterSpacingEm: letter_spacing });
      return { success: true, data: analysis };
    } catch (err) {
      logger.error('design/typography/readability error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Readability analysis failed' } });
    }
  });

  // ── Motion ──────────────────────────────────────────────────────────
  app.post('/v1/design/motion/animate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { intent = 'enter', category = 'medium' } = request.body as Record<string, any>;
    try {
      const spec = composeAnimation(intent as AnimationIntent, category);
      return { success: true, data: spec };
    } catch (err) {
      logger.error('design/motion/animate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Animation composition failed' } });
    }
  });

  app.post('/v1/design/motion/spring', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { stiffness = 170, damping = 26, mass = 1, from = 0, to = 1, steps = 60 } = request.body as Record<string, any>;
    try {
      const keyframes = simulateSpring({ stiffness, damping, mass }, from, to, steps);
      return { success: true, data: keyframes };
    } catch (err) {
      logger.error('design/motion/spring error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Spring simulation failed' } });
    }
  });

  app.post('/v1/design/motion/stagger', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { count = 5, base_delay = 50, pattern = 'sequential' } = request.body as Record<string, any>;
    try {
      const stagger = generateStagger(count, base_delay, pattern);
      return { success: true, data: stagger };
    } catch (err) {
      logger.error('design/motion/stagger error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Stagger generation failed' } });
    }
  });

  // ── Layout ──────────────────────────────────────────────────────────
  app.post('/v1/design/layout/spacing', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { base_px = 4, method = 'linear' } = request.body as Record<string, any>;
    try {
      const scale = generateSpacingScale(base_px, method);
      const css = spacingScaleToCSS(scale);
      return { success: true, data: { scale, css } };
    } catch (err) {
      logger.error('design/layout/spacing error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Spacing scale generation failed' } });
    }
  });

  app.post('/v1/design/layout/grid', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { columns = 12, gap_px = 16, max_width_px = 1280 } = request.body as Record<string, any>;
    try {
      const grid = generateGrid(columns, gap_px, max_width_px);
      return { success: true, data: grid };
    } catch (err) {
      logger.error('design/layout/grid error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Grid generation failed' } });
    }
  });

  app.post('/v1/design/layout/pattern', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { name } = request.body as Record<string, any>;
    if (name) {
      const pattern = getLayoutPattern(name);
      if (!pattern) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Layout pattern not found' } });
      }
      return { success: true, data: pattern };
    }
    const patterns = getLayoutPatterns();
    return { success: true, data: { patterns } };
  });

  // ── Design Audit ────────────────────────────────────────────────────
  app.post('/v1/design/audit', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { colors = [], font_sizes = [], seed_hex } = request.body as Record<string, any>;
    try {
      const findings: Record<string, any> = {};
      if (colors.length >= 2) {
        findings.contrast = evaluateContrast(colors[0], colors[1]);
      }
      if (seed_hex) {
        findings.theme = generateTheme(seed_hex);
      }
      findings.z_index_layers = getZIndexLayers();
      const auditId = uuidv7();
      try {
        await pool.query(
          `INSERT INTO design_audits (id, org_id, user_id, scope, findings, score, created_at)
           VALUES ($1, $2, $3, 'full', $4, $5, NOW())`,
          [auditId, orgId, request.userId, JSON.stringify(findings), findings.contrast?.ratio || 0],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { audit_id: auditId, findings } };
    } catch (err) {
      logger.error('design/audit error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Design audit failed' } });
    }
  });

  app.get('/v1/design/audit/history', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, scope, score, created_at FROM design_audits WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Design audit schema not available' } });
      }
      throw err;
    }
  });

  logger.info('Design Intelligence routes registered (/v1/design/*)');
}
