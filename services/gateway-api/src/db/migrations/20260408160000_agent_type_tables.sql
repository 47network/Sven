-- Migration: Agent-specific tables for community agent types (Batch 3: 3.2-3.9)
-- Each agent type gets dedicated state/output tables for its domain logic.
-- All tables reference agent_personas(id) for identity binding.

BEGIN;

-- ============================================================
-- Guide Agent: FAQ entries for newcomer onboarding
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_faq_entries (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    agent_id          TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    question          TEXT NOT NULL,
    answer            TEXT NOT NULL,
    source_type       TEXT NOT NULL DEFAULT 'knowledge_graph'
                      CHECK (source_type IN ('knowledge_graph', 'manual', 'learned')),
    source_id         TEXT,
    category          TEXT NOT NULL DEFAULT 'general',
    usage_count       INTEGER NOT NULL DEFAULT 0,
    last_used_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_faq_entries IS 'Guide Agent FAQ knowledge base for newcomer onboarding';
CREATE INDEX idx_agent_faq_org ON agent_faq_entries (organization_id, category);
CREATE INDEX idx_agent_faq_usage ON agent_faq_entries (organization_id, usage_count DESC);

-- ============================================================
-- Inspector Agent: Capability test reports
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_capability_reports (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    agent_id          TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    capability_name   TEXT NOT NULL,
    test_type         TEXT NOT NULL DEFAULT 'health_check'
                      CHECK (test_type IN ('health_check', 'integration', 'performance', 'regression')),
    status            TEXT NOT NULL DEFAULT 'pass'
                      CHECK (status IN ('pass', 'fail', 'degraded', 'skipped')),
    details           JSONB DEFAULT '{}',
    response_time_ms  INTEGER,
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_capability_reports IS 'Inspector Agent capability test results and health reports';
CREATE INDEX idx_capability_reports_org ON agent_capability_reports (organization_id, capability_name, created_at DESC);
CREATE INDEX idx_capability_reports_status ON agent_capability_reports (organization_id, status, created_at DESC);

-- ============================================================
-- Curator Agent: Curated conversation highlights
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_curated_highlights (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    agent_id            TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    source_type         TEXT NOT NULL
                        CHECK (source_type IN ('conversation', 'pattern', 'correction', 'feedback', 'agent_exchange')),
    source_id           TEXT,
    title               TEXT NOT NULL,
    summary             TEXT NOT NULL,
    significance_score  DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    tags                JSONB DEFAULT '[]',
    published           BOOLEAN NOT NULL DEFAULT FALSE,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_curated_highlights IS 'Curator Agent curated community highlights and insights';
CREATE INDEX idx_curated_highlights_org ON agent_curated_highlights (organization_id, published, created_at DESC);
CREATE INDEX idx_curated_highlights_significance ON agent_curated_highlights (organization_id, significance_score DESC);

-- ============================================================
-- Advocate Agent: Feature requests surfaced from community
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_feature_requests (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    agent_id          TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    user_votes        INTEGER NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
    priority          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    source_pattern_id TEXT,
    source_feedback_ids JSONB DEFAULT '[]',
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_feature_requests IS 'Advocate Agent feature requests surfaced from community signals';
CREATE INDEX idx_feature_requests_org ON agent_feature_requests (organization_id, status, priority);
CREATE INDEX idx_feature_requests_votes ON agent_feature_requests (organization_id, user_votes DESC);

-- ============================================================
-- QA Agent: Community-visible bug reports
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_bug_reports (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    agent_id            TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    severity            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'investigating', 'confirmed', 'fixed', 'wont_fix', 'duplicate')),
    reproduction_steps  JSONB DEFAULT '[]',
    affected_capability TEXT,
    test_evidence       JSONB DEFAULT '{}',
    linked_report_id    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_bug_reports IS 'QA Agent community-visible bug reports from automated testing';
CREATE INDEX idx_bug_reports_org ON agent_bug_reports (organization_id, status, severity);
CREATE INDEX idx_bug_reports_capability ON agent_bug_reports (organization_id, affected_capability);

-- ============================================================
-- Librarian Agent: Knowledge index / living wiki
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_knowledge_index (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    agent_id          TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    topic             TEXT NOT NULL,
    summary           TEXT NOT NULL,
    content           TEXT NOT NULL DEFAULT '',
    source_refs       JSONB DEFAULT '[]',
    related_topics    JSONB DEFAULT '[]',
    entry_type        TEXT NOT NULL DEFAULT 'article'
                      CHECK (entry_type IN ('article', 'faq', 'guide', 'reference', 'glossary')),
    published         BOOLEAN NOT NULL DEFAULT FALSE,
    published_at      TIMESTAMPTZ,
    view_count        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_knowledge_index IS 'Librarian Agent community knowledge index and living wiki';
CREATE INDEX idx_knowledge_index_org ON agent_knowledge_index (organization_id, entry_type, published);
CREATE INDEX idx_knowledge_index_topic ON agent_knowledge_index (organization_id, topic);

-- ============================================================
-- Feature Tester + Feature Imagination: Test scenarios
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_test_scenarios (
    id                    TEXT PRIMARY KEY,
    organization_id       TEXT NOT NULL,
    agent_id              TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
    scenario_type         TEXT NOT NULL DEFAULT 'functional'
                          CHECK (scenario_type IN ('functional', 'integration', 'edge_case', 'creative', 'stress')),
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL,
    steps                 JSONB DEFAULT '[]',
    expected_outcomes     JSONB DEFAULT '[]',
    actual_result         JSONB,
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped', 'blocked')),
    imagined_by           TEXT REFERENCES agent_personas(id) ON DELETE SET NULL,
    executed_at           TIMESTAMPTZ,
    execution_duration_ms INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE agent_test_scenarios IS 'Feature Tester + Imagination Agent test scenarios and results';
CREATE INDEX idx_test_scenarios_org ON agent_test_scenarios (organization_id, scenario_type, status);
CREATE INDEX idx_test_scenarios_agent ON agent_test_scenarios (agent_id, status, created_at DESC);
CREATE INDEX idx_test_scenarios_imagined ON agent_test_scenarios (imagined_by, created_at DESC)
    WHERE imagined_by IS NOT NULL;

COMMIT;
