import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pg from 'pg';
import { GuideAgentService } from '../../services/GuideAgentService.js';
import { InspectorAgentService } from '../../services/InspectorAgentService.js';
import { CuratorAgentService } from '../../services/CuratorAgentService.js';
import { AdvocateAgentService } from '../../services/AdvocateAgentService.js';
import { QAAgentService } from '../../services/QAAgentService.js';
import { LibrarianAgentService } from '../../services/LibrarianAgentService.js';
import { FeatureTesterAgentService } from '../../services/FeatureTesterAgentService.js';
import { FeatureImaginationAgentService } from '../../services/FeatureImaginationAgentService.js';

/* ------------------------------------------------------------------ */
/*  Admin routes for managing the 8 community agent types              */
/*  (Guide, Inspector, Curator, Advocate, QA, Librarian, Tester,       */
/*   Imagination)                                                      */
/* ------------------------------------------------------------------ */

export async function registerAgentTypeRoutes(app: FastifyInstance): Promise<void> {
  const pool: pg.Pool = (app as unknown as { pg: pg.Pool }).pg;

  const guideSvc = new GuideAgentService(pool);
  const inspectorSvc = new InspectorAgentService(pool);
  const curatorSvc = new CuratorAgentService(pool);
  const advocateSvc = new AdvocateAgentService(pool);
  const qaSvc = new QAAgentService(pool);
  const librarianSvc = new LibrarianAgentService(pool);
  const testerSvc = new FeatureTesterAgentService(pool);
  const imaginationSvc = new FeatureImaginationAgentService(pool);

  function getOrgId(req: FastifyRequest): string {
    return (req as unknown as { orgId: string }).orgId;
  }

  /* ================================================================ */
  /*  GUIDE AGENT                                                      */
  /* ================================================================ */

  app.post('/community-agents/agents/guide/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await guideSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/guide/welcome/:userId', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { userId } = req.params as { userId: string };
    const welcome = await guideSvc.generateWelcome(orgId, userId);
    return reply.send(welcome);
  });

  app.post('/community-agents/agents/guide/answer', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { question } = req.body as { question: string };
    if (!question || typeof question !== 'string') return reply.code(400).send({ error: 'question is required' });
    const result = await guideSvc.answerFAQ(orgId, question);
    return reply.send(result);
  });

  app.post('/community-agents/agents/guide/faq', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as { agent_id: string; question: string; answer: string; source_type?: string; source_id?: string; category?: string };
    if (!body.agent_id || !body.question || !body.answer) {
      return reply.code(400).send({ error: 'agent_id, question, and answer are required' });
    }
    const entry = await guideSvc.addFAQEntry(orgId, body);
    return reply.code(201).send(entry);
  });

  app.get('/community-agents/agents/guide/faq', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { category, limit, offset } = req.query as { category?: string; limit?: string; offset?: string };
    const result = await guideSvc.listFAQEntries(orgId, {
      category,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.get('/community-agents/agents/guide/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const stats = await guideSvc.getStats(orgId);
    return reply.send(stats);
  });

  /* ================================================================ */
  /*  INSPECTOR AGENT                                                  */
  /* ================================================================ */

  app.post('/community-agents/agents/inspector/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await inspectorSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/inspector/check', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { agent_id, capability_name } = req.body as { agent_id: string; capability_name: string };
    if (!agent_id || !capability_name) return reply.code(400).send({ error: 'agent_id and capability_name are required' });
    const report = await inspectorSvc.runCapabilityCheck(orgId, agent_id, capability_name);
    return reply.code(201).send(report);
  });

  app.post('/community-agents/agents/inspector/scan', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { agent_id } = req.body as { agent_id: string };
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const reports = await inspectorSvc.runFullScan(orgId, agent_id);
    return reply.send({ reports });
  });

  app.get('/community-agents/agents/inspector/reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { capability, status, limit, offset } = req.query as {
      capability?: string; status?: string; limit?: string; offset?: string;
    };
    const result = await inspectorSvc.listReports(orgId, {
      capability, status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.get('/community-agents/agents/inspector/health-summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const summary = await inspectorSvc.getHealthSummary(orgId);
    return reply.send(summary);
  });

  /* ================================================================ */
  /*  CURATOR AGENT                                                    */
  /* ================================================================ */

  app.post('/community-agents/agents/curator/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await curatorSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/curator/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { agent_id } = req.body as { agent_id: string };
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const highlights = await curatorSvc.analyzeAndHighlight(orgId, agent_id);
    return reply.send({ highlights });
  });

  app.post('/community-agents/agents/curator/highlights', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as {
      agent_id: string; source_type: string; source_id?: string;
      title: string; summary: string; significance_score?: number; tags?: string[];
    };
    if (!body.agent_id || !body.source_type || !body.title || !body.summary) {
      return reply.code(400).send({ error: 'agent_id, source_type, title, and summary are required' });
    }
    const highlight = await curatorSvc.createHighlight(orgId, body);
    return reply.code(201).send(highlight);
  });

  app.get('/community-agents/agents/curator/highlights', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { published_only, min_significance, limit, offset } = req.query as {
      published_only?: string; min_significance?: string; limit?: string; offset?: string;
    };
    const result = await curatorSvc.listHighlights(orgId, {
      published_only: published_only === 'true',
      min_significance: min_significance ? parseFloat(min_significance) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.patch('/community-agents/agents/curator/highlights/:highlightId/publish', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { highlightId } = req.params as { highlightId: string };
    const result = await curatorSvc.publishHighlight(orgId, highlightId);
    if (!result) return reply.code(404).send({ error: 'Highlight not found' });
    return reply.send(result);
  });

  app.get('/community-agents/agents/curator/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const summary = await curatorSvc.getInsightSummary(orgId);
    return reply.send(summary);
  });

  /* ================================================================ */
  /*  ADVOCATE AGENT                                                   */
  /* ================================================================ */

  app.post('/community-agents/agents/advocate/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await advocateSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/advocate/surface-requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { agent_id } = req.body as { agent_id: string };
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const requests = await advocateSvc.surfaceFeatureRequests(orgId, agent_id);
    return reply.send({ requests });
  });

  app.post('/community-agents/agents/advocate/feature-requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as {
      agent_id: string; title: string; description: string;
      priority?: string; source_pattern_id?: string; source_feedback_ids?: string[];
    };
    if (!body.agent_id || !body.title || !body.description) {
      return reply.code(400).send({ error: 'agent_id, title, and description are required' });
    }
    const fr = await advocateSvc.createFeatureRequest(orgId, body);
    return reply.code(201).send(fr);
  });

  app.get('/community-agents/agents/advocate/feature-requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { status, priority, limit, offset } = req.query as {
      status?: string; priority?: string; limit?: string; offset?: string;
    };
    const result = await advocateSvc.listFeatureRequests(orgId, {
      status, priority,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.patch('/community-agents/agents/advocate/feature-requests/:requestId/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { requestId } = req.params as { requestId: string };
    const { status } = req.body as { status: string };
    if (!status) return reply.code(400).send({ error: 'status is required' });
    const result = await advocateSvc.updateRequestStatus(orgId, requestId, status);
    if (!result) return reply.code(404).send({ error: 'Feature request not found' });
    return reply.send(result);
  });

  app.post('/community-agents/agents/advocate/feature-requests/:requestId/vote', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { requestId } = req.params as { requestId: string };
    const result = await advocateSvc.voteForRequest(orgId, requestId);
    if (!result) return reply.code(404).send({ error: 'Feature request not found' });
    return reply.send(result);
  });

  app.get('/community-agents/agents/advocate/roadmap-summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const summary = await advocateSvc.getRoadmapSummary(orgId);
    return reply.send(summary);
  });

  /* ================================================================ */
  /*  QA AGENT                                                         */
  /* ================================================================ */

  app.post('/community-agents/agents/qa/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await qaSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/qa/bug-reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as {
      agent_id: string; title: string; description: string; severity?: string;
      reproduction_steps?: unknown[]; affected_capability?: string;
      test_evidence?: Record<string, unknown>; linked_report_id?: string;
    };
    if (!body.agent_id || !body.title || !body.description) {
      return reply.code(400).send({ error: 'agent_id, title, and description are required' });
    }
    const report = await qaSvc.fileBugReport(orgId, body);
    return reply.code(201).send(report);
  });

  app.get('/community-agents/agents/qa/bug-reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { status, severity, capability, limit, offset } = req.query as {
      status?: string; severity?: string; capability?: string; limit?: string; offset?: string;
    };
    const result = await qaSvc.listBugReports(orgId, {
      status, severity, capability,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.patch('/community-agents/agents/qa/bug-reports/:bugId/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { bugId } = req.params as { bugId: string };
    const { status } = req.body as { status: string };
    if (!status) return reply.code(400).send({ error: 'status is required' });
    const result = await qaSvc.updateBugStatus(orgId, bugId, status);
    if (!result) return reply.code(404).send({ error: 'Bug report not found' });
    return reply.send(result);
  });

  app.get('/community-agents/agents/qa/quality-metrics', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const metrics = await qaSvc.getQualityMetrics(orgId);
    return reply.send(metrics);
  });

  /* ================================================================ */
  /*  LIBRARIAN AGENT                                                  */
  /* ================================================================ */

  app.post('/community-agents/agents/librarian/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await librarianSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/librarian/index', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as {
      agent_id: string; topic: string; summary: string; content?: string;
      source_refs?: unknown[]; related_topics?: string[]; entry_type?: string;
    };
    if (!body.agent_id || !body.topic || !body.summary) {
      return reply.code(400).send({ error: 'agent_id, topic, and summary are required' });
    }
    const entry = await librarianSvc.indexTopic(orgId, body);
    return reply.code(201).send(entry);
  });

  app.get('/community-agents/agents/librarian/index', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { entry_type, published_only, limit, offset } = req.query as {
      entry_type?: string; published_only?: string; limit?: string; offset?: string;
    };
    const result = await librarianSvc.listIndex(orgId, {
      entry_type,
      published_only: published_only === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.get('/community-agents/agents/librarian/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { q, limit } = req.query as { q?: string; limit?: string };
    if (!q) return reply.code(400).send({ error: 'q query parameter is required' });
    const entries = await librarianSvc.searchIndex(orgId, q, limit ? parseInt(limit, 10) : undefined);
    return reply.send({ entries });
  });

  app.post('/community-agents/agents/librarian/index/:entryId/link', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { entryId } = req.params as { entryId: string };
    const { related_entry_ids } = req.body as { related_entry_ids: string[] };
    if (!Array.isArray(related_entry_ids) || related_entry_ids.length === 0) {
      return reply.code(400).send({ error: 'related_entry_ids array is required' });
    }
    const result = await librarianSvc.linkRelatedTopics(orgId, entryId, related_entry_ids);
    if (!result) return reply.code(404).send({ error: 'Entry not found' });
    return reply.send(result);
  });

  app.patch('/community-agents/agents/librarian/index/:entryId/publish', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { entryId } = req.params as { entryId: string };
    const result = await librarianSvc.publishEntry(orgId, entryId);
    if (!result) return reply.code(404).send({ error: 'Entry not found' });
    return reply.send(result);
  });

  app.get('/community-agents/agents/librarian/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const stats = await librarianSvc.getIndexStats(orgId);
    return reply.send(stats);
  });

  /* ================================================================ */
  /*  FEATURE TESTER AGENT                                             */
  /* ================================================================ */

  app.post('/community-agents/agents/tester/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await testerSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/tester/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as {
      agent_id: string; scenario_type?: string; title: string; description: string;
      steps?: unknown[]; expected_outcomes?: unknown[]; imagined_by?: string;
    };
    if (!body.agent_id || !body.title || !body.description) {
      return reply.code(400).send({ error: 'agent_id, title, and description are required' });
    }
    const scenario = await testerSvc.createScenario(orgId, body);
    return reply.code(201).send(scenario);
  });

  app.get('/community-agents/agents/tester/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { status, scenario_type, limit, offset } = req.query as {
      status?: string; scenario_type?: string; limit?: string; offset?: string;
    };
    const result = await testerSvc.listScenarios(orgId, {
      status, scenario_type,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.post('/community-agents/agents/tester/scenarios/:scenarioId/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { scenarioId } = req.params as { scenarioId: string };
    const { passed, details } = req.body as { passed: boolean; details: Record<string, unknown> };
    if (typeof passed !== 'boolean') return reply.code(400).send({ error: 'passed (boolean) is required' });
    const result = await testerSvc.executeScenario(orgId, scenarioId, { passed, details: details ?? {} });
    if (!result) return reply.code(404).send({ error: 'Scenario not found' });
    return reply.send(result);
  });

  app.get('/community-agents/agents/tester/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const summary = await testerSvc.getTestingSummary(orgId);
    return reply.send(summary);
  });

  /* ================================================================ */
  /*  FEATURE IMAGINATION AGENT                                        */
  /* ================================================================ */

  app.post('/community-agents/agents/imagination/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const id = await imaginationSvc.bootstrap(orgId);
    return reply.code(201).send({ id });
  });

  app.post('/community-agents/agents/imagination/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as {
      agent_id: string; title: string; description: string;
      scenario_type?: string; steps?: unknown[]; expected_outcomes?: unknown[];
    };
    if (!body.agent_id || !body.title || !body.description) {
      return reply.code(400).send({ error: 'agent_id, title, and description are required' });
    }
    const scenario = await imaginationSvc.imagineScenario(orgId, body);
    return reply.code(201).send(scenario);
  });

  app.get('/community-agents/agents/imagination/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { status, limit, offset } = req.query as { status?: string; limit?: string; offset?: string };
    const result = await imaginationSvc.listScenarios(orgId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return reply.send(result);
  });

  app.post('/community-agents/agents/imagination/scenarios/:scenarioId/propose', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { scenarioId } = req.params as { scenarioId: string };
    const { tester_agent_id } = req.body as { tester_agent_id: string };
    if (!tester_agent_id) return reply.code(400).send({ error: 'tester_agent_id is required' });
    const result = await imaginationSvc.proposeToTester(orgId, scenarioId, tester_agent_id);
    if (!result) return reply.code(404).send({ error: 'Scenario not found' });
    return reply.send(result);
  });

  app.get('/community-agents/agents/imagination/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const summary = await imaginationSvc.getCreativeSummary(orgId);
    return reply.send(summary);
  });
}
