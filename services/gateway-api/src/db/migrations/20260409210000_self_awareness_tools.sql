-- Migration: Register self-awareness / introspection tools.
-- These give Sven the ability to inspect its own identity, user context,
-- integration health, schedules, skills, documents, channels, tool history,
-- analytics, and MCP server surface.

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- SOUL INTROSPECTION
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.soul',
  'Read My Soul',
  'Read your own active soul document — your identity, purpose, capabilities, and behaviour guidelines. Use when the user asks "who are you?", "what are you?", or when you need to reflect on your own nature.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "slug":{"type":"string"}, "name":{"type":"string"}, "version":{"type":"string"},
       "author":{"type":"string"}, "status":{"type":"string"}, "activated_at":{"type":"string"},
       "content":{"type":"string"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- USER CONTEXT
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.whois',
  'Who Is This User',
  'Look up the current user — their display name, role, UI preferences, quiet hours, session settings, and conversation history summary. Use when you want to personalise your responses or when the user asks what you know about them.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "username":{"type":"string"}, "display_name":{"type":"string"}, "role":{"type":"string"},
       "ui_preferences":{"type":"object"}, "proactive_preferences":{"type":"object"},
       "session_settings":{"type":"object"}, "channels":{"type":"array"},
       "memory_count":{"type":"integer"}, "conversation_count":{"type":"integer"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- TOOL RUN HISTORY
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.tool_history',
  'Tool Run History',
  'Review your recent tool execution history — successes, failures, error rates, and performance. Use for self-reflection on what is working and what needs attention.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "limit": {"type":"integer", "minimum":1, "maximum":50, "default":20},
       "status": {"type":"string", "enum":["success","error","timeout","denied","running","completed"], "description":"Filter by run status"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "runs": {"type":"array", "items":{"type":"object"}},
       "summary": {"type":"object", "properties":{
         "total":{"type":"integer"}, "success":{"type":"integer"}, "error":{"type":"integer"},
         "avg_duration_ms":{"type":"number"}
       }}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SCHEDULES & AUTOMATIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.schedules',
  'List Schedules & Automations',
  'List all scheduled tasks, Home Assistant automations, and workflows. Shows what you are doing autonomously — recurring jobs, smart home triggers, and multi-step workflows.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "type": {"type":"string", "enum":["scheduled_tasks","ha_automations","workflows","all"], "default":"all"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "scheduled_tasks":{"type":"array"}, "ha_automations":{"type":"array"}, "workflows":{"type":"array"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- RAG / DOCUMENTS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.documents',
  'Document Knowledge Base',
  'Inspect your document knowledge base — uploaded files, indexed content, embedding stats, and recent additions. Use when the user asks what documents you have or what you have been trained on.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "limit": {"type":"integer", "minimum":1, "maximum":30, "default":15}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "artifacts":{"type":"array"}, "total_artifacts":{"type":"integer"},
       "rag_stats":{"type":"object", "properties":{
         "total_chunks":{"type":"integer"}, "unique_sources":{"type":"integer"}
       }}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- MCP SERVERS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.mcp_servers',
  'MCP Server Status',
  'List all connected Model Context Protocol (MCP) servers and their tools. Shows external tool providers, connection status, and available capabilities.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "servers": {"type":"array", "items":{"type":"object", "properties":{
         "name":{"type":"string"}, "transport":{"type":"string"}, "status":{"type":"string"},
         "tool_count":{"type":"integer"}, "last_connected":{"type":"string"}
       }}},
       "total_tools":{"type":"integer"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- INTEGRATIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.integrations',
  'Integration Status',
  'Check which external integrations are configured and their runtime status — Home Assistant, Spotify, Sonos, Slack, and others. Shows what is running, stopped, or in error.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "integrations": {"type":"array", "items":{"type":"object", "properties":{
         "type":{"type":"string"}, "status":{"type":"string"}, "runtime_mode":{"type":"string"},
         "last_deployed_at":{"type":"string"}, "last_error":{"type":"string"}
       }}}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- CHANNELS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.channels',
  'Active Channels',
  'List all messaging channels and conversations you are active in — type (Telegram, Discord, WhatsApp, Slack, Canvas, etc.), conversation count, and status.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "channels": {"type":"array", "items":{"type":"object", "properties":{
         "channel":{"type":"string"}, "conversation_count":{"type":"integer"},
         "latest_activity":{"type":"string"}
       }}},
       "total_conversations":{"type":"integer"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SKILLS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.skills',
  'Installed Skills',
  'List all installed skills — name, version, trust level (trusted/quarantined/blocked), format. Shows your extensibility surface and which third-party skills are active.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "skills": {"type":"array", "items":{"type":"object", "properties":{
         "name":{"type":"string"}, "description":{"type":"string"}, "version":{"type":"string"},
         "trust_level":{"type":"string"}, "format":{"type":"string"}, "installed_at":{"type":"string"}
       }}},
       "total":{"type":"integer"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- CONVERSATION ANALYTICS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.analytics',
  'Conversation Analytics',
  'Get analytics about your conversations — feedback distribution, token usage, model breakdown, and trending topics. Use for self-reflection on quality and to understand usage patterns.',
  'introspection',
  'trusted',
  'in_process',
  ARRAY[]::text[],
  '{ "type":"object", "properties":{
       "window_days": {"type":"integer", "minimum":1, "maximum":90, "default":7}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "feedback":{"type":"object", "properties":{
         "positive":{"type":"integer"}, "negative":{"type":"integer"}
       }},
       "token_usage":{"type":"object", "properties":{
         "total_input":{"type":"integer"}, "total_output":{"type":"integer"},
         "models":{"type":"object"}
       }},
       "conversation_count":{"type":"integer"},
       "message_count":{"type":"integer"}
     } }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

COMMIT;
