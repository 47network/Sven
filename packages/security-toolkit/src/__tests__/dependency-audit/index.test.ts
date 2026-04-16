import {
  classifyLicense,
  checkTyposquat,
  matchVulnerabilities,
  auditDependencies,
  parseDependencies,
  PackageDep,
  KnownVulnerability
} from '../../dependency-audit/index';

describe('Dependency Audit Engine', () => {

  describe('classifyLicense', () => {
    it('returns none for permissive licenses', () => {
      expect(classifyLicense('MIT').riskLevel).toBe('none');
      expect(classifyLicense('ISC').riskLevel).toBe('none');
      expect(classifyLicense('Apache-2.0').riskLevel).toBe('none');
    });

    it('returns low for MPL-2.0', () => {
      const res = classifyLicense('MPL-2.0');
      expect(res.riskLevel).toBe('low');
      expect(res.note).toMatch(/file-level copyleft/);
    });

    it('returns high for strong copyleft licenses', () => {
      const res = classifyLicense('GPL-3.0');
      expect(res.riskLevel).toBe('high');
      expect(res.note).toMatch(/strong copyleft/);
    });

    it('returns critical for UNLICENSED or empty string', () => {
      expect(classifyLicense('UNLICENSED').riskLevel).toBe('critical');
      expect(classifyLicense('').riskLevel).toBe('critical');
    });

    it('returns medium for unknown licenses', () => {
      expect(classifyLicense('Proprietary').riskLevel).toBe('medium');
    });

    it('normalizes whitespace', () => {
      expect(classifyLicense('  MIT  ').riskLevel).toBe('none');
      expect(classifyLicense('\tGPL-3.0\n').riskLevel).toBe('high');
    });
  });

  describe('checkTyposquat', () => {
    it('returns false for exact matches of popular packages', () => {
      expect(checkTyposquat('react').isSuspect).toBe(false);
      expect(checkTyposquat('lodash').isSuspect).toBe(false);
    });

    it('returns true for distance 1 from popular packages', () => {
      const res = checkTyposquat('reactt');
      expect(res.isSuspect).toBe(true);
      expect(res.similarTo).toBe('react');
    });

    it('returns true for distance 2 for long package names (>5 chars)', () => {
      const res = checkTyposquat('fastifyy'); // 'fastify' is length 7
      expect(res.isSuspect).toBe(true);
      expect(res.similarTo).toBe('fastify');
    });

    it('returns false for completely different names', () => {
      expect(checkTyposquat('my-custom-package-name').isSuspect).toBe(false);
    });

    it('strips scope when checking', () => {
      // '@foo/reactt' -> 'reactt' which is distance 1 from 'react'
      const res = checkTyposquat('@foo/reactt');
      expect(res.isSuspect).toBe(true);
      expect(res.similarTo).toBe('react');
    });
  });

  describe('matchVulnerabilities', () => {
    it('matches dependencies to vulnerabilities by name', () => {
      const deps: PackageDep[] = [
        { name: 'lodash', version: '4.17.20', isDev: false },
        { name: 'express', version: '4.17.1', isDev: false },
      ];
      const vulns: KnownVulnerability[] = [
        {
          id: 'CVE-2021-1234',
          package: 'lodash',
          affectedVersions: '< 4.17.21',
          severity: 'high',
          title: 'Prototype Pollution',
          description: '...'
        }
      ];

      const res = matchVulnerabilities(deps, vulns);
      expect(res.size).toBe(1);
      expect(res.has('lodash@4.17.20')).toBe(true);
      expect(res.get('lodash@4.17.20')![0].id).toBe('CVE-2021-1234');
      expect(res.has('express@4.17.1')).toBe(false);
    });
  });

  describe('parseDependencies', () => {
    it('parses dependencies and devDependencies into PackageDep array', () => {
      const dependencies = { react: '17.0.2', lodash: '4.17.21' };
      const devDependencies = { jest: '27.0.6' };

      const res = parseDependencies(dependencies, devDependencies);
      expect(res).toHaveLength(3);

      const reactDep = res.find(d => d.name === 'react');
      expect(reactDep).toEqual({ name: 'react', version: '17.0.2', isDev: false });

      const jestDep = res.find(d => d.name === 'jest');
      expect(jestDep).toEqual({ name: 'jest', version: '27.0.6', isDev: true });
    });

    it('handles missing devDependencies', () => {
      const dependencies = { react: '17.0.2' };
      const res = parseDependencies(dependencies);
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('react');
    });

    it('handles missing dependencies', () => {
      const res = parseDependencies(undefined, { jest: '27.0.6' });
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('jest');
    });
  });

  describe('auditDependencies', () => {
    it('generates a full audit report with accurate findings, flags, and score', () => {
      const deps: PackageDep[] = [
        { name: 'react', version: '17.0.2', isDev: false, integrity: 'sha512-abc' }, // clean
        { name: 'lodash', version: '4.17.20', isDev: false }, // vuln (high) + no integrity (low)
        { name: 'reactt', version: '1.0.0', isDev: true, integrity: 'sha512-xyz' }, // typosquat (medium)
      ];

      const vulns: KnownVulnerability[] = [
        {
          id: 'CVE-2021-1234',
          package: 'lodash',
          affectedVersions: '< 4.17.21',
          severity: 'high',
          title: 'Prototype Pollution',
          description: '...',
          patchedVersion: '4.17.21'
        }
      ];

      const licenses = new Map([
        ['react', 'MIT'],
        ['lodash', 'GPL-3.0'], // high risk license
        ['reactt', 'UnknownLicense'] // medium risk license
      ]);

      const report = auditDependencies(deps, vulns, licenses);

      // Report Structure
      expect(report.totalPackages).toBe(3);
      expect(report.auditedAt).toBeDefined();

      // Findings (Vulnerabilities and Typosquats)
      // Lodash has high vuln, reactt has typosquat (medium)
      expect(report.findings).toHaveLength(2);

      // Sort by risk order (critical -> high -> medium -> low -> none)
      expect(report.findings[0].package).toBe('lodash'); // high
      expect(report.findings[0].riskLevel).toBe('high');
      expect(report.findings[0].remediation).toContain('Upgrade lodash to 4.17.21 to fix CVE-2021-1234');

      expect(report.findings[1].package).toBe('reactt'); // medium
      expect(report.findings[1].riskLevel).toBe('medium');
      expect(report.findings[1].issues[0]).toContain('Typosquat suspect');

      // Supply Chain Flags (Typosquat + no integrity)
      expect(report.supplyChainFlags).toHaveLength(2);
      expect(report.supplyChainFlags.find(f => f.flagType === 'typosquat-suspect')!.package).toBe('reactt');
      expect(report.supplyChainFlags.find(f => f.flagType === 'no-lockfile-integrity')!.package).toBe('lodash');

      // License Issues (Any non-'none' license)
      expect(report.licenseIssues).toHaveLength(2);
      expect(report.licenseIssues.find(l => l.package === 'lodash')!.riskLevel).toBe('high');
      expect(report.licenseIssues.find(l => l.package === 'reactt')!.riskLevel).toBe('medium');

      // byRisk (Findings risk counts)
      expect(report.byRisk.high).toBe(1); // lodash
      expect(report.byRisk.medium).toBe(1); // reactt
      expect(report.byRisk.low).toBe(0);
      expect(report.byRisk.none).toBe(0);

      // Penalty logic: high (15) + medium (8) = 23. Score = 100 - 23 = 77
      expect(report.securityScore).toBe(77);
    });

    it('caps security score at 0', () => {
      const deps: PackageDep[] = Array.from({ length: 5 }).map((_, i) => ({
        name: `vuln-pkg-${i}`,
        version: '1.0.0',
        isDev: false,
        integrity: 'sha512-abc'
      }));

      const vulns: KnownVulnerability[] = deps.map((d, i) => ({
        id: `CVE-${i}`,
        package: d.name,
        affectedVersions: '*',
        severity: 'critical' as const, // 5 criticals = 5 * 25 = 125 penalty
        title: 'Critical Vuln',
        description: '...'
      }));

      const report = auditDependencies(deps, vulns, new Map());
      expect(report.securityScore).toBe(0); // Max(0, 100 - 125)
    });
  });

});
