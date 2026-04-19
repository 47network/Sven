# Sven Studio IDE Integration Contract

This document is the current implementation-backed contract for integrating Sven Studio IDE with Sven Platform and the live VM topology.

## Scope

- Audience: the AI or engineer implementing Sven Studio IDE.
- Goal: use only currently implemented public and admin Sven contracts.
- Date stamped: 2026-04-18.
- Public API contract version: `2026-02-16.v1`.

## Critical rules

- Protected public `/v1/*` routes accept Sven-issued session credentials, not raw Keycloak access tokens.
- Public realtime is SSE-first. Do not assume a Studio-ready WebSocket contract exists.
- The main user action entrypoint that exists today is `POST /v1/chats/:chatId/messages`.
- Semantic search currently requires a `1536`-dimension embedding.
- Admin Git repo registration rejects localhost, metadata, and private RFC1918 repo URLs.

## Implemented now

| Capability | Status | Contract to use |
| --- | --- | --- |
| Auth discovery | Implemented | `GET /v1/auth/sso/status` |
| Local login | Implemented | `POST /v1/auth/login`, `POST /v1/auth/totp/verify` |
| OIDC direct exchange | Implemented | `POST /v1/auth/sso` |
| OIDC browser flow | Implemented | `POST /v1/auth/sso/oidc/start`, `POST /v1/auth/sso/oidc/callback` |
| Device flow | Implemented | `POST /v1/auth/device/start`, `POST /v1/auth/device/confirm`, `POST /v1/auth/device/token` |
| Deep-link token exchange | Implemented | `GET /v1/auth/token-exchange` |
| Session refresh | Implemented | `POST /v1/auth/refresh` |
| Minimal current user | Implemented | `GET /v1/me` |
| Rich session profile | Implemented | `GET /v1/auth/me` |
| Org list and org switch | Implemented | `GET /v1/users/me/organizations`, `PUT /v1/users/me/active-organization` |
| Chat send and queueing | Implemented | `POST /v1/chats/:chatId/messages`, `DELETE /v1/chats/:chatId/queue/:queueId` |
| Runs and artifacts | Implemented | `GET /v1/runs/:runId`, `GET /v1/artifacts/:artifactId`, `GET /v1/artifacts/:artifactId/download` |
| Approvals | Implemented | `GET /v1/approvals`, `GET /v1/approvals/export`, `POST /v1/approvals/:id/vote` |
| Federated search | Implemented | `POST /v1/search` |
| Full-text and semantic search | Implemented | `POST /v1/search/messages`, `POST /v1/search/semantic`, `POST /v1/search/unified` |
| Public SSE feed | Implemented | `GET /v1/stream` |
| A2UI SSE feed | Implemented | `GET /v1/chats/:chatId/a2ui/stream` |
| Resumable owned streams | Implemented | `POST /v1/streams`, `POST /v1/streams/:id/events`, `GET /v1/streams/:id/events`, `GET /v1/streams/:id/sse` |
| Deployment mode bootstrap | Implemented | `GET /v1/config/deployment`, `POST /v1/config/deployment/setup`, `PUT /v1/admin/deployment` |
| Admin Git and PR operations | Implemented | `/v1/admin/git/...` |
| Admin file workspace operations | Implemented | `/v1/admin/editor/...` |
| Admin agent session orchestration | Implemented | `/v1/admin/agents/...` |

## Needs new API or explicit platform decision

| Capability | Current state | Required action |
| --- | --- | --- |
| Studio WebSocket realtime | Not found in public route code | Define a public WS contract or keep Studio on SSE |
| Public PTY or shell session | Not found | Define a public terminal or runtime API |
| Public IDE sandbox lifecycle | Not found | Define workspace create, exec, stop, and cleanup APIs |
| Public deployment run status | Not found | Define deploy history and rollout status endpoints |
| Public KB ingestion | Not found | Define document or repo ingestion endpoints if Studio must upload knowledge |
| Private Forgejo repo registration | Blocked by current URL validation | Either expose Forgejo on a public-safe hostname or change admin validation policy |
| 768-dimension semantic search | Not supported by current route schema | Keep Studio at `1536` unless search contract is changed |

## Auth contract

### Session model

