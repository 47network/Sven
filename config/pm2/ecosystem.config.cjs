const fs = require('fs');
const path = require('path');

function resolveFirstExisting(paths) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore invalid candidates and continue.
    }
  }
  return '';
}

function resolveSoakRuntimeEnv() {
  // The soak runtime file (docs/release/status/soak-72h-run.json) is written
  // by the 72-hour soak harness and points at ephemeral test containers
  // (random ports). Production processes must NEVER inherit those values —
  // a stale soak file with status="running" but expired expected_end_at
  // routes prod traffic at a port that no longer exists (ECONNREFUSED).
  //
  // Defense in depth: this lookup is now opt-in only, AND validates that the
  // recorded soak window is still active, AND verifies the recorded soak PID
  // is alive. Any check failing → empty result, falling back to the explicit
  // env-var chain (SVEN_RUNTIME_DATABASE_URL → DATABASE_URL → safe default).
  if (process.env.SVEN_PM2_USE_SOAK_RUNTIME !== '1') {
    return { databaseUrl: '', natsUrl: '' };
  }
  try {
    const runPath = path.resolve(__dirname, '..', '..', 'docs', 'release', 'status', 'soak-72h-run.json');
    if (!fs.existsSync(runPath)) return { databaseUrl: '', natsUrl: '' };
    const raw = fs.readFileSync(runPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (String(parsed?.status || '') !== 'running') return { databaseUrl: '', natsUrl: '' };
    // Freshness check: expected_end_at must be in the future (with 5min grace).
    const expectedEnd = parsed?.expected_end_at ? Date.parse(String(parsed.expected_end_at)) : NaN;
    if (!Number.isFinite(expectedEnd) || expectedEnd < Date.now() - 5 * 60 * 1000) {
      return { databaseUrl: '', natsUrl: '' };
    }
    // Liveness check: recorded soak_pid must still exist.
    const soakPid = Number(parsed?.soak_pid);
    if (Number.isFinite(soakPid) && soakPid > 0) {
      try {
        process.kill(soakPid, 0); // throws if PID dead
      } catch {
        return { databaseUrl: '', natsUrl: '' };
      }
    }
    return {
      databaseUrl: String(parsed?.database_url || '').trim(),
      natsUrl: String(parsed?.nats_url || '').trim(),
    };
  } catch {
    return { databaseUrl: '', natsUrl: '' };
  }
}

const soakRuntime = resolveSoakRuntimeEnv();
const nodeExe =
  process.env.SVEN_NODE_EXE ||
  resolveFirstExisting([
    'C:\\Users\\hantz\\AppData\\Local\\Programs\\cursor\\resources\\app\\resources\\helpers\\node.exe',
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\hantz\\AppData\\Local\\ms-playwright-go\\1.50.1\\node.exe',
  ]) ||
  process.execPath;
const webApiUrl =
  process.env.SVEN_WEB_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:3000';
const misiuniApiUrl =
  process.env.SVEN_MISIUNI_API_URL ||
  process.env.MISIUNI_PUBLIC_API_URL ||
  'http://127.0.0.1:3000';
const misiuniUiPort = process.env.MISIUNI_UI_PORT || '3400';
const searxngUrl =
  process.env.SEARXNG_URL ||
  'http://searxng.localtest.me:18080';
const nasRoot =
  process.env.SVEN_NAS_ROOT ||
  path.resolve(__dirname, '..', '..', '.runtime', 'nas');
const storageRoot =
  process.env.ARTIFACT_STORAGE_ROOT ||
  process.env.SVEN_STORAGE_ROOT ||
  path.resolve(__dirname, '..', '..', 'storage');
const nextCliScript = path.resolve(__dirname, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next');

function resolveStandaloneRoot(serverPath, appDir) {
  const depth = appDir.split(/[\\/]/).filter(Boolean).length;
  return path.resolve(path.dirname(serverPath), ...new Array(depth).fill('..'));
}

function createNextUiApp({ name, appDir, port, apiUrl, standaloneServerEnvVar }) {
  const standaloneServer = resolveFirstExisting([
    process.env[standaloneServerEnvVar],
    path.resolve(__dirname, '..', '..', appDir, '.next', 'standalone', appDir, 'server.js'),
  ]);
  const env = {
    NODE_ENV: 'production',
    PORT: port,
    NEXT_PUBLIC_API_URL: apiUrl,
  };

  if (standaloneServer) {
    return {
      name,
      cwd: resolveStandaloneRoot(standaloneServer, appDir),
      script: standaloneServer,
      interpreter: nodeExe,
      env,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    };
  }

  return {
    name,
    cwd: appDir,
    script: nextCliScript,
    args: `start --port ${port}`,
    interpreter: nodeExe,
    env,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 2000,
    time: true,
  };
}

module.exports = {
  apps: [
    {
      name: 'sven-gateway-api',
      cwd: 'services/gateway-api',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        SVEN_HARDENING_PROFILE: 'strict',
        AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
        GATEWAY_PORT: '3000',
        GATEWAY_HOST: '127.0.0.1',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        COMMUNITY_DATABASE_URL:
          process.env.COMMUNITY_DATABASE_URL ||
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
        SVEN_NAS_ROOT: nasRoot,
        ARTIFACT_STORAGE_ROOT: storageRoot,
        SVEN_STORAGE_ROOT: storageRoot,
        SEARXNG_URL: searxngUrl,
        SVEN_EDITOR_ENABLED: process.env.SVEN_EDITOR_ENABLED || 'true',
        COOKIE_SECRET:
          process.env.COOKIE_SECRET || 'replace-this-with-a-real-64-char-cookie-secret-before-production',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'sven-agent-runtime',
      cwd: 'services/agent-runtime',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
        AGENT_RUNTIME_METRICS_PORT: process.env.AGENT_RUNTIME_METRICS_PORT || '39100',
        OLLAMA_URL: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
        LITELLM_URL: process.env.LITELLM_URL || 'http://127.0.0.1:4000',
        SEARXNG_URL: searxngUrl,
        SVEN_PROJECT_CONTEXT_ALLOWED_ROOTS:
          process.env.SVEN_PROJECT_CONTEXT_ALLOWED_ROOTS ||
          path.resolve(__dirname, '..', '..'),
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    createNextUiApp({
      name: 'sven-admin-ui',
      appDir: 'apps/admin-ui',
      port: '3100',
      apiUrl: webApiUrl,
      standaloneServerEnvVar: 'SVEN_ADMIN_UI_STANDALONE_SERVER',
    }),
    createNextUiApp({
      name: 'sven-canvas-ui',
      appDir: 'apps/canvas-ui',
      port: '3200',
      apiUrl: webApiUrl,
      standaloneServerEnvVar: 'SVEN_CANVAS_UI_STANDALONE_SERVER',
    }),
    createNextUiApp({
      name: 'sven-trading-ui',
      appDir: 'apps/trading-ui',
      port: '3300',
      apiUrl: webApiUrl,
      standaloneServerEnvVar: 'SVEN_TRADING_UI_STANDALONE_SERVER',
    }),
    createNextUiApp({
      name: 'sven-misiuni-ui',
      appDir: 'apps/misiuni-ui',
      port: misiuniUiPort,
      apiUrl: misiuniApiUrl,
      standaloneServerEnvVar: 'SVEN_MISIUNI_UI_STANDALONE_SERVER',
    }),
    createNextUiApp({
      name: 'sven-marketplace-ui',
      appDir: 'apps/marketplace-ui',
      port: process.env.MARKETPLACE_UI_PORT || '3310',
      apiUrl: process.env.SVEN_MARKETPLACE_API_URL || webApiUrl,
      standaloneServerEnvVar: 'SVEN_MARKETPLACE_UI_STANDALONE_SERVER',
    }),
    createNextUiApp({
      name: 'sven-eidolon-ui',
      appDir: 'apps/eidolon-ui',
      port: process.env.EIDOLON_UI_PORT || '3311',
      apiUrl: process.env.SVEN_EIDOLON_API_URL || webApiUrl,
      standaloneServerEnvVar: 'SVEN_EIDOLON_UI_STANDALONE_SERVER',
    }),
    {
      name: 'sven-marketplace',
      cwd: 'services/sven-marketplace',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        MARKETPLACE_PORT: process.env.MARKETPLACE_PORT || '9478',
        MARKETPLACE_HOST: '0.0.0.0',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'sven-eidolon',
      cwd: 'services/sven-eidolon',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        EIDOLON_PORT: process.env.EIDOLON_PORT || '9479',
        EIDOLON_HOST: '0.0.0.0',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'sven-treasury',
      cwd: 'services/sven-treasury',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        TREASURY_PORT: process.env.TREASURY_PORT || '9477',
        TREASURY_HOST: '127.0.0.1',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
  ],
};
