// ──── SAST: Static Application Security Testing Engine ────────────
// Pattern-based vulnerability detection for TypeScript/JavaScript codebases.
// Zero external dependencies — pure regex + AST-style pattern matching.

// ──── Types ──────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type VulnerabilityCategory =
  | 'sql-injection'
  | 'xss'
  | 'ssrf'
  | 'path-traversal'
  | 'command-injection'
  | 'insecure-deserialization'
  | 'hardcoded-secret'
  | 'insecure-crypto'
  | 'auth-bypass'
  | 'prototype-pollution'
  | 'dependency-confusion'
  | 'information-disclosure'
  | 'open-redirect'
  | 'insecure-random'
  | 'missing-security-header';

export interface SastRule {
  readonly id: string;
  readonly category: VulnerabilityCategory;
  readonly severity: Severity;
  readonly title: string;
  readonly description: string;
  readonly patterns: readonly RegExp[];
  /** Lines matching these patterns are not flagged (reduce false positives). */
  readonly exclusions?: readonly RegExp[];
  readonly cweId?: string;
  readonly owaspCategory?: string;
  readonly remediation: string;
}

export interface SastFinding {
  readonly ruleId: string;
  readonly category: VulnerabilityCategory;
  readonly severity: Severity;
  readonly title: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly matchedText: string;
  readonly context: string;
  readonly cweId?: string;
  readonly owaspCategory?: string;
  readonly remediation: string;
}

export interface SastReport {
  readonly scannedAt: string;
  readonly filesScanned: number;
  readonly totalFindings: number;
  readonly findings: readonly SastFinding[];
  readonly bySeverity: Record<Severity, number>;
  readonly byCategory: Partial<Record<VulnerabilityCategory, number>>;
  readonly securityScore: number;
}

export interface SuppressedFinding {
  readonly ruleId: string;
  readonly file: string;
  readonly line: number;
  readonly justification: string;
  readonly suppressedBy: string;
  readonly suppressedAt: string;
}

// ──── Built-In Rule Set ──────────────────────────────────────────

