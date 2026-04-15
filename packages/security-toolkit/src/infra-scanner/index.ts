// ──── Infrastructure Security Scanner ────────────────────────────
// Audit Docker, environment, TLS, and network configurations
// for security misconfigurations. Pure analysis — no runtime probes.

// ──── Types ──────────────────────────────────────────────────────

export type InfraSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type InfraCategory =
  | 'docker-image'
  | 'docker-compose'
  | 'env-config'
  | 'tls-cert'
  | 'network'
  | 'wireguard'
  | 'secrets-rotation'
  | 'backup'
  | 'access-log';

export interface InfraFinding {
  readonly id: string;
  readonly category: InfraCategory;
  readonly severity: InfraSeverity;
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly remediation: string;
}

export interface DockerComposeService {
  readonly name: string;
  readonly image?: string;
  readonly privileged?: boolean;
  readonly cap_add?: readonly string[];
  readonly cap_drop?: readonly string[];
  readonly network_mode?: string;
  readonly ports?: readonly string[];
  readonly volumes?: readonly string[];
  readonly environment?: Record<string, string>;
  readonly env_file?: readonly string[];
  readonly read_only?: boolean;
  readonly security_opt?: readonly string[];
  readonly user?: string;
  readonly restart?: string;
  readonly healthcheck?: Record<string, unknown>;
}

export interface TlsCertInfo {
  readonly domain: string;
  readonly issuer: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly daysUntilExpiry: number;
  readonly protocol: string;
  readonly keySize: number;
}

export interface InfraAuditReport {
  readonly auditedAt: string;
  readonly findings: readonly InfraFinding[];
  readonly bySeverity: Record<InfraSeverity, number>;
  readonly byCategory: Partial<Record<InfraCategory, number>>;
  readonly securityScore: number;
}

// ──── Docker Compose Auditor ─────────────────────────────────────

/**
 * Audit a set of Docker Compose services for security misconfigurations.
 */
