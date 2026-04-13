import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  createProfile, classifyImpact as classifyCompetitiveImpact,
  generateWeeklyReport, buildThreatMatrix,
  type CompetitorProfile,
} from '@sven/marketing-intel/competitive-intel';
import {
  checkBrandVoice, DEFAULT_47NETWORK_BRAND,
  type BrandProfile,
} from '@sven/marketing-intel/brand-voice';
import {
  createBrief, createContentPiece, analyzeContent,
  generateCalendar,
  type ContentType, type Channel, type ContentBrief,
} from '@sven/marketing-intel/content-generator';
import {
  createCampaign, scoreCampaign, generateTimeline,
  campaignToMarkdown,
  type Campaign,
} from '@sven/marketing-intel/campaign-planner';
import {
  listConversationScenarios, getScenario,
  analyzeConversationTurn, generateDebrief,
} from '@sven/marketing-intel/communication-coach';
import {
  calculateChannelMetrics, aggregateMetrics,
  generateMarketingReport,
  type ChannelMetrics, type MetricPeriod,
} from '@sven/marketing-intel/analytics';

const logger = createLogger('gateway-marketing');

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

export async function registerMarketingRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Competitive Intelligence ────────────────────────────────────────
  app.post('/v1/marketing/competitors', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { name, website, positioning, strengths, weaknesses } = request.body as Record<string, any>;
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name string required' } });
    }
    try {
      const profile = createProfile(name, { website, description: positioning });
      try {
        await pool.query(
          `INSERT INTO marketing_competitors (id, org_id, name, website, profile, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [profile.id, orgId, name, website || null, JSON.stringify(profile)],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: profile };
    } catch (err) {
      logger.error('marketing/competitors error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Competitor profile creation failed' } });
    }
  });

  app.get('/v1/marketing/competitors', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, website, profile, created_at FROM marketing_competitors WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Marketing competitors schema not available' } });
      }
      throw err;
    }
  });

  app.post('/v1/marketing/competitors/threat-matrix', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { competitors, current_signals = [], previous_signals = [] } = request.body as Record<string, any>;
    if (!Array.isArray(competitors) || competitors.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'competitors array required' } });
    }
    try {
      const matrix = buildThreatMatrix(competitors as CompetitorProfile[], current_signals, previous_signals);
      return { success: true, data: matrix };
    } catch (err) {
      logger.error('marketing/competitors/threat-matrix error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Threat matrix generation failed' } });
    }
  });

  // ── Brand Voice ─────────────────────────────────────────────────────
  app.post('/v1/marketing/brand/check', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { content, profile } = request.body as Record<string, any>;
    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }
    try {
      const result = checkBrandVoice(content, profile || DEFAULT_47NETWORK_BRAND);
      return { success: true, data: result };
    } catch (err) {
      logger.error('marketing/brand/check error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Brand voice check failed' } });
    }
  });

  // ── Content Generator ───────────────────────────────────────────────
  app.post('/v1/marketing/content/brief', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { content_type, channel, title, target_audience, key_points, tone, keywords } = request.body as Record<string, any>;
    if (!content_type || !channel || !title) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content_type, channel, and title required' } });
    }
    try {
      const brief = createBrief(
        content_type as ContentType,
        channel as Channel,
        title,
        { targetAudience: target_audience, keyPoints: key_points, tone, keywords },
      );
      return { success: true, data: brief };
    } catch (err) {
      logger.error('marketing/content/brief error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Content brief creation failed' } });
    }
  });

  app.post('/v1/marketing/content/create', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { brief, body } = request.body as Record<string, any>;
    if (!brief || !body || typeof body !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'brief object and body string required' } });
    }
    try {
      const piece = createContentPiece(brief as ContentBrief, body);
      try {
        await pool.query(
          `INSERT INTO marketing_content (id, org_id, content_type, channel, title, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [piece.id, orgId, piece.brief.contentType, piece.brief.channel, piece.brief.title, piece.status],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: piece };
    } catch (err) {
      logger.error('marketing/content/create error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Content creation failed' } });
    }
  });

  app.post('/v1/marketing/content/analyze', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { body, brief } = request.body as Record<string, any>;
    if (!body || typeof body !== 'string' || !brief) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'body string and brief object required' } });
    }
    try {
      const analysis = analyzeContent(body, brief as ContentBrief);
      return { success: true, data: analysis };
    } catch (err) {
      logger.error('marketing/content/analyze error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Content analysis failed' } });
    }
  });

  app.post('/v1/marketing/content/calendar', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { channels, start_date, weeks = 4 } = request.body as Record<string, any>;
    if (!Array.isArray(channels) || !start_date) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channels array and start_date required' } });
    }
    try {
      const calendar = generateCalendar(start_date, weeks, channels as Channel[]);
      return { success: true, data: calendar };
    } catch (err) {
      logger.error('marketing/content/calendar error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Calendar generation failed' } });
    }
  });

  // ── Campaigns ───────────────────────────────────────────────────────
  app.post('/v1/marketing/campaigns', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { name, goals, budget, channels, target_audience } = request.body as Record<string, any>;
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name string required' } });
    }
    try {
      const campaign = createCampaign(name, { goals, budget, channels, targetAudience: target_audience });
      const score = scoreCampaign(campaign);
      try {
        await pool.query(
          `INSERT INTO marketing_campaigns (id, org_id, name, status, score, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [campaign.id, orgId, name, campaign.status, score.overall],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { campaign, score } };
    } catch (err) {
      logger.error('marketing/campaigns error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Campaign creation failed' } });
    }
  });

  app.get('/v1/marketing/campaigns', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, status, score, created_at FROM marketing_campaigns WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Marketing campaigns schema not available' } });
      }
      throw err;
    }
  });

  // ── Communication Coach ─────────────────────────────────────────────
  app.get('/v1/marketing/coaching/scenarios', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const scenarios = listConversationScenarios();
      return { success: true, data: scenarios };
    } catch (err) {
      logger.error('marketing/coaching/scenarios error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list scenarios' } });
    }
  });

  app.get('/v1/marketing/coaching/scenarios/:id', { preHandler: [requireAuth] }, async (request, reply) => {
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
      logger.error('marketing/coaching/scenarios/:id error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get scenario' } });
    }
  });

  app.post('/v1/marketing/coaching/analyze-turn', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { message, context } = request.body as Record<string, any>;
    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'message string required' } });
    }
    try {
      const analysis = analyzeConversationTurn(message, context || {});
      return { success: true, data: analysis };
    } catch (err) {
      logger.error('marketing/coaching/analyze-turn error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Turn analysis failed' } });
    }
  });

  // ── Analytics ───────────────────────────────────────────────────────
  app.post('/v1/marketing/analytics/channel', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { channel, data } = request.body as Record<string, any>;
    if (!channel || !data) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel and data required' } });
    }
    try {
      const metrics = calculateChannelMetrics(channel, data);
      return { success: true, data: metrics };
    } catch (err) {
      logger.error('marketing/analytics/channel error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Channel metrics calculation failed' } });
    }
  });

  app.post('/v1/marketing/analytics/aggregate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { channel_data, period = 'monthly', start_date, end_date } = request.body as Record<string, any>;
    if (!Array.isArray(channel_data) || !start_date || !end_date) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel_data array, start_date, and end_date required' } });
    }
    try {
      const totals = aggregateMetrics(channel_data as ChannelMetrics[], period as MetricPeriod, start_date, end_date);
      return { success: true, data: totals };
    } catch (err) {
      logger.error('marketing/analytics/aggregate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Metrics aggregation failed' } });
    }
  });

  logger.info('Marketing Intelligence routes registered (/v1/marketing/*)');
}