export const BUILTIN_RULES: readonly SastRule[] = [
  // ── SQL Injection ──
  {
    id: 'SAST-001',
    category: 'sql-injection',
    severity: 'critical',
    title: 'Potential SQL injection via string interpolation',
    description: 'SQL query built using template literals or string concatenation with variables. Use parameterized queries instead.',
    patterns: [
      /(?:query|execute|raw|sql)\s*\(\s*`[^`]*\$\{/i,
      /(?:query|execute|raw|sql)\s*\(\s*['"][^'"]*['"]\s*\+/i,
      /(?:query|execute|raw|sql)\s*\(\s*[^'"`,\s]+\s*\+/i,
    ],
    exclusions: [/\.test\.|\.spec\.|__tests__/],
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021-Injection',
    remediation: 'Use parameterized queries: query($1, $2) with an array of values. Never interpolate user input into SQL strings.',
  },

  // ── XSS ──
  {
    id: 'SAST-002',
    category: 'xss',
    severity: 'high',
    title: 'Potential XSS via innerHTML or dangerouslySetInnerHTML',
    description: 'Direct HTML injection without sanitization.',
    patterns: [
      /\.innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
      /document\.write\s*\(/,
      /\.insertAdjacentHTML\s*\(/,
    ],
    exclusions: [/DOMPurify\.sanitize/, /sanitize\(/, /\.test\.|\.spec\./],
    cweId: 'CWE-79',
    owaspCategory: 'A03:2021-Injection',
    remediation: 'Use textContent instead of innerHTML. If HTML is required, sanitize with DOMPurify.sanitize() first.',
  },

  // ── SSRF ──
  {
    id: 'SAST-003',
    category: 'ssrf',
    severity: 'high',
    title: 'Potential SSRF — unvalidated URL in server-side request',
    description: 'A URL from user input or external source is used directly in a server-side HTTP request.',
    patterns: [
      /fetch\s*\(\s*(?:req\.(?:body|query|params)|input|url|target)/i,
      /axios\.\w+\s*\(\s*(?:req\.(?:body|query|params)|input|url|target)/i,
      /https?\.(?:get|request)\s*\(\s*(?:req\.(?:body|query|params)|input|url)/i,
      /got\s*\(\s*(?:req\.(?:body|query|params)|input|url|target)/i,
    ],
    cweId: 'CWE-918',
    owaspCategory: 'A10:2021-Server-Side Request Forgery',
    remediation: 'Validate and allowlist target URLs. Block internal/private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, ::1). Use a URL parser to check the hostname before making the request.',
  },

  // ── Path Traversal ──
  {
    id: 'SAST-004',
    category: 'path-traversal',
    severity: 'high',
    title: 'Potential path traversal — user input in file path',
    description: 'User-supplied input concatenated into a file system path without sanitization.',
    patterns: [
      /(?:readFile|writeFile|createReadStream|createWriteStream|access|stat|unlink|readdir|mkdir|rmdir)\w*\s*\(\s*(?:req\.(?:body|query|params)|input|userPath|filePath)\s*[+`]/i,
      /path\.(?:join|resolve)\s*\([^)]*(?:req\.(?:body|query|params)|input|userPath)/i,
    ],
    exclusions: [/path\.basename/, /\.replace\(\s*['"]\.\.['"]/, /\.test\.|\.spec\./],
    cweId: 'CWE-22',
    owaspCategory: 'A01:2021-Broken Access Control',
    remediation: 'Use path.basename() to strip directory components. Validate the resolved path is within the expected root directory. Never use raw user input in file paths.',
  },

  // ── Command Injection ──
  {
    id: 'SAST-005',
    category: 'command-injection',
    severity: 'critical',
    title: 'Potential command injection — user input in shell command',
    description: 'User input concatenated into a shell command string.',
    patterns: [
      /(?:exec|execSync|spawn|spawnSync|execFile)\s*\(\s*`[^`]*\$\{/i,
      /(?:exec|execSync)\s*\(\s*['"][^'"]*['"]\s*\+/i,
      /child_process.*(?:exec|spawn)\s*\(\s*(?:req\.|input|cmd|command)/i,
    ],
    exclusions: [/\.test\.|\.spec\.|__tests__/],
    cweId: 'CWE-78',
    owaspCategory: 'A03:2021-Injection',
    remediation: 'Use execFile() or spawn() with an array of arguments instead of exec() with string interpolation. Never pass user input through a shell.',
  },

  // ── Insecure Deserialization ──
  {
    id: 'SAST-006',
    category: 'insecure-deserialization',
    severity: 'high',
    title: 'Potential insecure deserialization',
    description: 'Using eval, Function constructor, or unserialize on external data.',
    patterns: [
      /\beval\s*\(/,
      /new\s+Function\s*\(/,
      /(?:unserialize|deserialize)\s*\(\s*(?:req\.|input|data|body)/i,
      /vm\.runInNewContext\s*\(/,
      /vm\.createScript\s*\(/,
    ],
    exclusions: [/eslint/, /\.test\.|\.spec\./],
    cweId: 'CWE-502',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    remediation: 'Never use eval() or the Function constructor with untrusted data. Use JSON.parse() for JSON data. Use a safe deserialization library for other formats.',
  },

  // ── Hardcoded Secrets ──
  {
    id: 'SAST-007',
    category: 'hardcoded-secret',
    severity: 'critical',
    title: 'Potential hardcoded secret or credential',
    description: 'A string literal appears to contain a secret, API key, or credential.',
    patterns: [
      /(?:api[_-]?key|apikey|secret|password|passwd|token|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i,
      /(?:AWS|AZURE|GCP|GITHUB|STRIPE|TWILIO|SENDGRID)[_A-Z]*(?:KEY|SECRET|TOKEN)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/,
      /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
    ],
    exclusions: [/process\.env/, /env\[/, /\.example/, /\.template/, /\.test\.|\.spec\./, /placeholder|changeme|your[_-]?key|xxx/i],
    cweId: 'CWE-798',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    remediation: 'Move secrets to environment variables or a secrets manager (Vault, AWS Secrets Manager). Never commit secrets to source control.',
  },

  // ── Insecure Crypto ──
  {
    id: 'SAST-008',
    category: 'insecure-crypto',
    severity: 'high',
    title: 'Use of weak or insecure cryptographic algorithm',
    description: 'MD5, SHA1, DES, RC4, or ECB mode detected in a security context.',
    patterns: [
      /createHash\s*\(\s*['"](?:md5|sha1|md4|ripemd160)['"]/i,
      /createCipher(?:iv)?\s*\(\s*['"](?:des|rc4|rc2|blowfish)['"]/i,
      /createCipher(?:iv)?\s*\([^)]*['"]ecb['"]/i,
      /(?:md5|sha1)\s*\(\s*(?!.*(?:checksum|etag|cache|fingerprint|hash.*file))/i,
    ],
    exclusions: [/checksum|etag|cache[_-]?key|file[_-]?hash|content[_-]?hash|\.test\.|\.spec\./i],
    cweId: 'CWE-327',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    remediation: 'Use SHA-256+ for hashing, AES-256-GCM for encryption. Never use MD5 or SHA1 for security purposes.',
  },

  // ── Auth Bypass ──
  {
    id: 'SAST-009',
    category: 'auth-bypass',
    severity: 'critical',
    title: 'Potential authentication or authorization bypass',
    description: 'Route handler may be missing authentication or authorization checks.',
    patterns: [
      /\.(?:get|post|put|patch|delete)\s*\(\s*['"][^'"]*(?:admin|user|account|payment|settings)[^'"]*['"](?:\s*,\s*(?:async\s*)?\(?(?:req|ctx))/i,
      /(?:isAdmin|isAuthenticated|requireAuth|checkPermission)\s*=\s*(?:false|true\s*\|\|)/i,
      /\/\/\s*(?:TODO|FIXME|HACK).*(?:auth|permission|access)/i,
    ],
    exclusions: [/middleware\(/, /authenticate/, /authorize/, /requireAuth/, /\.test\.|\.spec\./],
    cweId: 'CWE-287',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    remediation: 'Ensure all sensitive routes have authentication middleware. Implement authorization checks for role-based access. Use deny-by-default access control.',
  },

  // ── Prototype Pollution ──
  {
    id: 'SAST-010',
    category: 'prototype-pollution',
    severity: 'medium',
    title: 'Potential prototype pollution',
    description: 'Object property assignment using unchecked external keys, which may allow __proto__ or constructor pollution.',
    patterns: [
      /\[\s*(?:key|prop|name|field|attr)\s*\]\s*=\s*(?!undefined|null)/,
      /Object\.assign\s*\(\s*\{\s*\}\s*,\s*(?:req\.|input|body|data)/i,
      /(?:merge|extend|assign|defaults)\s*\(\s*(?:target|obj|result)\s*,\s*(?:req\.|input|body|data|source)/i,
    ],
    exclusions: [
      /hasOwnProperty|Object\.hasOwn/,
      /(?:key|prop|name)\s*!==?\s*['"]__proto__['"]/,
      /(?:key|prop|name)\s*!==?\s*['"]constructor['"]/,
      /\.test\.|\.spec\./,
    ],
    cweId: 'CWE-1321',
    owaspCategory: 'A03:2021-Injection',
    remediation: 'Validate property names against a blocklist (__proto__, constructor, prototype). Use Object.create(null) for lookup tables. Use Map instead of plain objects for dynamic keys.',
  },

  // ── Open Redirect ──
  {
    id: 'SAST-011',
    category: 'open-redirect',
    severity: 'medium',
    title: 'Potential open redirect',
    description: 'Redirecting to a URL from user input without validation.',
    patterns: [
      /(?:redirect|location)\s*(?:=|\()\s*(?:req\.(?:query|body|params)\.|input|url|next|returnUrl|redirectUrl)/i,
      /res\.redirect\s*\(\s*(?:req\.|input|url|next|returnUrl)/i,
      /window\.location\s*=\s*(?!\s*['"]\/)/,
    ],
    exclusions: [/allowedUrls|allowlist|safelist|\.startsWith\s*\(\s*['"]\/['"]/, /\.test\.|\.spec\./],
    cweId: 'CWE-601',
    owaspCategory: 'A01:2021-Broken Access Control',
    remediation: 'Validate redirect URLs against an allowlist of permitted domains. For internal redirects, ensure the URL starts with "/" and does not contain "//".',
  },

  // ── Insecure Random ──
  {
    id: 'SAST-012',
    category: 'insecure-random',
    severity: 'medium',
    title: 'Use of Math.random() in security-sensitive context',
    description: 'Math.random() is not cryptographically secure. Use crypto.randomBytes() or crypto.getRandomValues() for security tokens.',
    patterns: [
      /Math\.random\s*\(\s*\).*(?:token|secret|key|session|nonce|salt|password|id|uuid)/i,
      /(?:token|secret|key|session|nonce|salt|password)\s*=.*Math\.random\s*\(/i,
    ],
    exclusions: [/\.test\.|\.spec\.|__tests__/],
    cweId: 'CWE-330',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    remediation: 'Use crypto.randomBytes() (Node.js) or crypto.getRandomValues() (browser) for generating tokens, session IDs, and other security-sensitive values.',
  },

  // ── Missing Security Headers ──
  {
    id: 'SAST-013',
    category: 'missing-security-header',
    severity: 'low',
    title: 'Response without security headers',
    description: 'HTTP response missing CSP, HSTS, X-Frame-Options, or X-Content-Type-Options.',
    patterns: [
      /(?:cors|helmet)\s*\(\s*\{\s*origin\s*:\s*(?:true|['"][*]['"])/i,
      /Access-Control-Allow-Origin['"]\s*,\s*['"][*]['"]/,
    ],
    exclusions: [/\.test\.|\.spec\./],
    cweId: 'CWE-693',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    remediation: 'Use helmet() middleware or explicitly set: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options: DENY, X-Content-Type-Options: nosniff.',
  },

  // ── Information Disclosure ──
  {
    id: 'SAST-014',
    category: 'information-disclosure',
    severity: 'medium',
    title: 'Potential information disclosure in error response',
    description: 'Stack traces, internal paths, or detailed error messages may leak to clients.',
    patterns: [
      /(?:res|reply|response)\.(?:send|json|status)\s*\([^)]*(?:err\.stack|error\.stack|\.stack)/i,
      /(?:res|reply|response)\.(?:send|json)\s*\(\s*(?:err|error)\s*\)/i,
      /catch\s*\([^)]*\)\s*\{[^}]*(?:res|reply|response)\.(?:send|json)\s*\([^)]*(?:message|err)/i,
    ],
    exclusions: [/\.test\.|\.spec\.|NODE_ENV.*production|isProduction/],
    cweId: 'CWE-209',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    remediation: 'Return generic error messages to clients. Log detailed errors server-side only. Never expose stack traces in production.',
  },
];

// ──── Scanner Engine ─────────────────────────────────────────────

/**
 * Scan a single file's source text against all rules (or a subset).
 */
export function scanSource(
  source: string,
  filePath: string,
  rules: readonly SastRule[] = BUILTIN_RULES,
  suppressions: readonly SuppressedFinding[] = [],
): SastFinding[] {
  const lines = source.split('\n');
  const findings: SastFinding[] = [];
  const suppressionSet = new Set(
    suppressions
      .filter((s) => s.file === filePath)
      .map((s) => `${s.ruleId}:${s.line}`),
  );

  for (const rule of rules) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check exclusions first
      if (rule.exclusions?.some((ex) => ex.test(line))) continue;

      for (const pattern of rule.patterns) {
        const match = pattern.exec(line);
        if (match) {
          // Check suppression
          if (suppressionSet.has(`${rule.id}:${lineNum}`)) continue;

          // Check inline suppression comment
          if (/\/[/*]\s*sast-disable/.test(line)) continue;

          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length, i + 3);
          const context = lines.slice(contextStart, contextEnd).join('\n');

          findings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            file: filePath,
            line: lineNum,
            column: (match.index ?? 0) + 1,
            matchedText: match[0],
            context,
            cweId: rule.cweId,
            owaspCategory: rule.owaspCategory,
            remediation: rule.remediation,
          });

          break; // Only one finding per rule per line
        }
      }
    }
  }

  return findings;
}

/**
 * Scan multiple files and produce a full report.
 */
export function scanFiles(
  files: ReadonlyMap<string, string>,
  rules: readonly SastRule[] = BUILTIN_RULES,
  suppressions: readonly SuppressedFinding[] = [],
): SastReport {
  const allFindings: SastFinding[] = [];

  for (const [filePath, source] of files) {
    const findings = scanSource(source, filePath, rules, suppressions);
    allFindings.push(...findings);
  }

  // Sort: critical first, then by file+line
  allFindings.sort((a, b) => {
    const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const fileDiff = a.file.localeCompare(b.file);
    if (fileDiff !== 0) return fileDiff;
    return a.line - b.line;
  });

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  const byCategory: Partial<Record<VulnerabilityCategory, number>> = {};
  for (const f of allFindings) {
    bySeverity[f.severity]++;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }

  // Score: start at 100, subtract by severity
  const severityPenalty: Record<Severity, number> = { critical: 20, high: 10, medium: 5, low: 2, informational: 0 };
  const totalPenalty = allFindings.reduce((sum, f) => sum + severityPenalty[f.severity], 0);
  const securityScore = Math.max(0, 100 - totalPenalty);

  return {
    scannedAt: new Date().toISOString(),
    filesScanned: files.size,
    totalFindings: allFindings.length,
    findings: allFindings,
    bySeverity,
    byCategory,
    securityScore,
  };
}

/**
 * Get all rule IDs and their categories for inspection.
 */
export function listRules(rules: readonly SastRule[] = BUILTIN_RULES): Array<{ id: string; category: VulnerabilityCategory; severity: Severity; title: string }> {
  return rules.map((r) => ({ id: r.id, category: r.category, severity: r.severity, title: r.title }));
}

/**
 * Get a single rule by ID.
 */
export function getRule(ruleId: string, rules: readonly SastRule[] = BUILTIN_RULES): SastRule | undefined {
  return rules.find((r) => r.id === ruleId);
}

/**
 * Filter rules by severity or category.
 */
export function filterRules(
  opts: { severity?: Severity; category?: VulnerabilityCategory },
  rules: readonly SastRule[] = BUILTIN_RULES,
): readonly SastRule[] {
  return rules.filter((r) => {
    if (opts.severity && r.severity !== opts.severity) return false;
    if (opts.category && r.category !== opts.category) return false;
    return true;
  });
}
