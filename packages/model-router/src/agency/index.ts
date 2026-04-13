// ---------------------------------------------------------------------------
// Agency System
// ---------------------------------------------------------------------------
// Manages 120+ autonomous agents across four categories: Code, Research,
// Operations, and Communication. Provides agent spawning, lifecycle
// management, inter-agent communication bus, memory, supervision, and
// resource limits.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type AgentCategory = 'code' | 'research' | 'operations' | 'communication';

export type AgentLifecycle = 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'terminated';

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  category: AgentCategory;
  description: string;
  modelPreference?: string;         // preferred model ID from registry
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  memoryEnabled: boolean;
  timeoutMs: number;
  systemPrompt: string;
  metadata: Record<string, unknown>;
}

export interface AgentInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  category: AgentCategory;
  lifecycle: AgentLifecycle;
  spawnedAt: string;
  lastActivityAt: string;
  taskCount: number;
  errorCount: number;
  memoryKeys: string[];
  parentInstanceId: string | null;   // for supervision tree
  resourceUsage: {
    cpuMs: number;
    memoryMb: number;
    tokensConsumed: number;
  };
}

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  channel: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlationId: string | null;
}

export interface AgentTask {
  id: string;
  agentInstanceId: string;
  description: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

/* ----------------------------------------------- built-in agent catalog */

const CODE_AGENTS: AgentDefinition[] = [
  defAgent('code-writer', 'Code Writer', 'code', 'Generates production code from specifications'),
  defAgent('code-reviewer', 'Code Reviewer', 'code', 'Reviews code for quality, security, and correctness'),
  defAgent('refactorer', 'Refactorer', 'code', 'Refactors code following SOLID and DRY principles'),
  defAgent('debugger', 'Debugger', 'code', 'Diagnoses and fixes bugs with root-cause analysis'),
  defAgent('test-writer', 'Test Writer', 'code', 'Writes unit, integration, and e2e tests'),
  defAgent('api-designer', 'API Designer', 'code', 'Designs REST/GraphQL/gRPC API contracts'),
  defAgent('schema-architect', 'Schema Architect', 'code', 'Designs database schemas and migrations'),
  defAgent('dependency-resolver', 'Dependency Resolver', 'code', 'Resolves dependency conflicts and audits supply chain'),
  defAgent('perf-optimizer', 'Performance Optimizer', 'code', 'Profiles and optimizes hot code paths'),
  defAgent('ci-cd-agent', 'CI/CD Agent', 'code', 'Manages pipeline configs, builds, and deployments'),
];

const RESEARCH_AGENTS: AgentDefinition[] = [
  defAgent('web-researcher', 'Web Researcher', 'research', 'Searches and synthesizes information from the web'),
  defAgent('paper-analyst', 'Paper Analyst', 'research', 'Reads and summarizes academic papers and whitepapers'),
  defAgent('competitor-tracker', 'Competitor Tracker', 'research', 'Monitors competitive landscape and market signals'),
  defAgent('tech-scout', 'Tech Scout', 'research', 'Evaluates emerging technologies and frameworks'),
  defAgent('data-miner', 'Data Miner', 'research', 'Extracts and structures data from unstructured sources'),
  defAgent('trend-analyst', 'Trend Analyst', 'research', 'Identifies patterns and trends in data sets'),
  defAgent('fact-checker', 'Fact Checker', 'research', 'Verifies claims and cross-references sources'),
  defAgent('doc-summarizer', 'Doc Summarizer', 'research', 'Summarizes long documents and generates briefs'),
  defAgent('legal-researcher', 'Legal Researcher', 'research', 'Researches legal requirements, compliance, and regulations'),
  defAgent('market-analyst', 'Market Analyst', 'research', 'Analyzes market data, sentiment, and forecasts'),
];

const OPS_AGENTS: AgentDefinition[] = [
  defAgent('infra-monitor', 'Infra Monitor', 'operations', 'Monitors infrastructure health and alerts on anomalies'),
  defAgent('log-analyst', 'Log Analyst', 'operations', 'Analyzes log streams for errors and patterns'),
  defAgent('incident-responder', 'Incident Responder', 'operations', 'Automates incident response and recovery'),
  defAgent('capacity-planner', 'Capacity Planner', 'operations', 'Plans resource scaling based on usage trends'),
  defAgent('backup-agent', 'Backup Agent', 'operations', 'Manages backup schedules, verification, and restore'),
  defAgent('cert-manager', 'Certificate Manager', 'operations', 'Monitors and rotates TLS certificates'),
  defAgent('dns-manager', 'DNS Manager', 'operations', 'Manages DNS records and propagation'),
  defAgent('cost-optimizer', 'Cost Optimizer', 'operations', 'Identifies cost reduction opportunities across infra'),
  defAgent('compliance-auditor', 'Compliance Auditor', 'operations', 'Audits systems for compliance with security frameworks'),
  defAgent('deploy-orchestrator', 'Deploy Orchestrator', 'operations', 'Orchestrates blue-green and canary deployments'),
];

const COMM_AGENTS: AgentDefinition[] = [
  defAgent('email-drafter', 'Email Drafter', 'communication', 'Composes professional emails from bullet points'),
  defAgent('meeting-summarizer', 'Meeting Summarizer', 'communication', 'Summarizes meetings and extracts action items'),
  defAgent('content-writer', 'Content Writer', 'communication', 'Creates blog posts, docs, and marketing copy'),
  defAgent('social-poster', 'Social Poster', 'communication', 'Crafts social media posts with brand voice'),
  defAgent('notification-composer', 'Notification Composer', 'communication', 'Drafts in-app and push notification copy'),
  defAgent('report-generator', 'Report Generator', 'communication', 'Generates formatted reports from structured data'),
  defAgent('translation-agent', 'Translation Agent', 'communication', 'Translates content between languages'),
  defAgent('changelog-writer', 'Changelog Writer', 'communication', 'Writes changelogs from commit and PR data'),
  defAgent('help-desk', 'Help Desk Agent', 'communication', 'Answers user support queries with context-aware responses'),
  defAgent('onboarding-guide', 'Onboarding Guide', 'communication', 'Guides new users through setup and features'),
];

function defAgent(
  id: string,
  name: string,
  category: AgentCategory,
  description: string,
): AgentDefinition {
  return {
    id,
    name,
    category,
    description,
    capabilities: [],
    maxConcurrentTasks: 5,
    memoryEnabled: true,
    timeoutMs: 300_000,
    systemPrompt: `You are the ${name} agent for 47Network Sven. ${description}.`,
    metadata: {},
  };
}

/* --------------------------------------------------- agent registry */

export class AgentRegistry {
  private definitions = new Map<string, AgentDefinition>();
  private instances = new Map<string, AgentInstance>();
  private messageLog: AgentMessage[] = [];
  private nextMsgId = 1;
  private nextInstId = 1;