- Session cookie: `sven_session`
- Refresh cookie: `sven_refresh`
- Access token TTL: `604800` seconds
- Refresh token TTL: `7776000` seconds
- Accepted public auth on protected routes:
  - cookie `sven_session`
  - `Authorization: Bearer <opaque-sven-session-id>`
- Rejected assumption:
  - raw Keycloak access tokens sent directly to protected `/v1/*` routes

### Keycloak defaults in current environment

- Base URL: `http://127.0.0.1:8081`
- Realm: `sven`
- Client ID: `sven-gateway`

### Recommended Studio auth path

Use one of these flows, then store the returned Sven access token and refresh token:

1. `POST /v1/auth/device/start`
2. Have the user complete `verification_uri` or `verification_uri_complete`
3. Poll `POST /v1/auth/device/token`
4. Use returned `access_token` as `Authorization: Bearer <sessionId>`

Alternative browser path:

1. `GET /v1/auth/sso/status`
2. `POST /v1/auth/sso/oidc/start`
3. Complete org-configured OIDC login
4. `POST /v1/auth/sso/oidc/callback`

Alternative direct exchange path:

1. Acquire OIDC `id_token`
2. `POST /v1/auth/sso` with `provider=oidc`, `account_id`, `id_token`

### Multi-org requirement

Studio should call `GET /v1/users/me/organizations` after login and explicitly set the correct org with `PUT /v1/users/me/active-organization` before chat, approvals, runs, search, or admin flows.

## Primary Studio integration path

If Sven Studio is meant to act like a user-facing IDE assistant, the safest current flow is:

1. Authenticate into a Sven session.
2. Resolve or set active organization.
3. Create or reuse a chat.
4. Send work using `POST /v1/chats/:chatId/messages`.
5. Subscribe to `GET /v1/stream` or `GET /v1/chats/:chatId/a2ui/stream` for realtime updates.
6. Fetch detailed run, artifact, approval, and search data from the existing public routes.

## Realtime contract

### Public SSE routes

- `GET /v1/stream`
- `GET /v1/chats/:chatId/a2ui/stream`
- `GET /v1/streams/:id/sse`

### Public event names confirmed in route code

- `message`
- `approval`
- `agent.paused`
- `agent.resumed`
- `agent.nudged`

### Admin SSE feed

- `GET /v1/admin/events`

Admin event names confirmed in route code:

- `approval.changed`
- `tool_run.changed`
- `chat.changed`
- `user.changed`
- `health.status`
- `health.degraded`

## Search and knowledge base contract

- `POST /v1/search` is the current federated Canvas search.
- `POST /v1/search/messages` is full-text search over visible messages.
- `POST /v1/search/semantic` requires an embedding array with exactly `1536` numbers.
- `POST /v1/search/unified` supports scopes `messages`, `files`, `contacts`.

Studio must not assume there is a public upload-and-index knowledge API today.

## Git and Forgejo contract

Current Git integration is admin-only under `/v1/admin/git`.

Supported providers:

- `local`
- `forgejo`
- `github`

Forgejo and GitHub requirements:

- `repoOwner` required
- `tokenRef` required
- `repoUrl` must be valid `http` or `https`

Forgejo-specific requirement:

- `baseUrl` required

Protected branch merge rule:

- merge to `main` or `master` requires `protectedBranchApproved=true`

Repo URL restriction:

- current validation rejects localhost, loopback, metadata-service, and private RFC1918 hosts

## Deployment contract

Publicly available deployment-related routes are limited to:

- `GET /v1/config/deployment`
- `POST /v1/config/deployment/setup`
- `GET /healthz`
- `GET /readyz`
- `GET /v1/contracts/version`

There is no public deployment-run or rollout-history contract in the gateway routes reviewed for this integration.

## Shared state and transport

Authoritative shared state is in Postgres. Relevant tables touched by this integration include:

- `users`
- `sessions`
- `organizations`
- `organization_memberships`
- `sso_identities`
- `oidc_auth_states`
- `device_codes`
- `auth_user_rate_limits`
- `settings_global`
- `chats`
- `chat_members`
- `messages`
- `artifacts`
- `tool_runs`
- `approvals`
- `approval_votes`
- `session_settings`
- `agent_nudge_events`
- `git_repos`
- `git_operations`
- `git_pull_requests`

