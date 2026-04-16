import {
  generateSecurityPosture,
  generateSecurityDigest,
  postureToMarkdown,
  type SecurityPosture,
} from '../report/index.js';
import type { SastReport } from '../sast/index.js';
import type { DepAuditReport } from '../dependency-audit/index.js';
import type { SecretScanReport } from '../secret-scanner/index.js';
import type { InfraAuditReport } from '../infra-scanner/index.js';
import type { PentestReport } from '../pentest/index.js';

describe('Security Report Generator', () => {
  const mockSastReport: SastReport = {
    generatedAt: new Date().toISOString(),
    securityScore: 80,
    bySeverity: { critical: 0, high: 1, medium: 2, low: 3 },
    byCategory: {
      'sql-injection': 0,
      'command-injection': 0,
      'xss': 0,
      'auth-bypass': 0,
    },
    findings: [],
  };

  const mockDepAuditReport: DepAuditReport = {
    generatedAt: new Date().toISOString(),
    securityScore: 85,
    byRisk: { critical: 0, high: 0, medium: 1, low: 0 },
    findings: [],
  };

  const mockSecretScanReport: SecretScanReport = {
    generatedAt: new Date().toISOString(),
    clean: true,
    secretsFound: 0,
    bySeverity: { critical: 0, high: 0, medium: 0 },
    findings: [],
  };

  const mockInfraAuditReport: InfraAuditReport = {
    generatedAt: new Date().toISOString(),
    securityScore: 90,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    findings: [],
  };

  const mockPentestReport: PentestReport = {
    generatedAt: new Date().toISOString(),
    overallScore: 75,
    vulnerabilities: [],
  };

  describe('generateSecurityPosture', () => {
    it('should calculate the correct overall score and grade', () => {
      const posture = generateSecurityPosture({
        sast: mockSastReport,
        dependencies: mockDepAuditReport,
        secrets: mockSecretScanReport,
        infrastructure: mockInfraAuditReport,
        pentest: mockPentestReport,
      });

      // (80*30 + 85*20 + 100*25 + 90*15 + 75*10) / 100 = (2400 + 1700 + 2500 + 1350 + 750) / 100 = 8700 / 100 = 87
      expect(posture.overallScore).toBe(87);
      expect(posture.grade).toBe('B');
    });

    it('should aggregate severity counts correctly', () => {
      const posture = generateSecurityPosture({
        sast: {
          ...mockSastReport,
          bySeverity: { critical: 1, high: 1, medium: 1, low: 1 },
        },
        dependencies: {
          ...mockDepAuditReport,
          byRisk: { critical: 1, high: 1, medium: 1, low: 1 },
        },
        secrets: {
          ...mockSecretScanReport,
          clean: false,
          secretsFound: 1,
          bySeverity: { critical: 1, high: 1, medium: 1 },
        },
        infrastructure: {
          ...mockInfraAuditReport,
          bySeverity: { critical: 1, high: 1, medium: 1, low: 1 },
        },
        pentest: {
          ...mockPentestReport,
          vulnerabilities: [
            { severity: 'critical', id: '1', name: 'v', description: 'v' },
            { severity: 'high', id: '2', name: 'v', description: 'v' },
            { severity: 'medium', id: '3', name: 'v', description: 'v' },
            { severity: 'low', id: '4', name: 'v', description: 'v' },
          ],
        },
      });

      expect(posture.criticalFindings).toBe(5);
      expect(posture.highFindings).toBe(5);
      expect(posture.mediumFindings).toBe(5);
      expect(posture.lowFindings).toBe(4);
      expect(posture.totalFindings).toBe(19);
    });

    it('should generate appropriate top risks and recommendations', () => {
      const posture = generateSecurityPosture({
        sast: {
          ...mockSastReport,
          bySeverity: { critical: 1, high: 10, medium: 0, low: 0 },
        },
        secrets: {
          ...mockSecretScanReport,
          clean: false,
          secretsFound: 1,
        },
      });

      expect(posture.topRisks).toContain('1 secret(s) found in source code — immediate rotation required');
      expect(posture.topRisks).toContain('1 critical finding(s) require immediate attention');

      expect(posture.recommendations).toContain('Rotate all detected secrets immediately. Remove them from source and use a secrets manager.');
      expect(posture.recommendations).toContain('Address all critical findings before next deployment.');
      expect(posture.recommendations).toContain('Schedule a focused sprint to address high-severity findings.');
    });

    it('should generate compliance notes correctly', () => {
      const posture = generateSecurityPosture({
        sast: {
          ...mockSastReport,
          byCategory: {
            'sql-injection': 1,
            'command-injection': 0,
            'xss': 0,
            'auth-bypass': 0,
          },
        },
      });

      const injectionNote = posture.complianceNotes.find(n => n.control === 'A03:2021-Injection');
      expect(injectionNote?.status).toBe('fail');

      const authNote = posture.complianceNotes.find(n => n.control === 'A07:2021-Auth Failures');
      expect(authNote?.status).toBe('pass');
    });

    it('should handle missing scan reports', () => {
      const posture = generateSecurityPosture({});
      expect(posture.overallScore).toBe(0);
      expect(posture.grade).toBe('F');
      expect(posture.scores.sast).toBeNull();
      expect(posture.complianceNotes.some(n => n.status === 'not-tested')).toBe(true);
    });
  });

  describe('generateSecurityDigest', () => {
    const createPosture = (score: number, total: number, critical: number): SecurityPosture => ({
      generatedAt: new Date().toISOString(),
      overallScore: score,
      grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F',
      scores: { sast: null, dependencies: null, secrets: null, infrastructure: null, pentest: null },
      criticalFindings: critical,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
      totalFindings: total,
      secretsClean: true,
      topRisks: [],
      recommendations: [],
      complianceNotes: [],
    });

    it('should calculate new and resolved findings', () => {
      const current = createPosture(80, 10, 0);
      const previous = createPosture(80, 8, 0);

      const digest = generateSecurityDigest(current, previous, 'daily');

      expect(digest.newFindings).toBe(2);
      expect(digest.resolvedFindings).toBe(0);
    });

    it('should calculate new and resolved findings correctly when findings decrease', () => {
      const current = createPosture(80, 5, 0);
      const previous = createPosture(80, 8, 0);

      const digest = generateSecurityDigest(current, previous, 'daily');

      expect(digest.newFindings).toBe(0);
      expect(digest.resolvedFindings).toBe(3);
    });

    it('should determine the correct trend', () => {
      const current = createPosture(80, 10, 0);

      // Improving
      const previousWorse = createPosture(77, 10, 0);
      expect(generateSecurityDigest(current, previousWorse, 'daily').trend).toBe('improving');

      // Degrading
      const previousBetter = createPosture(83, 10, 0);
      expect(generateSecurityDigest(current, previousBetter, 'daily').trend).toBe('degrading');

      // Stable
      const previousStable = createPosture(81, 10, 0);
      expect(generateSecurityDigest(current, previousStable, 'daily').trend).toBe('stable');
    });

    it('should handle no previous posture', () => {
      const current = createPosture(80, 10, 0);
      const digest = generateSecurityDigest(current, null, 'daily');

      expect(digest.trend).toBe('stable');
      expect(digest.newFindings).toBe(10);
      expect(digest.resolvedFindings).toBe(0);
      expect(digest.summary).toContain('Baseline report');
    });
  });

  describe('postureToMarkdown', () => {
    it('should generate markdown string', () => {
      const posture: SecurityPosture = {
        generatedAt: '2023-10-01T00:00:00.000Z',
        overallScore: 85,
        grade: 'B',
        scores: { sast: 80, dependencies: 90, secrets: 100, infrastructure: 80, pentest: 75 },
        criticalFindings: 0,
        highFindings: 1,
        mediumFindings: 2,
        lowFindings: 3,
        totalFindings: 6,
        secretsClean: true,
        topRisks: ['Risk 1'],
        recommendations: ['Rec 1'],
        complianceNotes: [
          { framework: 'SOC 2', control: 'Control 1', status: 'pass', detail: 'Detail 1' },
          { framework: 'SOC 2', control: 'Control 2', status: 'fail', detail: 'Detail 2' }
        ],
      };

      const markdown = postureToMarkdown(posture);

      expect(markdown).toContain('# Security Posture Report');
      expect(markdown).toContain('**Grade**: B (85/100)');
      expect(markdown).toContain('| SAST | 80 |');
      expect(markdown).toContain('| Critical | 0 |');
      expect(markdown).toContain('## Top Risks');
      expect(markdown).toContain('- Risk 1');
      expect(markdown).toContain('## Recommendations');
      expect(markdown).toContain('- Rec 1');
      expect(markdown).toContain('## Compliance');
      expect(markdown).toContain('| SOC 2 | Control 1 | PASS | Detail 1 |');
      expect(markdown).toContain('| SOC 2 | Control 2 | FAIL | Detail 2 |');
    });
  });
});
