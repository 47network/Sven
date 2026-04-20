import { scanSource, scanFiles, listRules, getRule, filterRules, BUILTIN_RULES, SastFinding, SuppressedFinding } from '../../sast/index.js';

describe('SAST Module', () => {
  describe('scanSource', () => {
    it('should return no findings for clean code', () => {
      const source = `
        function hello() {
          console.log("Hello, world!");
        }
      `;
      const findings = scanSource(source, 'clean.js');
      expect(findings).toHaveLength(0);
    });

    it('should detect SQL injection vulnerability', () => {
      const source = `
        const userId = req.query.id;
        const result = db.query("SELECT * FROM users WHERE id = " + userId);
      `;
      const findings = scanSource(source, 'vuln.js');
      expect(findings.length).toBeGreaterThan(0);
      const sqlFinding = findings.find(f => f.category === 'sql-injection');
      expect(sqlFinding).toBeDefined();
      expect(sqlFinding?.ruleId).toBe('SAST-001');
      expect(sqlFinding?.severity).toBe('critical');
      expect(sqlFinding?.line).toBe(3);
    });

    it('should respect sast-disable inline comments', () => {
      const source = `
        const userId = req.query.id;
        const result = db.query("SELECT * FROM users WHERE id = " + userId); // sast-disable
      `;
      const findings = scanSource(source, 'ignored.js');
      expect(findings.find(f => f.category === 'sql-injection')).toBeUndefined();
    });

    it('should respect provided suppressions', () => {
      const source = `
        const result = db.query("SELECT * FROM users WHERE id = " + userId);
      `;
      const suppressions: SuppressedFinding[] = [
        {
          ruleId: 'SAST-001',
          file: 'suppressed.js',
          line: 2,
          reason: 'Test suppression',
          suppressedAt: new Date().toISOString(),
          suppressedBy: 'tester'
        }
      ];
      const findings = scanSource(source, 'suppressed.js', BUILTIN_RULES, suppressions);
      expect(findings).toHaveLength(0);
    });

    it('should match correctly when no match.index is available', () => {
      const mockRule = {
        id: 'SAST-MOCK',
        category: 'sql-injection' as const,
        severity: 'critical' as const,
        title: 'Mock Rule',
        description: 'Mock Description',
        patterns: [{
          exec: (line: string) => {
            if (line.includes('mock')) {
              const result = ['mock'];
              return result as RegExpExecArray;
            }
            return null;
          }
        } as unknown as RegExp],
        remediation: 'Mock Remediation'
      };

      const findings = scanSource('this is a mock line', 'mock.js', [mockRule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].column).toBe(1);
    });

    it('should skip exclusions (e.g., test files)', () => {
      const sourceWithExclusion = `
        const result = db.query("SELECT * FROM users WHERE id = " + userId); // .test.
      `;
      const findings = scanSource(sourceWithExclusion, 'somefile.js');
      expect(findings).toHaveLength(0);
    });
  });

  describe('scanFiles', () => {
    it('should scan multiple files and aggregate findings correctly', () => {
      const files = new Map<string, string>([
        ['clean.js', `console.log("clean");`],
        ['vuln1.js', `db.query("SELECT * FROM t WHERE id=" + id);`],
        ['vuln2.js', `fetch(req.query.data);`]
      ]);

      const report = scanFiles(files);

      expect(report.filesScanned).toBe(3);
      expect(report.totalFindings).toBeGreaterThanOrEqual(2);
      expect(report.bySeverity.critical).toBeGreaterThanOrEqual(1);
      expect(report.bySeverity.high).toBeGreaterThanOrEqual(1);

      expect(report.findings[0].severity).toBe('critical');
    });

    it('should correctly calculate security score', () => {
       const files = new Map<string, string>([
        ['vuln.js', `db.query("SELECT * FROM t WHERE id=" + id);`]
      ]);
      const report = scanFiles(files);
      expect(report.securityScore).toBe(80);
    });

    it('should sort findings by severity, file, and line number', () => {
      const files = new Map<string, string>([
        ['b-vuln.js', `
          // line 2
          db.query("SELECT * FROM t WHERE id=" + id); // SAST-001 critical
          // line 4
          db.query("SELECT * FROM t WHERE id=" + id); // SAST-001 critical
        `],
        ['a-vuln.js', `
          db.query("SELECT * FROM t WHERE id=" + id); // SAST-001 critical
        `],
        ['c-vuln.js', `
          fetch(req.query.data); // SAST-003 high
        `]
      ]);

      const report = scanFiles(files);

      expect(report.findings).toHaveLength(4);
      expect(report.findings[0].severity).toBe('critical');
      expect(report.findings[0].file).toBe('a-vuln.js');
      expect(report.findings[0].line).toBe(2);

      expect(report.findings[1].severity).toBe('critical');
      expect(report.findings[1].file).toBe('b-vuln.js');
      expect(report.findings[1].line).toBe(3);

      expect(report.findings[2].severity).toBe('critical');
      expect(report.findings[2].file).toBe('b-vuln.js');
      expect(report.findings[2].line).toBe(5);

      expect(report.findings[3].severity).toBe('high');
      expect(report.findings[3].file).toBe('c-vuln.js');
      expect(report.findings[3].line).toBe(2);
    });
  });

  describe('Utility functions', () => {
    it('listRules should return all rules', () => {
      const rules = listRules();
      expect(rules.length).toBe(BUILTIN_RULES.length);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('category');
      expect(rules[0]).toHaveProperty('severity');
    });

    it('getRule should return the correct rule or undefined', () => {
      const rule = getRule('SAST-001');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('SAST-001');

      const missing = getRule('NON-EXISTENT');
      expect(missing).toBeUndefined();
    });

    it('filterRules should correctly filter by severity and category', () => {
      const criticalRules = filterRules({ severity: 'critical' });
      expect(criticalRules.length).toBeGreaterThan(0);
      expect(criticalRules.every(r => r.severity === 'critical')).toBe(true);

      const sqlRules = filterRules({ category: 'sql-injection' });
      expect(sqlRules.length).toBeGreaterThan(0);
      expect(sqlRules.every(r => r.category === 'sql-injection')).toBe(true);

      const specificRules = filterRules({ severity: 'critical', category: 'sql-injection' });
      expect(specificRules.every(r => r.severity === 'critical' && r.category === 'sql-injection')).toBe(true);
    });
  });
});