  constructor() {
    const all = [...CODE_AGENTS, ...RESEARCH_AGENTS, ...OPS_AGENTS, ...COMM_AGENTS];
    for (const d of all) {
      this.definitions.set(d.id, d);
    }
  }

  /* ----------- definitions ----------- */

  registerDefinition(def: AgentDefinition): void {
    this.definitions.set(def.id, def);
  }

  getDefinition(id: string): AgentDefinition | undefined {
    return this.definitions.get(id);
  }

  listDefinitions(category?: AgentCategory): AgentDefinition[] {
    const all = [...this.definitions.values()];
    return category ? all.filter((d) => d.category === category) : all;
  }

  /* ----------- instances ----------- */

  spawn(definitionId: string, parentInstanceId?: string): AgentInstance | null {
    const def = this.definitions.get(definitionId);
    if (!def) return null;

    const now = new Date().toISOString();
    const inst: AgentInstance = {
      instanceId: `agent-${this.nextInstId++}`,
      definitionId,
      name: def.name,
      category: def.category,
      lifecycle: 'initializing',
      spawnedAt: now,
      lastActivityAt: now,
      taskCount: 0,
      errorCount: 0,
      memoryKeys: [],
      parentInstanceId: parentInstanceId ?? null,
      resourceUsage: { cpuMs: 0, memoryMb: 0, tokensConsumed: 0 },
    };

    this.instances.set(inst.instanceId, inst);
    return inst;
  }

