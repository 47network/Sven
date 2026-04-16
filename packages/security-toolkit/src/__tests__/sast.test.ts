import { scanSource, scanFiles, getRule, filterRules, listRules, BUILTIN_RULES } from '../sast/index.js';

describe('SAST Scanner', () => {
  describe('scanSource', () => {
    it('should detect SQL injection via string interpolation', () => {
      const source = 'execute(`SELECT * FROM users WHERE id = ${id}`);';
      const findings = scanSource(source, 'app.ts');
      expect(findings.some(f => f.ruleId === 'SAST-001')).toBe(true);
    });

    it('should respect exclusions based on line content', () => {
      // The scanner applies exclusions to the line content, not the file path!
      const source = 'execute(`SELECT * FROM users WHERE id = ${id}`); // .test.';
      const findings = scanSource(source, 'test.ts');
      expect(findings.some(f => f.ruleId === 'SAST-001')).toBe(false);
    });

    it('should respect inline sast-disable comments', () => {
      const source = 'execute(`SELECT * FROM users WHERE id = ${id}`); // sast-disable';
      const findings = scanSource(source, 'app.ts');
      expect(findings.some(f => f.ruleId === 'SAST-001')).toBe(false);
    });

    it('should respect passed suppressions', () => {
      const source = 'execute(`SELECT * FROM users WHERE id = ${id}`);';
      const suppressions = [
        {
          ruleId: 'SAST-001',
          file: 'app.ts',
          line: 1, // 1-indexed line number
          justification: 'test',
          suppressedBy: 'user',
          suppressedAt: 'now',
        }
      ];
      const findings = scanSource(source, 'app.ts', BUILTIN_RULES, suppressions);
      expect(findings.some(f => f.ruleId === 'SAST-001')).toBe(false);
    });
  });

  describe('scanFiles', () => {
    it('should scan multiple files and calculate score', () => {
      const files = new Map([
        ['file1.ts', 'execute(`SELECT * FROM users WHERE id = ${id}`);'],
        ['file2.ts', 'document.write("test");'],
      ]);
      const report = scanFiles(files);
      expect(report.filesScanned).toBe(2);
      expect(report.totalFindings).toBeGreaterThan(0);
      expect(report.securityScore).toBeLessThan(100);
      expect(report.bySeverity.critical).toBeGreaterThanOrEqual(1); // SQLi is critical
      expect(report.bySeverity.high).toBeGreaterThanOrEqual(1); // XSS is high
    });
  });

  describe('Utility functions', () => {
    it('should list rules', () => {
      const rules = listRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('category');
    });

    it('should get a single rule', () => {
      const rule = getRule('SAST-001');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('SAST-001');

      const missingRule = getRule('NON_EXISTENT');
      expect(missingRule).toBeUndefined();
    });

    it('should filter rules', () => {
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
