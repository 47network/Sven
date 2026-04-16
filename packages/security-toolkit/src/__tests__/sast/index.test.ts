import {
  scanSource,
  scanFiles,
  listRules,
  getRule,
  filterRules,
  BUILTIN_RULES,
} from '../../sast/index.js';

describe('SAST Engine', () => {
  describe('scanSource', () => {
    it('should detect a vulnerability based on built-in rules', () => {
      const source = `
        function generateToken() {
          const token = Math.random().toString(36).substr(2);
          return token;
        }
      `;
      const findings = scanSource(source, 'src/auth.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('SAST-012');
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].line).toBe(3); // Line 1 is empty, Line 2 is function..., Line 3 is return Math.random...
    });

    it('should ignore vulnerability if line matches an exclusion pattern', () => {
      // SAST-012 excludes lines matching /\.test\.|\.spec\.|__tests__/
      const source = `
        const x = Math.random(); // .test.
      `;
      const findings = scanSource(source, 'src/auth.ts');
      expect(findings).toHaveLength(0);
    });

    it('should ignore vulnerability if inline sast-disable is present', () => {
      const source = `
        const token = Math.random(); // sast-disable
      `;
      const findings = scanSource(source, 'src/auth.ts');
      expect(findings).toHaveLength(0);
    });

    it('should ignore vulnerability if suppressed via suppressions argument', () => {
      const source = `
const token = Math.random();
      `;
      const findings = scanSource(source, 'src/auth.ts', BUILTIN_RULES, [
        {
          ruleId: 'SAST-012',
          file: 'src/auth.ts',
          line: 2, // The Math.random() is on line 2
          justification: 'Test justification',
          suppressedBy: 'user',
          suppressedAt: new Date().toISOString()
        }
      ]);
      expect(findings).toHaveLength(0);
    });
  });

  describe('scanFiles', () => {
    it('should scan multiple files and aggregate findings correctly', () => {
      const files = new Map<string, string>([
        ['file1.ts', 'const token = Math.random();\n'], // medium (SAST-012)
        ['file2.ts', 'db.query("SELECT * FROM users WHERE id = " + id);\n'], // critical (SAST-001)
        ['file3.ts', 'const b = 1;\n'] // clean
      ]);

      const report = scanFiles(files);

      expect(report.filesScanned).toBe(3);
      expect(report.totalFindings).toBe(2);
      expect(report.findings).toHaveLength(2);

      // Sorted critical first, so SAST-001 comes before SAST-012
      expect(report.findings[0].severity).toBe('critical');
      expect(report.findings[0].file).toBe('file2.ts');
      expect(report.findings[0].ruleId).toBe('SAST-001');

      expect(report.findings[1].severity).toBe('medium');
      expect(report.findings[1].file).toBe('file1.ts');
      expect(report.findings[1].ruleId).toBe('SAST-012');

      expect(report.bySeverity.critical).toBe(1);
      expect(report.bySeverity.medium).toBe(1);
      expect(report.bySeverity.high).toBe(0);

      // Score: 100 - (20 for critical) - (5 for medium) = 75
      expect(report.securityScore).toBe(75);
    });

    it('should cap securityScore at 0 and not go negative', () => {
      const files = new Map<string, string>([
        ['file1.ts',
          'db.query("SELECT * FROM users WHERE id = " + id);\n' +
          'db.query("SELECT * FROM users WHERE id = " + id);\n' +
          'db.query("SELECT * FROM users WHERE id = " + id);\n' +
          'db.query("SELECT * FROM users WHERE id = " + id);\n' +
          'db.query("SELECT * FROM users WHERE id = " + id);\n' +
          'db.query("SELECT * FROM users WHERE id = " + id);\n'
        ]
      ]);

      const report = scanFiles(files);
      // 6 criticals = 120 penalty
      expect(report.securityScore).toBe(0);
    });
  });

  describe('Rule management', () => {
    it('listRules should return a summary of all rules', () => {
      const rules = listRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('category');
      expect(rules[0]).toHaveProperty('severity');
      expect(rules[0]).toHaveProperty('title');
    });

    it('getRule should return a specific rule by ID', () => {
      const rule = getRule('SAST-001');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('SAST-001');

      const missing = getRule('NOT-A-RULE');
      expect(missing).toBeUndefined();
    });

    it('filterRules should filter by severity and category', () => {
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