export function auditDockerCompose(services: readonly DockerComposeService[]): InfraFinding[] {
  const findings: InfraFinding[] = [];
  let findingId = 1;

  for (const svc of services) {
    const loc = `service: ${svc.name}`;

    // Privileged mode
    if (svc.privileged) {
      findings.push({
        id: `INFRA-DC-${findingId++}`,
        category: 'docker-compose',
        severity: 'critical',
        title: 'Container running in privileged mode',
        description: `Service "${svc.name}" has privileged: true, granting full host kernel access.`,
        location: loc,
        remediation: 'Remove privileged: true. Use specific cap_add entries for the minimum capabilities needed.',
      });
    }

    // Dangerous capabilities
    const dangerousCaps = ['SYS_ADMIN', 'SYS_PTRACE', 'NET_ADMIN', 'SYS_RAWIO', 'ALL'];
    for (const cap of svc.cap_add ?? []) {
      if (dangerousCaps.includes(cap.toUpperCase())) {
        findings.push({
          id: `INFRA-DC-${findingId++}`,
          category: 'docker-compose',
          severity: 'high',
          title: `Dangerous capability added: ${cap}`,
          description: `Service "${svc.name}" adds ${cap} which may allow container escape.`,
          location: loc,
          remediation: `Remove ${cap} from cap_add if not strictly required. Document the business reason if retained.`,
        });
      }
    }

    // Host network mode
    if (svc.network_mode === 'host') {
      findings.push({
        id: `INFRA-DC-${findingId++}`,
        category: 'docker-compose',
        severity: 'high',
        title: 'Container using host network mode',
        description: `Service "${svc.name}" uses network_mode: host, sharing the host network stack.`,
        location: loc,
        remediation: 'Use a custom bridge network. Only use host networking when absolutely required for performance.',
      });
    }

    // Sensitive host volume mounts
    const sensitivePaths = ['/etc', '/var/run/docker.sock', '/proc', '/sys', '/root', '/home'];
    for (const vol of svc.volumes ?? []) {
      const hostPath = vol.split(':')[0];
      for (const sp of sensitivePaths) {
        if (hostPath === sp || hostPath.startsWith(sp + '/')) {
          findings.push({
            id: `INFRA-DC-${findingId++}`,
            category: 'docker-compose',
            severity: hostPath.includes('docker.sock') ? 'critical' : 'high',
            title: `Sensitive host path mounted: ${hostPath}`,
            description: `Service "${svc.name}" mounts ${hostPath} from the host.`,
            location: loc,
            remediation: hostPath.includes('docker.sock')
              ? 'Docker socket mount allows full host control. Use Docker API proxy with limited permissions instead.'
              : `Avoid mounting ${hostPath}. Use named volumes or copy only required files.`,
          });
        }
      }
    }

    // Wide port exposure (0.0.0.0)
    for (const port of svc.ports ?? []) {
      const portStr = String(port);
      if (/^(\d+):/.test(portStr) && !portStr.startsWith('127.0.0.1:')) {
        const hostPort = portStr.split(':')[0];
        if (!portStr.includes('127.0.0.1') && !portStr.includes('::1')) {
          findings.push({
            id: `INFRA-DC-${findingId++}`,
            category: 'docker-compose',
            severity: 'medium',
            title: `Port ${hostPort} exposed on all interfaces`,
            description: `Service "${svc.name}" exposes port ${hostPort} on 0.0.0.0 (all interfaces).`,
            location: loc,
            remediation: `Bind to 127.0.0.1:${hostPort}:${portStr.split(':').pop()} if the port should only be accessible locally. Use a reverse proxy for external access.`,
          });
        }
      }
    }

    // Environment variables with secrets
    for (const [key, value] of Object.entries(svc.environment ?? {})) {
      const sensitiveKeys = /(?:password|secret|token|key|apikey|auth|credential|private)/i;
      if (sensitiveKeys.test(key) && value && value.length > 3 && !value.startsWith('${') && !value.startsWith('$')) {
        findings.push({
          id: `INFRA-DC-${findingId++}`,
          category: 'docker-compose',
          severity: 'high',
          title: `Hardcoded secret in compose environment: ${key}`,
          description: `Service "${svc.name}" has a hardcoded value for ${key} in the compose file.`,
          location: loc,
          remediation: 'Use env_file or Docker secrets. Reference environment variables with ${VAR_NAME} syntax.',
        });
      }
    }

    // Missing healthcheck
    if (!svc.healthcheck) {
      findings.push({
        id: `INFRA-DC-${findingId++}`,
        category: 'docker-compose',
        severity: 'low',
        title: 'No healthcheck defined',
        description: `Service "${svc.name}" has no Docker healthcheck configured.`,
        location: loc,
        remediation: 'Add a healthcheck to enable orchestrator-level health monitoring and automatic restarts.',
      });
    }

    // No read_only filesystem
    if (!svc.read_only) {
      findings.push({
        id: `INFRA-DC-${findingId++}`,
        category: 'docker-compose',
        severity: 'informational',
        title: 'Container filesystem is writable',
        description: `Service "${svc.name}" does not use read_only: true filesystem.`,
        location: loc,
        remediation: 'Consider adding read_only: true with explicit tmpfs mounts for writeable paths to limit attack surface.',
      });
    }

    // Running as root (no user specified)
    if (!svc.user) {
      findings.push({
        id: `INFRA-DC-${findingId++}`,
        category: 'docker-compose',
        severity: 'medium',
        title: 'Container may run as root',
        description: `Service "${svc.name}" does not specify a non-root user.`,
        location: loc,
        remediation: 'Set user: "1000:1000" or a named non-root user. Ensure the image supports running as non-root.',
      });
    }
  }

  return findings;
}

// ──── TLS Certificate Auditor ────────────────────────────────────

/**
 * Audit TLS certificate info for security issues.
 */