  getInstance(instanceId: string): AgentInstance | undefined {
    return this.instances.get(instanceId);
  }

  listInstances(lifecycle?: AgentLifecycle): AgentInstance[] {
    const all = [...this.instances.values()];
    return lifecycle ? all.filter((i) => i.lifecycle === lifecycle) : all;
  }

  updateLifecycle(instanceId: string, lifecycle: AgentLifecycle): void {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.lifecycle = lifecycle;
      inst.lastActivityAt = new Date().toISOString();
    }
  }

  terminate(instanceId: string): void {
    this.updateLifecycle(instanceId, 'terminated');
  }

  terminateAll(): void {
    for (const inst of this.instances.values()) {
      if (inst.lifecycle !== 'completed' && inst.lifecycle !== 'terminated' && inst.lifecycle !== 'failed') {
        inst.lifecycle = 'terminated';
        inst.lastActivityAt = new Date().toISOString();
      }
    }
  }

  /* ----------- messaging (bus) ----------- */

  send(from: string, to: string, channel: string, payload: Record<string, unknown>, correlationId?: string): AgentMessage {
    const msg: AgentMessage = {
      id: `msg-${this.nextMsgId++}`,
      fromAgent: from,
      toAgent: to,
      channel,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: correlationId ?? null,
    };
    this.messageLog.push(msg);
    return msg;
  }

  broadcast(from: string, channel: string, payload: Record<string, unknown>): AgentMessage[] {
    const active = this.listInstances('running');
    return active
      .filter((i) => i.instanceId !== from)
      .map((i) => this.send(from, i.instanceId, channel, payload));
  }

  getMessages(agentId: string, channel?: string, limit: number = 50): AgentMessage[] {
    return this.messageLog
      .filter((m) => {
        const match = m.toAgent === agentId || m.fromAgent === agentId;
        return channel ? match && m.channel === channel : match;
      })
      .slice(-limit);
  }

  /* ----------- supervision ----------- */

  getChildren(parentId: string): AgentInstance[] {
    return [...this.instances.values()].filter((i) => i.parentInstanceId === parentId);
  }

  getSupervisionTree(): Record<string, string[]> {
    const tree: Record<string, string[]> = {};
    for (const inst of this.instances.values()) {
      const parent = inst.parentInstanceId ?? 'root';
      if (!tree[parent]) tree[parent] = [];
      tree[parent].push(inst.instanceId);
    }
    return tree;
  }

  /* ----------- resource tracking ----------- */

  recordUsage(instanceId: string, delta: { cpuMs?: number; memoryMb?: number; tokensConsumed?: number }): void {
    const inst = this.instances.get(instanceId);
    if (!inst) return;
    if (delta.cpuMs) inst.resourceUsage.cpuMs += delta.cpuMs;
    if (delta.memoryMb) inst.resourceUsage.memoryMb = delta.memoryMb; // current, not cumulative
    if (delta.tokensConsumed) inst.resourceUsage.tokensConsumed += delta.tokensConsumed;
    inst.lastActivityAt = new Date().toISOString();
  }

  totalTokensConsumed(): number {
    return [...this.instances.values()].reduce((s, i) => s + i.resourceUsage.tokensConsumed, 0);
  }

  /* ----------- stats ----------- */

  stats(): { totalDefinitions: number; totalInstances: number; running: number; failed: number; totalMessages: number } {
    const insts = [...this.instances.values()];
    return {
      totalDefinitions: this.definitions.size,
      totalInstances: insts.length,
      running: insts.filter((i) => i.lifecycle === 'running').length,
      failed: insts.filter((i) => i.lifecycle === 'failed').length,
      totalMessages: this.messageLog.length,
    };
  }
}
