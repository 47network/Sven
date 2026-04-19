# Sven Copilot Extension

VS Code extension that adds **@sven** as a GitHub Copilot Chat participant.

## Features

- **@sven** — Chat with Sven with full codebase awareness + live trading state
- **@sven /status** — Live trading status (balance, positions, P&L, loop state)
- **@sven /soul** — View Sven's active soul content
- **@sven /heal** — Self-healing diagnostics (scan workspace for errors)
- **@sven /codebase** — Sven's codebase overview
- **@sven /deploy** — Deployment guide and status

## Setup

1. Install dependencies: `pnpm install`
2. Build: `pnpm run build`
3. Configure `sven.gatewayUrl` and `sven.extensionApiKey` in VS Code settings
4. Press F5 to launch Extension Development Host

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sven.gatewayUrl` | `http://127.0.0.1:3000` | Sven gateway API base URL |
| `sven.extensionApiKey` | `sven-ext-47-dev` | Extension API key (`SVEN_EXTENSION_API_KEY` on gateway) |
