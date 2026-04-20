-- Migration: Register tools for major features that have backend APIs but
-- were never exposed as LLM-callable tools.
--
-- Categories: memory, brain/knowledge-graph, pattern observation,
-- federation, community agents, calibration, inference routing.

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- MEMORY TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'memory.search',
  'Search Memories',
  'Search your memory for relevant information. Use when the user asks you to recall something or when context from past conversations would help.',
  'memory',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "query": {"type":"string", "description":"Natural language query to search memories"},
       "limit": {"type":"integer", "minimum":1, "maximum":20, "default":5, "description":"Max results to return"}
     }, "required":["query"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "memories": {"type":"array", "items":{"type":"object", "properties":{
         "key":{"type":"string"}, "value":{"type":"string"}, "importance":{"type":"number"},
         "visibility":{"type":"string"}, "updated_at":{"type":"string"}
       }}}
     }, "required":["memories"] }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'memory.list',
  'List Memories',
  'List all stored memories for the current conversation, the current user, or globally. Useful when the user wants to see what you remember.',
  'memory',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "visibility": {"type":"string", "enum":["global","user_private","chat_shared"], "description":"Filter by visibility scope"},
       "limit": {"type":"integer", "minimum":1, "maximum":50, "default":20}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "memories": {"type":"array", "items":{"type":"object"}},
       "total": {"type":"integer"}
     }, "required":["memories","total"] }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'memory.save',
  'Save Memory',
  'Save an important piece of information to memory so you can recall it later. Use when the user explicitly asks you to remember something or when you learn a key preference.',
  'memory',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "key": {"type":"string", "description":"Short label for this memory"},
       "value": {"type":"string", "description":"The content to remember"},
       "visibility": {"type":"string", "enum":["global","user_private","chat_shared"], "default":"user_private"}
     }, "required":["key","value"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "id": {"type":"string"}, "success": {"type":"boolean"}
     }, "required":["success"] }'::jsonb,
  10000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'memory.forget',
  'Forget Memory',
  'Delete a specific memory by its key. Use when the user asks you to forget something or when information is no longer relevant.',
  'memory',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "key": {"type":"string", "description":"The memory key to delete"}
     }, "required":["key"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "success": {"type":"boolean"}, "deleted_count": {"type":"integer"}
     }, "required":["success"] }'::jsonb,
  10000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'memory.stats',
  'Memory Statistics',
  'Get statistics about stored memories — count, categories, importance distribution. Use when the user asks about the state of their memory/brain.',
  'memory',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "total":{"type":"integer"}, "by_visibility":{"type":"object"}, "by_source":{"type":"object"},
       "avg_importance":{"type":"number"}, "oldest":{"type":"string"}, "newest":{"type":"string"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- KNOWLEDGE GRAPH / BRAIN TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'brain.search',
  'Search Knowledge Graph',
  'Search the knowledge graph for entities, relations, and facts you have learned. Use when the user asks about something you might have learned from past conversations or documents.',
  'brain',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "query": {"type":"string", "description":"Natural language query about entities or facts"},
       "entity_type": {"type":"string", "description":"Optional filter: person, project, concept, tool, location, etc."},
       "limit": {"type":"integer", "minimum":1, "maximum":20, "default":10}
     }, "required":["query"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "entities": {"type":"array", "items":{"type":"object", "properties":{
         "id":{"type":"string"}, "type":{"type":"string"}, "name":{"type":"string"},
         "description":{"type":"string"}, "confidence":{"type":"number"}
       }}},
       "relations": {"type":"array", "items":{"type":"object"}}
     } }'::jsonb,
  15000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'brain.entity',
  'Get Brain Entity',
  'Retrieve details about a specific entity in the knowledge graph — its properties, relations, and evidence.',
  'brain',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "name": {"type":"string", "description":"Entity name to look up"},
       "include_relations": {"type":"boolean", "default":true}
     }, "required":["name"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "entity": {"type":"object"}, "relations": {"type":"array"}, "evidence": {"type":"array"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'brain.stats',
  'Brain Statistics',
  'Get statistics about the knowledge graph — entity count, relation count, categories, and recent growth. Use when the user asks about the state of your brain.',
  'brain',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "entity_count":{"type":"integer"}, "relation_count":{"type":"integer"},
       "entity_types":{"type":"object"}, "recent_entities":{"type":"array"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- PATTERN OBSERVATION TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'pattern.insights',
  'Pattern Insights',
  'Retrieve recurring patterns and insights observed from your conversations — repeated questions, common workflows, usage trends. Use when asked about patterns or when proactively suggesting improvements.',
  'pattern',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "status": {"type":"string", "enum":["active","dismissed","resolved"], "default":"active"},
       "limit": {"type":"integer", "minimum":1, "maximum":20, "default":10}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "patterns": {"type":"array", "items":{"type":"object", "properties":{
         "question":{"type":"string"}, "occurrences":{"type":"integer"},
         "first_seen":{"type":"string"}, "last_seen":{"type":"string"},
         "suggested_answer":{"type":"string"}
       }}}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY AGENTS TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'agents.list',
  'List Community Agents',
  'List all community agents and their status — Guide, Inspector, Curator, Advocate, QA, Librarian, Feature Tester, Imagination. Shows which agents are active and their descriptions.',
  'agents',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "status": {"type":"string", "enum":["active","paused","destroyed"], "description":"Filter by agent status"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "agents": {"type":"array", "items":{"type":"object", "properties":{
         "id":{"type":"string"}, "name":{"type":"string"}, "description":{"type":"string"},
         "status":{"type":"string"}, "model":{"type":"string"}
       }}}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'agents.message',
  'Message Community Agent',
  'Send a message to a specific community agent and get their response. Use to delegate specialised tasks to the right agent (e.g. ask the Curator to organise content, or the Inspector to check community health).',
  'agents',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "agent_name": {"type":"string", "description":"Name of the agent (e.g. guide-agent, inspector-agent, curator-agent)"},
       "message": {"type":"string", "description":"The message or task to send to the agent"}
     }, "required":["agent_name","message"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "response": {"type":"string"}, "agent_id": {"type":"string"}, "status": {"type":"string"}
     } }'::jsonb,
  30000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- FEDERATION TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'federation.status',
  'Federation Status',
  'Get the current federation status — your instance identity, known peers, connection health, and data sovereignty settings.',
  'federation',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "identity":{"type":"object"}, "peers":{"type":"array"},
       "community_count":{"type":"integer"}, "consent_mode":{"type":"string"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'federation.peers',
  'List Federation Peers',
  'List all known federation peers — other Sven instances this instance can communicate with.',
  'federation',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "peers": {"type":"array", "items":{"type":"object", "properties":{
         "homeserver":{"type":"string"}, "status":{"type":"string"},
         "last_seen":{"type":"string"}, "capabilities":{"type":"array"}
       }}}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- CALIBRATION / CONFIDENCE TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'calibration.self_check',
  'Calibration Self-Check',
  'Run a self-assessment of your recent performance — accuracy, feedback trends, areas of improvement. Use when the user asks how well you are doing or when you want to reflect on your capabilities.',
  'calibration',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "window_days": {"type":"integer", "minimum":1, "maximum":90, "default":7}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "total_interactions":{"type":"integer"}, "positive_feedback":{"type":"integer"},
       "negative_feedback":{"type":"integer"}, "accuracy_estimate":{"type":"number"},
       "top_strengths":{"type":"array"}, "improvement_areas":{"type":"array"}
     } }'::jsonb,
  15000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- INFERENCE / MODEL ROUTING TOOLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'inference.status',
  'Inference Node Status',
  'Get the status of available inference nodes — local and cloud models, their health, load, and response times. Useful for explaining which models are available and their performance.',
  'inference',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "nodes": {"type":"array", "items":{"type":"object", "properties":{
         "name":{"type":"string"}, "type":{"type":"string"}, "is_healthy":{"type":"boolean"},
         "current_load":{"type":"number"}, "supported_models":{"type":"array"}
       }}},
       "active_routing_policy":{"type":"string"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

COMMIT;