Transport and orchestration use NATS and JetStream. Confirmed subjects relevant to Studio-facing behavior include:

- `inbound.message.canvas`
- `approval.updated`
- `ui.a2ui.event`

The generic `/v1/streams` API is in-memory and gateway-instance local. It is transport, not durable shared state.

## LAN topology

- WireGuard mesh: `10.47.47.0/24`
- `sven-platform`: `10.47.47.8`
- `sven-ai`: `10.47.47.9`
- `sven-data`: `10.47.47.10`
- `sven-adapters`: `10.47.47.11`
- `kaldorei`: `10.47.47.13`
- LAN gateway and DNS: `192.168.10.1`
- Dev machine: `192.168.10.79`
- Public domains: `sven.systems`, `app.sven.systems`, `talk.sven.systems`
- Public HTTPS ingress: `44747`
- Internal gateway bind: `127.0.0.1:3000`
- Internal nginx ingress: `8088`

Model routing notes captured from repo and infra:

- local OpenAI-compatible endpoint: `http://10.47.47.9:8080/v1`
- Ollama and embeddings endpoint: `http://10.47.47.13:11434`

## Error and rate-limit contract

Confirmed error family in shared client:

- `NETWORK`
- `TIMEOUT`
- `AUTH`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMIT`
- `VALIDATION`
- `SERVER`
- `CIRCUIT_OPEN`
- `UNKNOWN`

Important route-level error codes confirmed in the gateway include:

- `UNAUTHENTICATED`
- `SESSION_EXPIRED`
- `AUTH_FAILED`
- `LOCKED_OUT`
- `ADMIN_TOTP_REQUIRED`
- `REFRESH_EXPIRED`
- `RATE_LIMITED`
- `QUEUE_DEPTH_EXCEEDED`
- `ORG_REQUIRED`
- `NOT_A_MEMBER`
- `TOKEN_EXCHANGE_DISABLED`
- `TOKEN_EXCHANGE_UNAVAILABLE`
- `INVALID_TOKEN`
- `EXPIRED`
- `INVALID_STATE`
- `SSO_DISABLED`
- `ACCOUNT_REQUIRED`
- `ACCOUNT_NOT_FOUND`
- `OIDC_DISCOVERY_FAILED`
- `OIDC_TOKEN_EXCHANGE_FAILED`
- `OIDC_JWKS_UNAVAILABLE`
- `OIDC_TOKEN_SIGNATURE_INVALID`
- `OIDC_CLAIMS_INVALID`
- `OIDC_SUBJECT_MISMATCH`
- `OIDC_ISSUER_MISMATCH`
- `OIDC_AUDIENCE_MISMATCH`
- `OIDC_NONCE_MISMATCH`
- `OIDC_NONCE_MISSING`
- `OIDC_TOKEN_EXPIRED`
- `OIDC_TOKEN_IAT_INVALID`
- `MISSING_STORAGE`
- `UPSTREAM_TIMEOUT`
- `UPSTREAM_FAILED`
- `ARTIFACT_NOT_FOUND`
- `APPROVAL_REQUIRED`

Confirmed rate-limit headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

Confirmed default limits in route code:

- brute-force attempts: `5`
- brute-force lockout: `15` minutes
- TOTP attempts: `5`
- device code TTL: `1800` seconds
- device token poll interval: `5` seconds
- per-user default API rate limit in code: `300` per `60` seconds

Deployed infra policy provided for this environment:

- global API: `200` per minute
- login: `10` per minute
- bootstrap: `3` per minute
- TOTP: `5` per minute
- brute-force lockout: `5` attempts over `15` minutes

## Source of truth files

- `services/gateway-api/src/routes/auth.ts`
- `services/gateway-api/src/routes/canvas.ts`
- `services/gateway-api/src/routes/search.ts`
- `services/gateway-api/src/routes/streams.ts`
- `services/gateway-api/src/routes/deployment.ts`
- `services/gateway-api/src/routes/admin/git.ts`
- `apps/canvas-ui/src/lib/api.ts`
- `packages/shared/src/sdk/http-client.ts`