// ---------------------------------------------------------------------------
// Eidolon — World simulation types
// ---------------------------------------------------------------------------
// Phase 1 foundation: agent state, interactions, businesses, and tick log.
// Kept intentionally separate from the read-projection types in `types.ts`
// so the write/runtime surface can evolve independently.
// ---------------------------------------------------------------------------

export type AgentRuntimeState =
  | 'idle'
  | 'exploring'
  | 'travelling'
  | 'talking'
  | 'working'
  | 'building'
  | 'returning_home'
  | 'resting';

export type AgentMood = 'happy' | 'neutral' | 'tired' | 'frustrated' | 'inspired';

export interface AgentRuntime {
  agentId: string;
  state: AgentRuntimeState;
  intent: string | null;
  targetLocation: string | null;
  targetAgentId: string | null;
  targetBusinessId: string | null;
  energy: number;
  mood: AgentMood;
  stateStartedAt: string;
  lastTickAt: string;
  ticksAlive: number;
}

export type InteractionTopic =
  | 'greeting'
  | 'business_tip'
  | 'job_lead'
  | 'gossip'
  | 'collaboration_offer'
  | 'review_share'
  | 'goodbye';

export interface AgentInteraction {
  id: string;
  agentA: string;
  agentB: string;
  location: string;
  topic: InteractionTopic;
  message: string;
  influencedDecision: boolean;
  createdAt: string;
}

export type BusinessMode = 'simulated' | 'live';
export type BusinessStatus = 'idle' | 'launching' | 'earning' | 'paused' | 'failed' | 'archived';

export interface AgentBusiness {
  id: string;
  agentId: string;
  orgId: string;
  name: string;
  kind: string;
  mode: BusinessMode;
  status: BusinessStatus;
  config: Record<string, unknown>;
  totalRevenueEurCents: number;
  totalTokensCredited: number;
  lastRunAt: string | null;
  lastRevenueAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RevenueOutcome = 'success' | 'no_revenue' | 'failure';

export interface BusinessRunResult {
  outcome: RevenueOutcome;
  grossEurCents: number;
  notes: string | null;
  evidenceUrl: string | null;
  evidenceHash: string | null;
}

export interface WorldTick {
  id: string;
  tickNo: number;
  orgId: string;
  startedAt: string;
  completedAt: string | null;
  agentsProcessed: number;
  stateChanges: number;
  interactions: number;
  businessRuns: number;
  revenueEurCents: number;
  tokensCredited: number;
  errors: number;
}

export type StructureType =
  | 'cabin'
  | 'house'
  | 'workshop'
  | 'studio'
  | 'lab'
  | 'storehouse'
  | 'garden'
  | 'fence'
  | 'monument';

export const STRUCTURE_BASE_COST: Record<StructureType, number> = {
  cabin: 200,
  house: 600,
  workshop: 400,
  studio: 450,
  lab: 800,
  storehouse: 250,
  garden: 100,
  fence: 50,
  monument: 1500,
};

// €1 = 100 47Tokens, locked default. Configurable per-deployment via
// EIDOLON_TOKENS_PER_EUR (positive integer).
export const DEFAULT_TOKENS_PER_EUR = 100;

// Distribution split for live-mode revenue.
export interface RevenueSplit {
  agentPct: number;       // credited to the earning agent
  treasuryPct: number;    // routed to org treasury (recorded; allocation handled elsewhere)
  landValuePct: number;   // increases parcel land_value
}

export const DEFAULT_REVENUE_SPLIT: RevenueSplit = {
  agentPct: 70,
  treasuryPct: 20,
  landValuePct: 10,
};
