// ──── Dependency Audit Engine ─────────────────────────────────────
// Analyze package.json / lockfiles for vulnerable, outdated, or risky dependencies.
// No runtime HTTP calls — works on parsed data you feed it.

// ──── Types ──────────────────────────────────────────────────────

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface PackageDep {
  readonly name: string;
  readonly version: string;
  readonly isDev: boolean;
  /** Resolved integrity hash from lockfile, if available. */
  readonly integrity?: string;
}

export interface KnownVulnerability {
  readonly id: string;
  readonly package: string;
  readonly affectedVersions: string;
  readonly severity: RiskLevel;
  readonly title: string;
  readonly description: string;
  readonly patchedVersion?: string;
  readonly cvssScore?: number;
  readonly epssScore?: number;
  readonly cweIds?: readonly string[];
  readonly url?: string;
}

export interface DepAuditFinding {
  readonly package: string;
  readonly version: string;
  readonly isDev: boolean;
  readonly riskLevel: RiskLevel;
  readonly issues: readonly string[];
  readonly vulnerabilities: readonly KnownVulnerability[];
  readonly remediation?: string;
}

export interface LicenseInfo {
  readonly package: string;
  readonly version: string;
  readonly license: string;
  readonly riskLevel: RiskLevel;
  readonly note?: string;
}

export interface DepAuditReport {
  readonly auditedAt: string;
  readonly totalPackages: number;
  readonly findings: readonly DepAuditFinding[];
  readonly byRisk: Record<RiskLevel, number>;
  readonly licenseIssues: readonly LicenseInfo[];
  readonly supplyChainFlags: readonly SupplyChainFlag[];
  readonly securityScore: number;
}

export interface SupplyChainFlag {
  readonly package: string;
  readonly version: string;
  readonly flagType: 'typosquat-suspect' | 'no-lockfile-integrity' | 'unmaintained' | 'install-script' | 'native-addon' | 'deprecated';
  readonly description: string;
  readonly riskLevel: RiskLevel;
}

// ──── License Risk Classification ────────────────────────────────

const PERMISSIVE_LICENSES = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0',
  'Unlicense', 'CC0-1.0', '0BSD', 'BlueOak-1.0.0',
]);

const COPYLEFT_LICENSES = new Set([
  'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
  'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'EUPL-1.2', 'MPL-2.0',
]);

export function classifyLicense(license: string): { riskLevel: RiskLevel; note?: string } {
  const normalized = license.trim().replace(/\s+/g, ' ');
  if (PERMISSIVE_LICENSES.has(normalized)) return { riskLevel: 'none' };
  if (normalized === 'MPL-2.0') return { riskLevel: 'low', note: 'MPL-2.0: file-level copyleft — legal review recommended for modifications' };
  if (COPYLEFT_LICENSES.has(normalized)) return { riskLevel: 'high', note: `${normalized}: strong copyleft — legal review required before use` };
  if (normalized === 'UNLICENSED' || normalized === '') return { riskLevel: 'critical', note: 'No license declared — cannot legally use' };
  return { riskLevel: 'medium', note: `Unknown license: ${normalized} — manual review needed` };
}

// ──── Typosquat Detection ────────────────────────────────────────

