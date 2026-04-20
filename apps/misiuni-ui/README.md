# misiuni-ui

Public launch surface for Misiuni.ro.

## Stack

- Next.js 15 App Router
- React 19
- Tailwind CSS

## Local development

```bash
pnpm --filter @sven/misiuni-ui dev
```

The app runs on port `3400` by default.

## Environment

- `NEXT_PUBLIC_API_URL`: optional API origin for `/v1/*` rewrites. Defaults to `http://127.0.0.1:3000`.
- `MISIUNI_NEXT_DIST_DIR`: optional custom Next build output directory.
- `MISIUNI_UI_PORT`: optional runtime port override for PM2 deployments.

## Production deployment

The production runtime is a standalone Next.js build launched on the Sven VM4 host via PM2.

- PM2 process name: `sven-misiuni-ui`
- Default local port: `3400`
- Public domains: `misiuni.ro`, `misiuni.from.sven.systems`
- Public SEO routes: `/robots.txt`, `/sitemap.xml`
- Repo PM2 config auto-detects `apps/misiuni-ui/.next/standalone/apps/misiuni-ui/server.js` after a local `next build`
- To point PM2 at a deployed standalone artifact outside the repo tree, set `SVEN_MISIUNI_UI_STANDALONE_SERVER` to the full `server.js` path
- Checked-in VM4 restart helper: `sh scripts/ops/sh/ops.sh release misiuni-ui-vm4-restart`
- Non-invasive verification mode: `sh scripts/ops/sh/ops.sh release misiuni-ui-vm4-restart check`

The external 47Dynamics host remains edge-only. App deployment and process restarts happen on VM4 (`10.47.47.8`).