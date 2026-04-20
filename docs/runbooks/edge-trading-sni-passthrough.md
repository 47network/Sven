# Edge SNI Passthrough — `trading.sven.systems`

## Scope

Restores public reachability of `https://trading.sven.systems`. The Sven
platform VM (VM4) is fully ready: nginx vhost loaded, valid Let's Encrypt
cert in place, `sven-trading-ui` running healthy on PM2 (port 3300),
`gateway-api` healthy on port 3000. The remaining gap is on the public
edge (47Dynamics, 82.137.24.36): its `stream {}` SNI map is missing the
`trading.sven.systems` hostname, so the TLS ClientHello is rejected with
alert `unrecognized_name`.

## Symptoms

```bash
$ curl -sI https://trading.sven.systems/ -m 10
curl: (35) TLS connect error: error:0A000458:SSL routines::tlsv1 unrecognized name
```

DNS is correct: `trading.sven.systems` resolves to the same edge IP as
`sven.systems` and `app.sven.systems` (which both work). The fault is
purely the edge SNI table.

## Verification (Pre-Change)

Run from any host with public internet (not from inside the platform VPN):

```bash
# Sanity check that DNS and other vhosts on the same edge work.
getent hosts trading.sven.systems sven.systems app.sven.systems
curl -sI https://app.sven.systems/healthz -m 10            # expect HTTP/1.1 200
curl -sI https://trading.sven.systems/    -m 10            # expect: TLS unrecognized_name
```

From VM4 (10.47.47.8) confirm internal stack is ready:

```bash
ssh hantz@10.47.47.8 "ss -ltn | grep -E ':3300|:3000'"
# expect:  LISTEN 0 511 0.0.0.0:3300 …  (sven-trading-ui)
# expect:  LISTEN 0 511 0.0.0.0:3000 …  (gateway-api)

ssh hantz@10.47.47.8 "sudo docker exec sven-nginx grep -c 'server_name trading.sven.systems' /etc/nginx/nginx.conf"
# expect: 1
ssh hantz@10.47.47.8 "sudo ls /etc/letsencrypt/live/trading.sven.systems/fullchain.pem"
# expect: file exists
```

If any of the above fail, fix VM4 first; do not change the edge yet.

## Fix (Edge Host — 47Dynamics, 82.137.24.36)

Two paths depending on what is already configured.

### Path A — Edge already has an SNI passthrough map (most common)

Edit the existing `stream { map $ssl_preread_server_name … }` block on
the edge and add a single line for `trading.sven.systems`, pointing it
at the same upstream used by `app.sven.systems`:

```nginx
map $ssl_preread_server_name $sven_l4_upstream {
    # … existing entries …
    app.sven.systems         sven_platform_https;
    trading.sven.systems     sven_platform_https;   # <-- add this line
    # … existing entries …
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Path B — Edge has no L4 passthrough block yet

Use the canonical snippet stored in this repo at:

- `config/nginx/extnginx-sven-trading.l4-passthrough.conf`

Drop it into the edge config tree (e.g. `/etc/nginx/streams.d/` or merged
into `/etc/nginx/nginx.conf`). Adjust the `upstream` IP to the actual
edge ↔ platform transit address (current prod uses `10.47.47.8` over the
internal network). Reload nginx as above.

> Do **not** terminate TLS for `trading.sven.systems` at the edge. The
> cert is provisioned and renewed on VM4 only. VM4's vhost listens with
> `listen 443 ssl proxy_protocol;` — the edge must speak L4 + PROXY v1.

## Verification (Post-Change)

```bash
# From any public host:
curl -sI https://trading.sven.systems/ -m 10
# expect: HTTP/1.1 200 OK
#         server: nginx
#         strict-transport-security: max-age=63072000; includeSubDomains; preload

curl -s  https://trading.sven.systems/ -m 10 | head -5
# expect: HTML beginning with <!DOCTYPE html> served by Next.js

# Gateway API passthrough on the same vhost:
curl -sI https://trading.sven.systems/v1/healthz -m 10
# expect: HTTP/1.1 200 OK

# SSE channel reachable (do not hold open in the runbook check):
curl -sN -H 'Accept: text/event-stream' https://trading.sven.systems/v1/trading/events -m 3 | head -1
# expect: a line starting with "event:" or "data:" or "retry:"
```

## Rollback

The change is additive and stateless — a single line in a `map {}`
block. To roll back, remove the `trading.sven.systems` line from the
edge's SNI map and `nginx -s reload`. Service to other vhosts is
unaffected by either applying or rolling back this change.

## What Was Already in Place (Pre-Fix Inventory)

- Edge: TLS terminates **at VM4**, so the edge holds **no cert** for
  `trading.sven.systems`. No cert work needed at the edge.
- VM4 `sven-nginx` container: `server_name trading.sven.systems` vhost
  loaded, cert path `/etc/letsencrypt/live/trading.sven.systems/{fullchain,privkey}.pem`,
  upstream `trading_ui → host.docker.internal:3300`.
- VM4 PM2: `sven-trading-ui` online, listening `0.0.0.0:3300`, returns 200.
- VM4 gateway: `gateway-api` online on `127.0.0.1:3000`, `/healthz` 200.
- DNS: `trading.sven.systems → 82.137.24.36` (matches edge).

## Out of Scope

- DNS records for `eidolon.sven.systems` and `market.sven.systems` —
  separate runbook (still pending).
- Flutter app chat regression — separate ticket.
