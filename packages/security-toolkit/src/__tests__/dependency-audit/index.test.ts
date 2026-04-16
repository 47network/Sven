import {
  classifyLicense,
  checkTyposquat,
  matchVulnerabilities,
  auditDependencies,
  parseDependencies,
  type KnownVulnerability,
  type PackageDep,
} from '../../dependency-audit/index.js';

describe('Dependency Audit Engine', () => {
  describe('classifyLicense', () => {
    it('returns riskLevel "none" for permissive licenses', () => {
      expect(classifyLicense('MIT')).toEqual({ riskLevel: 'none' });
      expect(classifyLicense('ISC')).toEqual({ riskLevel: 'none' });
      expect(classifyLicense('Apache-2.0')).toEqual({ riskLevel: 'none' });
      // Test normalization
      expect(classifyLicense('  MIT  ')).toEqual({ riskLevel: 'none' });
    });

    it('returns riskLevel "low" for MPL-2.0', () => {
      const res = classifyLicense('MPL-2.0');
      expect(res.riskLevel).toBe('low');
      expect(res.note).toMatch(/MPL-2.0/);
    });

    it('returns riskLevel "high" for strong copyleft licenses', () => {
      const res = classifyLicense('GPL-3.0');
      expect(res.riskLevel).toBe('high');
      expect(res.note).toMatch(/strong copyleft/);
    });

    it('returns riskLevel "critical" for UNLICENSED or empty string', () => {
      expect(classifyLicense('UNLICENSED')).toEqual({
        riskLevel: 'critical',
        note: 'No license declared — cannot legally use',
      });
      expect(classifyLicense('')).toEqual({
        riskLevel: 'critical',
        note: 'No license declared — cannot legally use',
      });
    });

    it('returns riskLevel "medium" for unknown licenses', () => {
      const res = classifyLicense('Custom-License');
      expect(res.riskLevel).toBe('medium');
      expect(res.note).toMatch(/Unknown license: Custom-License/);
    });
  });

  describe('checkTyposquat', () => {
    it('returns isSuspect false for exact popular packages', () => {
      expect(checkTyposquat('react')).toEqual({ isSuspect: false });
      expect(checkTyposquat('express')).toEqual({ isSuspect: false });
    });

    it('detects typosquatted popular package names', () => {
      const res = checkTyposquat('expres');
      expect(res).toEqual({ isSuspect: true, similarTo: 'express' });

      const res2 = checkTyposquat('reac');
      expect(res2).toEqual({ isSuspect: true, similarTo: 'react' });

      // Tests strip scope
      const res3 = checkTyposquat('@myorg/expres');
      expect(res3).toEqual({ isSuspect: true, similarTo: 'express' });
    });

    it('returns isSuspect false for completely different names', () => {
      expect(checkTyposquat('my-custom-package-name')).toEqual({ isSuspect: false });
      expect(checkTyposquat('@babel/generator')).toEqual({ isSuspect: false });
    });
  });

  describe('matchVulnerabilities', () => {
    it('returns empty map if no matching vulnerabilities', () => {
      const deps: PackageDep[] = [{ name: 'react', version: '18.0.0', isDev: false }];
      const knownVulns: KnownVulnerability[] = [
        {
          id: 'VULN-1',
          package: 'express',
          affectedVersions: '<4.0.0',
          severity: 'high',
          title: 'Test Vuln',
          description: 'Test description',
        },
      ];

      const res = matchVulnerabilities(deps, knownVulns);
      expect(res.size).toBe(0);
    });

    it('returns map with matching vulnerabilities', () => {
      const deps: PackageDep[] = [{ name: 'react', version: '18.0.0', isDev: false }];
      const knownVulns: KnownVulnerability[] = [
        {
          id: 'VULN-1',
          package: 'react',
          affectedVersions: '<18.2.0',
          severity: 'high',
          title: 'Test Vuln',
          description: 'Test description',
        },
      ];

      const res = matchVulnerabilities(deps, knownVulns);
      expect(res.size).toBe(1);
      expect(res.get('react@18.0.0')).toHaveLength(1);
      expect(res.get('react@18.0.0')?.[0].id).toBe('VULN-1');
    });
  });

  describe('auditDependencies', () => {
    it('runs clean audit when there are no issues', () => {
      const deps: PackageDep[] = [
        { name: 'my-custom-pkg', version: '1.0.0', isDev: false, integrity: 'sha256-abc' },
      ];

      const report = auditDependencies(deps);

      expect(report.totalPackages).toBe(1);
      expect(report.findings).toHaveLength(0);
      expect(report.licenseIssues).toHaveLength(0);
      expect(report.supplyChainFlags).toHaveLength(0);
      expect(report.securityScore).toBe(100);
      expect(report.byRisk.none).toBe(0);
    });

    it('detects typosquat and deducts from securityScore', () => {
      const deps: PackageDep[] = [
        { name: 'reac', version: '1.0.0', isDev: false, integrity: 'sha256-abc' },
      ];

      const report = auditDependencies(deps);

      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].issues[0]).toMatch(/Typosquat suspect/);
      expect(report.findings[0].riskLevel).toBe('medium'); // Typosquat defaults to medium
      expect(report.supplyChainFlags).toHaveLength(1);
      expect(report.securityScore).toBe(92); // 100 - 8 (medium penalty)
    });

    it('detects vulnerabilities and deducts from securityScore', () => {
      const deps: PackageDep[] = [
        { name: 'express', version: '3.0.0', isDev: false, integrity: 'sha256-abc' },
      ];
      const knownVulns: KnownVulnerability[] = [
        {
          id: 'VULN-CRIT',
          package: 'express',
          affectedVersions: '<4.0.0',
          severity: 'critical',
          title: 'Critical Vuln',
          description: 'Desc',
          patchedVersion: '4.0.0',
        },
      ];

      const report = auditDependencies(deps, knownVulns);

      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].riskLevel).toBe('critical');
      expect(report.findings[0].remediation).toMatch(/Upgrade express to 4.0.0/);
      expect(report.securityScore).toBe(75); // 100 - 25 (critical penalty)
    });

    it('detects missing integrity hash', () => {
      const deps: PackageDep[] = [
        { name: 'my-pkg', version: '1.0.0', isDev: false }, // missing integrity
      ];

      const report = auditDependencies(deps);

      expect(report.supplyChainFlags).toHaveLength(1);
      expect(report.supplyChainFlags[0].flagType).toBe('no-lockfile-integrity');
    });

    it('detects license issues', () => {
      const deps: PackageDep[] = [
        { name: 'my-pkg', version: '1.0.0', isDev: false, integrity: 'sha256-abc' },
      ];
      const licenses = new Map([['my-pkg', 'GPL-3.0']]);

      const report = auditDependencies(deps, [], licenses);

      expect(report.licenseIssues).toHaveLength(1);
      expect(report.licenseIssues[0].riskLevel).toBe('high');
    });
  });

  describe('parseDependencies', () => {
    it('parses dependencies and devDependencies into a flat list', () => {
      const deps = { react: '18.2.0', express: '4.18.2' };
      const devDeps = { typescript: '5.0.0' };

      const result = parseDependencies(deps, devDeps);
      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          { name: 'react', version: '18.2.0', isDev: false },
          { name: 'express', version: '4.18.2', isDev: false },
          { name: 'typescript', version: '5.0.0', isDev: true },
        ])
      );
    });

    it('handles empty inputs', () => {
      expect(parseDependencies()).toEqual([]);
      expect(parseDependencies({}, {})).toEqual([]);
    });
  });
});
