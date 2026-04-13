// ──── Secret Scanner ─────────────────────────────────────────────
// Detect secrets, credentials, tokens, and keys in source code and config files.
// Inspired by gitleaks/trufflehog — pure TypeScript, zero dependencies.

// ──── Types ──────────────────────────────────────────────────────

export type SecretType =
  | 'aws-access-key'
  | 'aws-secret-key'
  | 'github-token'
  | 'github-fine-grained'
  | 'gitlab-token'
  | 'slack-token'
  | 'slack-webhook'
  | 'stripe-key'
  | 'twilio-key'
  | 'sendgrid-key'
  | 'jwt'
  | 'private-key'
  | 'generic-api-key'
  | 'generic-secret'
  | 'generic-password'
  | 'database-url'
  | 'connection-string'
  | 'basic-auth-header'
  | 'bearer-token'
  | 'npm-token'
  | 'pypi-token'
  | 'gcp-service-account'
  | 'azure-key';

export interface SecretPattern {
  readonly id: string;
  readonly type: SecretType;
  readonly title: string;
  readonly pattern: RegExp;
  /** High-entropy verification: if set, the matched group must exceed this threshold. */
  readonly minEntropy?: number;
  readonly severity: 'critical' | 'high' | 'medium';
}

export interface SecretFinding {
  readonly patternId: string;
  readonly type: SecretType;
  readonly title: string;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly file: string;
  readonly line: number;
  readonly matchedText: string;
  /** The matched text with middle characters redacted for safe display. */
  readonly redacted: string;
  readonly context: string;
}

export interface SecretScanReport {
  readonly scannedAt: string;
  readonly filesScanned: number;
  readonly secretsFound: number;
  readonly findings: readonly SecretFinding[];
  readonly byType: Partial<Record<SecretType, number>>;
  readonly bySeverity: Record<'critical' | 'high' | 'medium', number>;
  readonly clean: boolean;
}

// ──── Entropy ────────────────────────────────────────────────────

/**
 * Shannon entropy of a string in bits per character.
 */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ──── Redaction ──────────────────────────────────────────────────

export function redactSecret(value: string): string {
  if (value.length <= 8) return '***';
  const showChars = Math.min(4, Math.floor(value.length * 0.15));
  return value.slice(0, showChars) + '***' + value.slice(-showChars);
}

