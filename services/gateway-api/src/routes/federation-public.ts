import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { FederationDiscoveryService } from '../services/FederationDiscoveryService.js';
import { InstanceIdentityService } from '../services/InstanceIdentityService.js';
import { FederationHealthService } from '../services/FederationHealthService.js';

/**
 * Public (unauthenticated) federation endpoints.
 *
 * These are reachable by remote Sven instances performing discovery,
 * handshake, and health checks. They expose only public information
 * (public keys, instance metadata) and enforce rate limiting.
 */
export function registerFederationPublicRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
) {
  const discovery = new FederationDiscoveryService(pool);
  const identity = new InstanceIdentityService(pool);
  const health = new FederationHealthService(pool);

  // ── .well-known Instance Discovery ────────────────────────────
  app.get('/.well-known/sven/instance', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            instance_id: { type: 'string' },
            instance_name: { type: 'string' },
            version: { type: 'string' },
            federation_enabled: { type: 'boolean' },
            public_key: { type: ['string', 'null'] },
            fingerprint: { type: ['string', 'null'] },
            algorithm: { type: 'string' },
            base_url: { type: 'string' },
            protocol_version: { type: 'string' },
            capabilities: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }, async (_request, reply) => {
    // Use default org for public endpoint; multi-tenant instances resolve
    // the org from the Host header in production (not implemented here yet).
    const orgId = process.env.SVEN_DEFAULT_ORG_ID || 'default';
    const data = await discovery.getWellKnownData(orgId);
    return reply.send(data);
  });

  // ── Inbound Handshake (remote peer initiates) ─────────────────
  app.post('/v1/federation/handshake', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['instance_id', 'instance_name', 'public_key', 'address'],
        properties: {
          instance_id: { type: 'string', minLength: 1, maxLength: 256 },
          instance_name: { type: 'string', minLength: 1, maxLength: 256 },
          public_key: { type: 'string', minLength: 1 },
          fingerprint: { type: 'string' },
          address: { type: 'string', format: 'uri' },
          capabilities: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request: any, reply) => {
    const orgId = process.env.SVEN_DEFAULT_ORG_ID || 'default';
    const body = request.body as {
      instance_id: string;
      instance_name: string;
      public_key: string;
      fingerprint?: string;
      address: string;
      capabilities?: string[];
    };

    // Register or update the peer
    const peer = await discovery.registerPeer(orgId, {
      instance_id: body.instance_id,
      instance_name: body.instance_name,
      address: body.address,
      public_key: body.public_key,
      fingerprint: body.fingerprint,
      capabilities: body.capabilities,
    });

    // Auto-complete handshake if public key provided
    if (body.public_key && body.fingerprint) {
      await discovery.completeHandshake(
        orgId,
        peer.id,
        body.public_key,
        body.fingerprint,
      );
    } else {
      await discovery.initiateHandshake(orgId, peer.id);
    }

    // Return our identity for the remote peer
    const ourIdentity = await discovery.getWellKnownData(orgId);
    return reply.code(200).send({
      status: 'ok',
      peer_id: peer.id,
      instance: ourIdentity,
    });
  });

  // ── Federation Health Probe ───────────────────────────────────
  app.get('/v1/federation/health', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'offline'] },
            federation_enabled: { type: 'boolean' },
            protocol_version: { type: 'string' },
            uptime_seconds: { type: 'number' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const orgId = process.env.SVEN_DEFAULT_ORG_ID || 'default';
    const wellKnown = await discovery.getWellKnownData(orgId);

    return reply.send({
      status: 'ok',
      federation_enabled: wellKnown.federation_enabled,
      protocol_version: '1.0',
      uptime_seconds: Math.floor(process.uptime()),
    });
  });

  // ── Inbound Signed Message Verify ─────────────────────────────
  app.post('/v1/federation/verify', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['payload', 'signature', 'fingerprint'],
        properties: {
          payload: { type: 'string' },
          signature: { type: 'string' },
          fingerprint: { type: 'string' },
          algorithm: { type: 'string', default: 'ed25519' },
        },
      },
    },
  }, async (request: any, reply) => {
    const orgId = process.env.SVEN_DEFAULT_ORG_ID || 'default';
    const body = request.body as {
      payload: string;
      signature: string;
      fingerprint: string;
      algorithm?: string;
    };

    try {
      // Look up our identity to get the public key for verification
      const wellKnown = await discovery.getWellKnownData(orgId);
      const publicKey = wellKnown.public_key as string | null;

      if (!publicKey) {
        return reply.code(400).send({ valid: false, error: 'No active identity keypair' });
      }

      const envelope = {
        payload: body.payload,
        signature: body.signature,
        fingerprint: body.fingerprint,
        algorithm: body.algorithm || 'ed25519',
        timestamp: new Date().toISOString(),
      };

      const valid = await identity.verifySignature(envelope, publicKey);
      return reply.send({ valid });
    } catch (err: any) {
      return reply.code(400).send({ valid: false, error: err.message });
    }
  });
}
