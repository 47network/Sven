# Sven

**AI assistant platform — self-hosted, multi-channel, extensible.**

Sven connects to 20+ messaging platforms (Slack, Teams, Telegram, Discord, WhatsApp, Signal, Matrix, and more), routes conversations through a pluggable AI backend, and gives you full control over your data.

## Architecture

TypeScript monorepo built on a **NATS JetStream** message bus. The **Gateway API** is the only externally-exposed service — all clients communicate through it.

```
Clients ─── Admin UI · Canvas UI · Flutter App · Tauri Desktop
                          │
                    Gateway API
          JWT auth · Rate limit · WSS streaming
                          │
        ┌─────────┬───────┴───────┬──────────────┐
    Agent      Skill         RAG           Workflow
    Runtime    Runner       Indexer         Executor
        └─────────┴───────────────┴──────────────┘
                          │
                   NATS JetStream
                          │
    PostgreSQL · OpenSearch · LiteLLM · SearXNG · Keycloak
                          │
            Faster-Whisper · Piper TTS · Wake-Word
                          │
              20 Messaging Adapters
```

## Repository Layout

```
apps/                       Client applications
  admin-ui/                   Admin dashboard (web)
  canvas-ui/                  Canvas workspace (web)
  companion-desktop-tauri/    Desktop app (Tauri)
  companion-user-flutter/     Mobile app (Flutter)
  sven-copilot-extension/     VS Code extension

services/                   Backend services
  gateway-api/                REST + WSS entry point
  agent-runtime/              Agent orchestration
  skill-runner/               Sandboxed skill execution (gVisor)
  rag-indexer/                Document indexing & retrieval
  rag-git-ingestor/           Git repository ingestion
  rag-nas-ingestor/           NAS file ingestion
  rag-notes-ingestor/         Notes ingestion
  model-router/               LLM provider routing
  workflow-executor/          Workflow automation
  notification-service/       Push & email notifications
  proactive-notifier/         Proactive outreach
  compute-mesh/               Distributed compute
  document-intel/             Document analysis
  marketing-intel/            Market intelligence
  security-toolkit/           Security scanning
  adapter-*/                  Messaging platform adapters
  faster-whisper/             Speech-to-text
  piper/                      Text-to-speech
  wake-word/                  Wake word detection
  litellm/                    LLM gateway
  searxng/                    Private search
  egress-proxy/               Outbound request proxy
  registry-worker/            Service registry

packages/                   Shared libraries
  shared/                     Common types, utils, config
  cli/                        Command-line interface
  design-system/              UI component library
  db/                         Database client & migrations

contracts/                  Service contracts (gRPC, REST)
deploy/                     Deployment configs (Docker, K8s, Nginx)
docs/                       Architecture & operations docs
config/                     Shared configuration
scripts/                    Development & CI scripts
tests/                      Integration & E2E tests
```

## Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm, Docker

# Clone and install
git clone https://git.sven.systems/47network/sven.git
cd sven
pnpm install

# Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# Start development
pnpm dev
```

See [deploy/quickstart/](deploy/quickstart/) for full setup instructions.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Release Process](RELEASE.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE) — Copyright (c) 2026 47Network