// ──── Built-In Patterns ──────────────────────────────────────────

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  // AWS
  {
    id: 'SEC-001',
    type: 'aws-access-key',
    title: 'AWS Access Key ID',
    pattern: /(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/,
    severity: 'critical',
  },
  {
    id: 'SEC-002',
    type: 'aws-secret-key',
    title: 'AWS Secret Access Key',
    pattern: /(?:aws_secret_access_key|aws_secret|secret_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i,
    minEntropy: 4.0,
    severity: 'critical',
  },

  // GitHub
  {
    id: 'SEC-003',
    type: 'github-token',
    title: 'GitHub Personal Access Token (classic)',
    pattern: /(?:^|[^a-z0-9])(ghp_[A-Za-z0-9]{36})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },
  {
    id: 'SEC-004',
    type: 'github-fine-grained',
    title: 'GitHub Fine-Grained Token',
    pattern: /(?:^|[^a-z0-9])(github_pat_[A-Za-z0-9_]{82})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },

  // GitLab
  {
    id: 'SEC-005',
    type: 'gitlab-token',
    title: 'GitLab Personal Access Token',
    pattern: /(?:^|[^a-z0-9])(glpat-[A-Za-z0-9_-]{20,})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },

  // Slack
  {
    id: 'SEC-006',
    type: 'slack-token',
    title: 'Slack Token',
    pattern: /(?:^|[^a-z0-9])(xox[bpors]-[0-9A-Za-z-]{10,})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },
  {
    id: 'SEC-007',
    type: 'slack-webhook',
    title: 'Slack Webhook URL',
    pattern: /(https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+)/,
    severity: 'high',
  },

  // Stripe
  {
    id: 'SEC-008',
    type: 'stripe-key',
    title: 'Stripe API Key',
    pattern: /(?:^|[^a-z0-9])((?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },

  // Twilio
  {
    id: 'SEC-009',
    type: 'twilio-key',
    title: 'Twilio API Key',
    pattern: /(?:^|[^a-z0-9])(SK[0-9a-fA-F]{32})(?:[^a-z0-9]|$)/,
    severity: 'high',
  },

  // SendGrid
  {
    id: 'SEC-010',
    type: 'sendgrid-key',
    title: 'SendGrid API Key',
    pattern: /(?:^|[^a-z0-9])(SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },

  // JWT
  {
    id: 'SEC-011',
    type: 'jwt',
    title: 'JSON Web Token',
    pattern: /(?:^|[^a-z0-9.])(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})(?:[^a-z0-9.]|$)/,
    severity: 'high',
  },

  // Private Keys
  {
    id: 'SEC-012',
    type: 'private-key',
    title: 'Private Key (PEM)',
    pattern: /-----BEGIN (?:RSA |EC |DSA |ED25519 |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical',
  },

  // npm
  {
    id: 'SEC-013',
    type: 'npm-token',
    title: 'npm Access Token',
    pattern: /(?:^|[^a-z0-9])(npm_[A-Za-z0-9]{36})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },

  // PyPI
  {
    id: 'SEC-014',
    type: 'pypi-token',
    title: 'PyPI API Token',
    pattern: /(?:^|[^a-z0-9])(pypi-[A-Za-z0-9_-]{50,})(?:[^a-z0-9]|$)/,
    severity: 'critical',
  },

  // GCP
  {
    id: 'SEC-015',
    type: 'gcp-service-account',
    title: 'GCP Service Account Key',
    pattern: /"type"\s*:\s*"service_account"/,
    severity: 'critical',
  },

  // Database URLs
  {
    id: 'SEC-016',
    type: 'database-url',
    title: 'Database Connection URL with credentials',
    pattern: /(?:postgres|mysql|mongodb|redis|amqp)(?:ql)?:\/\/[^:]+:[^@]+@[^/\s'"]+/i,
    severity: 'high',
  },

  // Generic patterns (higher false positive rate, checked last)
  {
    id: 'SEC-017',
    type: 'generic-api-key',
    title: 'Generic API Key assignment',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([A-Za-z0-9_-]{20,})['"](?!\s*(?:\||\?\?|:|\+))/i,
    minEntropy: 3.5,
    severity: 'medium',
  },
  {
    id: 'SEC-018',
    type: 'generic-password',
    title: 'Generic password assignment',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"](?!\s*(?:\||\?\?|:))/i,
    minEntropy: 3.0,
    severity: 'medium',
  },
  {
    id: 'SEC-019',
    type: 'basic-auth-header',
    title: 'Basic Auth Header',
    pattern: /Authorization['":\s]+Basic\s+([A-Za-z0-9+/=]{10,})/i,
    severity: 'high',
  },
  {
    id: 'SEC-020',
    type: 'bearer-token',
    title: 'Bearer Token (hardcoded)',
    pattern: /Authorization['":\s]+Bearer\s+([A-Za-z0-9._~+/=-]{20,})/i,
    minEntropy: 3.5,
    severity: 'high',
  },
];

// ──── File Exclusion ─────────────────────────────────────────────

const EXCLUDED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.br',
  '.mp3', '.mp4', '.webm', '.ogg',
  '.pdf', '.doc', '.docx',
  '.lock', // lockfiles contain hashes not secrets
]);

const EXCLUDED_PATHS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.next\//,
  /\.nuxt\//,
];

export function shouldScanFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (EXCLUDED_EXTENSIONS.has(ext)) return false;
  return !EXCLUDED_PATHS.some((p) => p.test(filePath));
}

// ──── Scanner ────────────────────────────────────────────────────

/**
 * Scan a single file for secrets.
 */
export function scanFileForSecrets(
  source: string,
  filePath: string,
  patterns: readonly SecretPattern[] = SECRET_PATTERNS,
): SecretFinding[] {
  const lines = source.split('\n');
  const findings: SecretFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments that look like examples/docs
    if (/^\s*(?:\/\/|#|;)\s*(?:example|placeholder|changeme|your[_-]?key|xxx)/i.test(line)) continue;
    // Skip env var references (process.env.X)
    if (/process\.env\.\w+/.test(line) && !/['"]\w{16,}['"]/.test(line)) continue;
    // Inline suppression
    if (/\/[/*]\s*secret-scan-disable/.test(line)) continue;

    for (const pattern of patterns) {
      const match = pattern.pattern.exec(line);
      if (!match) continue;

      const captured = match[1] ?? match[0];

      // Entropy gate
      if (pattern.minEntropy !== undefined) {
        const ent = shannonEntropy(captured);
        if (ent < pattern.minEntropy) continue;
      }

      const contextStart = Math.max(0, i - 1);
      const contextEnd = Math.min(lines.length, i + 2);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      findings.push({
        patternId: pattern.id,
        type: pattern.type,
        title: pattern.title,
        severity: pattern.severity,
        file: filePath,
        line: lineNum,
        matchedText: captured,
        redacted: redactSecret(captured),
        context,
      });

      break; // one match per pattern per line
    }
  }

  return findings;
}

/**
 * Scan multiple files and produce a full report.
 */
export function scanForSecrets(
  files: ReadonlyMap<string, string>,
  patterns: readonly SecretPattern[] = SECRET_PATTERNS,
): SecretScanReport {
  const allFindings: SecretFinding[] = [];

  for (const [filePath, source] of files) {
    if (!shouldScanFile(filePath)) continue;
    const findings = scanFileForSecrets(source, filePath, patterns);
    allFindings.push(...findings);
  }

  const byType: Partial<Record<SecretType, number>> = {};
  const bySeverity: Record<'critical' | 'high' | 'medium', number> = { critical: 0, high: 0, medium: 0 };
  for (const f of allFindings) {
    byType[f.type] = (byType[f.type] ?? 0) + 1;
    bySeverity[f.severity]++;
  }

  return {
    scannedAt: new Date().toISOString(),
    filesScanned: files.size,
    secretsFound: allFindings.length,
    findings: allFindings,
    byType,
    bySeverity,
    clean: allFindings.length === 0,
  };
}
