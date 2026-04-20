#!/usr/bin/env sh
set -eu

VM4_HOST="${SVEN_VM4_HOST:-10.47.47.8}"
VM4_USER="${SVEN_VM4_USER:-hantz}"
VM4_TARGET="${VM4_USER}@${VM4_HOST}"
VM4_SRC_ROOT="${SVEN_VM4_SRC_ROOT:-/srv/sven/prod/src}"
MISIUNI_REMOTE_ROOT="${SVEN_MISIUNI_UI_REMOTE_ROOT:-/srv/sven/prod/misiuni-ui}"
MISIUNI_REMOTE_SERVER="${SVEN_MISIUNI_UI_REMOTE_SERVER:-${MISIUNI_REMOTE_ROOT}/apps/misiuni-ui/server.js}"
MISIUNI_PM2_APP="${SVEN_MISIUNI_PM2_APP:-sven-misiuni-ui}"
MISIUNI_PORT="${MISIUNI_UI_PORT:-3400}"
MODE="${1:-restart}"

usage() {
  cat <<EOF
Restart or verify the Misiuni VM4 PM2 runtime.

Usage:
  sh scripts/ops/sh/release-misiuni-ui-vm4-restart.sh [restart|check]

Environment overrides:
  SVEN_VM4_HOST                  Default: ${VM4_HOST}
  SVEN_VM4_USER                  Default: ${VM4_USER}
  SVEN_VM4_SSH_KEY               Optional SSH private key path
  SVEN_VM4_SRC_ROOT              Default: ${VM4_SRC_ROOT}
  SVEN_MISIUNI_UI_REMOTE_ROOT    Default: ${MISIUNI_REMOTE_ROOT}
  SVEN_MISIUNI_UI_REMOTE_SERVER  Default: ${MISIUNI_REMOTE_SERVER}
  SVEN_MISIUNI_PM2_APP           Default: ${MISIUNI_PM2_APP}
  MISIUNI_UI_PORT                Default: ${MISIUNI_PORT}

Modes:
  restart  Resolve the standalone server path, reload the PM2 app, save PM2 state, and verify health.
  check    Resolve the standalone server path and verify PM2 status and health without restarting.
EOF
}

run_ssh() {
  if [ -n "${SVEN_VM4_SSH_KEY:-}" ]; then
    ssh -i "$SVEN_VM4_SSH_KEY" -o StrictHostKeyChecking=accept-new "$VM4_TARGET" "$@"
    return
  fi

  ssh -o StrictHostKeyChecking=accept-new "$VM4_TARGET" "$@"
}

case "$MODE" in
  restart|check)
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

echo "Connecting to ${VM4_TARGET}..."
echo "Source root: ${VM4_SRC_ROOT}"
echo "Standalone server: ${MISIUNI_REMOTE_SERVER}"
echo "PM2 app: ${MISIUNI_PM2_APP}"
echo "Mode: ${MODE}"

run_ssh sh -s -- "$VM4_SRC_ROOT" "$MISIUNI_REMOTE_SERVER" "$MISIUNI_PM2_APP" "$MISIUNI_PORT" "$MODE" <<'EOF'
set -eu

src_root="$1"
standalone_server="$2"
app_name="$3"
port="$4"
mode="$5"

cd "$src_root"

if [ ! -f "$standalone_server" ]; then
  echo "Standalone server not found: $standalone_server" >&2
  exit 1
fi

resolved_lines="$(SVEN_MISIUNI_UI_STANDALONE_SERVER="$standalone_server" node -e "const config = require('./config/pm2/ecosystem.config.cjs'); const app = config.apps.find((entry) => entry.name === process.argv[1]); if (!app) { console.error('Missing PM2 app: ' + process.argv[1]); process.exit(1); } process.stdout.write(String(app.script || '') + '\n' + String(app.cwd || '') + '\n');" "$app_name")"
resolved_script="$(printf '%s\n' "$resolved_lines" | sed -n '1p')"
resolved_cwd="$(printf '%s\n' "$resolved_lines" | sed -n '2p')"
expected_cwd="$(cd "$(dirname "$standalone_server")/../.." && pwd -P)"
resolved_cwd_normalized="$(cd "$resolved_cwd" && pwd -P)"

if [ "$resolved_script" != "$standalone_server" ]; then
  echo "PM2 resolved unexpected script: $resolved_script" >&2
  exit 1
fi

if [ "$resolved_cwd_normalized" != "$expected_cwd" ]; then
  echo "PM2 resolved unexpected cwd: $resolved_cwd" >&2
  exit 1
fi

echo "Resolved PM2 app script: $resolved_script"
echo "Resolved PM2 app cwd: $resolved_cwd_normalized"

if [ "$mode" = "restart" ]; then
  SVEN_MISIUNI_UI_STANDALONE_SERVER="$standalone_server" pm2 startOrReload config/pm2/ecosystem.config.cjs --only "$app_name" --update-env
  pm2 save >/dev/null
fi

pm2 status "$app_name"
curl -fsS "http://127.0.0.1:${port}/healthz"
EOF

echo "Misiuni VM4 ${MODE} completed."