const POPULAR_PACKAGES = new Set([
  'express', 'react', 'vue', 'angular', 'lodash', 'axios', 'moment',
  'fastify', 'next', 'nuxt', 'webpack', 'vite', 'esbuild', 'rollup',
  'typescript', 'eslint', 'prettier', 'jest', 'mocha', 'vitest',
  'pg', 'mysql2', 'redis', 'mongoose', 'prisma', 'drizzle-orm',
  'dotenv', 'cors', 'helmet', 'jsonwebtoken', 'bcrypt', 'argon2',
  'pino', 'winston', 'chalk', 'commander', 'yargs', 'inquirer',
  'uuid', 'nanoid', 'zod', 'joi', 'ajv', 'date-fns', 'dayjs',
]);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function checkTyposquat(packageName: string): { isSuspect: boolean; similarTo?: string } {
  const name = packageName.replace(/^@[^/]+\//, ''); // strip scope
  for (const popular of POPULAR_PACKAGES) {
    if (name === popular) continue;
    const dist = levenshtein(name, popular);
    if (dist === 1 || (dist === 2 && name.length > 5)) {
      return { isSuspect: true, similarTo: popular };
    }
  }
  return { isSuspect: false };
}

// ──── Audit Engine ───────────────────────────────────────────────

/**
 * Cross-reference dependencies against a list of known vulnerabilities.
 */
export function matchVulnerabilities(
  deps: readonly PackageDep[],
  knownVulns: readonly KnownVulnerability[],
): Map<string, KnownVulnerability[]> {
  const result = new Map<string, KnownVulnerability[]>();
  for (const dep of deps) {
    const matching = knownVulns.filter((v) => v.package === dep.name);
    if (matching.length > 0) {
      result.set(`${dep.name}@${dep.version}`, matching);
    }
  }
  return result;
}

/**
 * Run a full dependency audit report.
 */
export function auditDependencies(
  deps: readonly PackageDep[],
  knownVulns: readonly KnownVulnerability[] = [],
  licenses: ReadonlyMap<string, string> = new Map(),
): DepAuditReport {
  const findings: DepAuditFinding[] = [];
  const licenseIssues: LicenseInfo[] = [];
  const supplyChainFlags: SupplyChainFlag[] = [];

  const vulnMap = matchVulnerabilities(deps, knownVulns);

  for (const dep of deps) {
    const issues: string[] = [];
    const matchedVulns = vulnMap.get(`${dep.name}@${dep.version}`) ?? [];
    let riskLevel: RiskLevel = 'none';

    // Vulnerability check
    if (matchedVulns.length > 0) {
      const maxSeverity = matchedVulns.reduce<RiskLevel>((max, v) => {
        const order: Record<RiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
        return order[v.severity] > order[max] ? v.severity : max;
      }, 'none');
      riskLevel = maxSeverity;
      issues.push(`${matchedVulns.length} known vulnerability(ies): ${matchedVulns.map((v) => v.id).join(', ')}`);
    }

    // Typosquat check
    const typoCheck = checkTyposquat(dep.name);
    if (typoCheck.isSuspect) {
      supplyChainFlags.push({
        package: dep.name,
        version: dep.version,
        flagType: 'typosquat-suspect',
        description: `Name suspiciously similar to popular package "${typoCheck.similarTo}"`,
        riskLevel: 'high',
      });
      issues.push(`Typosquat suspect — similar to "${typoCheck.similarTo}"`);
      if (riskLevel === 'none' || riskLevel === 'low') riskLevel = 'medium';
    }

    // Integrity check
    if (!dep.integrity) {
      supplyChainFlags.push({
        package: dep.name,
        version: dep.version,
        flagType: 'no-lockfile-integrity',
        description: 'No integrity hash found in lockfile',
        riskLevel: 'low',
      });
    }

    // License check
    const license = licenses.get(dep.name);
    if (license) {
      const lc = classifyLicense(license);
      if (lc.riskLevel !== 'none') {
        licenseIssues.push({
          package: dep.name,
          version: dep.version,
          license,
          riskLevel: lc.riskLevel,
          note: lc.note,
        });
      }
    }

    if (issues.length > 0 || matchedVulns.length > 0) {
      const remediation = matchedVulns
        .filter((v) => v.patchedVersion)
        .map((v) => `Upgrade ${dep.name} to ${v.patchedVersion} to fix ${v.id}`)
        .join('; ') || undefined;

      findings.push({
        package: dep.name,
        version: dep.version,
        isDev: dep.isDev,
        riskLevel,
        issues,
        vulnerabilities: matchedVulns,
        remediation,
      });
    }
  }

  // Sort by risk
  const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
  findings.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  const byRisk: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
  for (const f of findings) byRisk[f.riskLevel]++;

  const penalty: Record<RiskLevel, number> = { critical: 25, high: 15, medium: 8, low: 3, none: 0 };
  const totalPenalty = findings.reduce((sum, f) => sum + penalty[f.riskLevel], 0);

  return {
    auditedAt: new Date().toISOString(),
    totalPackages: deps.length,
    findings,
    byRisk,
    licenseIssues,
    supplyChainFlags,
    securityScore: Math.max(0, 100 - totalPenalty),
  };
}

/**
 * Parse a flat dependency map from package.json format.
 */
export function parseDependencies(
  dependencies: Record<string, string> = {},
  devDependencies: Record<string, string> = {},
): PackageDep[] {
  const deps: PackageDep[] = [];
  for (const [name, version] of Object.entries(dependencies)) {
    deps.push({ name, version, isDev: false });
  }
  for (const [name, version] of Object.entries(devDependencies)) {
    deps.push({ name, version, isDev: true });
  }
  return deps;
}