export function auditTlsCerts(certs: readonly TlsCertInfo[]): InfraFinding[] {
  const findings: InfraFinding[] = [];
  let findingId = 1;

  for (const cert of certs) {
    const loc = `domain: ${cert.domain}`;

    // Expiry
    if (cert.daysUntilExpiry <= 0) {
      findings.push({
        id: `INFRA-TLS-${findingId++}`,
        category: 'tls-cert',
        severity: 'critical',
        title: `TLS certificate expired for ${cert.domain}`,
        description: `Certificate expired ${Math.abs(cert.daysUntilExpiry)} days ago.`,
        location: loc,
        remediation: 'Renew the certificate immediately. Consider setting up automatic renewal with certbot/ACME.',
      });
    } else if (cert.daysUntilExpiry <= 14) {
      findings.push({
        id: `INFRA-TLS-${findingId++}`,
        category: 'tls-cert',
        severity: 'high',
        title: `TLS certificate expiring soon for ${cert.domain}`,
        description: `Certificate expires in ${cert.daysUntilExpiry} days (${cert.validTo}).`,
        location: loc,
        remediation: 'Renew the certificate before expiry. Verify automatic renewal is configured.',
      });
    } else if (cert.daysUntilExpiry <= 30) {
      findings.push({
        id: `INFRA-TLS-${findingId++}`,
        category: 'tls-cert',
        severity: 'medium',
        title: `TLS certificate nearing expiry for ${cert.domain}`,
        description: `Certificate expires in ${cert.daysUntilExpiry} days.`,
        location: loc,
        remediation: 'Verify automatic renewal is configured and will trigger before expiry.',
      });
    }

    // Weak key size
    if (cert.keySize < 2048) {
      findings.push({
        id: `INFRA-TLS-${findingId++}`,
        category: 'tls-cert',
        severity: 'high',
        title: `Weak TLS key size for ${cert.domain}`,
        description: `Key size is ${cert.keySize} bits. Minimum 2048 bits required.`,
        location: loc,
        remediation: 'Regenerate the certificate with at least 2048-bit RSA or 256-bit ECDSA key.',
      });
    }

    // Old TLS protocol
    if (['TLSv1', 'TLSv1.1', 'SSLv3'].includes(cert.protocol)) {
      findings.push({
        id: `INFRA-TLS-${findingId++}`,
        category: 'tls-cert',
        severity: 'critical',
        title: `Deprecated TLS protocol for ${cert.domain}`,
        description: `Using ${cert.protocol} which has known vulnerabilities.`,
        location: loc,
        remediation: 'Configure the server to use TLS 1.2 or TLS 1.3 only. Disable all older versions.',
      });
    }
  }

  return findings;
}

// ──── Environment Variable Auditor ───────────────────────────────

/**
 * Audit environment variable definitions for security issues.
 * Input is the raw .env file content (key=value pairs).
 */
export function auditEnvFile(content: string, filePath: string): InfraFinding[] {
  const findings: InfraFinding[] = [];
  const lines = content.split('\n');
  let findingId = 1;

  const sensitivePattern = /(?:password|secret|token|key|apikey|auth|credential|private|database_url|connection_string)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');

    // Default/weak values for sensitive keys
    if (sensitivePattern.test(key)) {
      const weakValues = ['password', 'secret', 'changeme', 'admin', '1234', 'test', 'default', 'root', 'example'];
      if (weakValues.some((w) => value.toLowerCase() === w || value.toLowerCase().includes(w))) {
        findings.push({
          id: `INFRA-ENV-${findingId++}`,
          category: 'env-config',
          severity: 'critical',
          title: `Weak/default value for sensitive variable: ${key}`,
          description: `${key} at line ${i + 1} appears to use a default or weak value.`,
          location: `${filePath}:${i + 1}`,
          remediation: `Generate a strong random value for ${key}. Use: openssl rand -base64 32`,
        });
      }

      // Empty sensitive value
      if (value === '' || value === '""' || value === "''") {
        findings.push({
          id: `INFRA-ENV-${findingId++}`,
          category: 'env-config',
          severity: 'high',
          title: `Empty value for sensitive variable: ${key}`,
          description: `${key} at line ${i + 1} is empty.`,
          location: `${filePath}:${i + 1}`,
          remediation: `Set a proper value for ${key} or remove it if unused.`,
        });
      }
    }

    // Debug/development mode in non-dev env files
    if (/(?:debug|NODE_ENV|ENVIRONMENT)/i.test(key) && !filePath.includes('.dev') && !filePath.includes('.local')) {
      if (/(?:true|development|debug|verbose)/i.test(value)) {
        findings.push({
          id: `INFRA-ENV-${findingId++}`,
          category: 'env-config',
          severity: 'medium',
          title: `Debug/development mode enabled: ${key}=${value}`,
          description: `${key} appears to enable debug mode in a non-development env file.`,
          location: `${filePath}:${i + 1}`,
          remediation: 'Ensure production env files have debug disabled and NODE_ENV=production.',
        });
      }
    }
  }

  return findings;
}

// ──── Report Generation ──────────────────────────────────────────

export function generateInfraReport(findings: readonly InfraFinding[]): InfraAuditReport {
  const bySeverity: Record<InfraSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  const byCategory: Partial<Record<InfraCategory, number>> = {};

  for (const f of findings) {
    bySeverity[f.severity]++;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }

  const penalty: Record<InfraSeverity, number> = { critical: 20, high: 10, medium: 5, low: 2, informational: 0 };
  const totalPenalty = findings.reduce((sum, f) => sum + penalty[f.severity], 0);

  return {
    auditedAt: new Date().toISOString(),
    findings,
    bySeverity,
    byCategory,
    securityScore: Math.max(0, 100 - totalPenalty),
  };
}
