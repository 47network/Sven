import {
  shannonEntropy,
  redactSecret,
  shouldScanFile,
  scanFileForSecrets,
  scanForSecrets,
  SECRET_PATTERNS
} from '../index';

describe('secret-scanner', () => {
  describe('shannonEntropy', () => {
    it('returns 0 for an empty string', () => {
      expect(shannonEntropy('')).toBe(0);
    });

    it('returns 0 for a single character string', () => {
      expect(shannonEntropy('a')).toBe(0);
    });

    it('returns > 0 for strings with multiple distinct characters', () => {
      expect(shannonEntropy('abc')).toBeGreaterThan(1);
    });

    it('calculates higher entropy for more complex/random strings', () => {
      const low = shannonEntropy('aaaaabbbbb');
      const high = shannonEntropy('a1b2c3d4e5f6');
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('redactSecret', () => {
    it('redacts the entire secret with *** if length <= 8', () => {
      expect(redactSecret('12345678')).toBe('***');
      expect(redactSecret('123')).toBe('***');
    });

    it('redacts middle characters if length > 8', () => {
      expect(redactSecret('1234567890')).toBe('1***0');
      expect(redactSecret('123456789012345678901234567890')).toBe('1234***7890');
    });
  });

  describe('shouldScanFile', () => {
    it('returns false for excluded extensions', () => {
      expect(shouldScanFile('image.png')).toBe(false);
      expect(shouldScanFile('archive.zip')).toBe(false);
      expect(shouldScanFile('audio.mp3')).toBe(false);
      expect(shouldScanFile('document.pdf')).toBe(false);
    });

    it('returns false for excluded directories', () => {
      expect(shouldScanFile('node_modules/library/index.js')).toBe(false);
      expect(shouldScanFile('dist/bundle.js')).toBe(false);
      expect(shouldScanFile('.git/config')).toBe(false);
    });

    it('returns true for valid file paths', () => {
      expect(shouldScanFile('packages/security-toolkit/src/secret-scanner/index.ts')).toBe(true);
      expect(shouldScanFile('config.json')).toBe(true);
      expect(shouldScanFile('src/app.tsx')).toBe(true);
    });
  });

  describe('scanFileForSecrets', () => {
    it('finds AWS access keys', () => {
      const source = `const awsKey = "AKIA1234567890ABCDEF";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('aws-access-key');
      expect(findings[0].matchedText).toBe('AKIA1234567890ABCDEF');
      expect(findings[0].line).toBe(1);
    });

    it('finds generic passwords exceeding entropy', () => {
      const source = `const password = "pA5$w0rd_VeryC0mplex!99";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('generic-password');
    });

    it('ignores generic passwords with low entropy', () => {
      const source = `const password = "aaaaaaaabbbbbbbb";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      const pwdFindings = findings.filter(f => f.type === 'generic-password');
      expect(pwdFindings).toHaveLength(0);
    });

    it('skips lines with example/docs comments', () => {
      const source = `// Example: const awsKey = "AKIA1234567890ABCDEF";`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });

    it('skips lines with inline suppression', () => {
      const source = `const awsKey = "AKIA1234567890ABCDEF"; // secret-scan-disable`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });

    it('skips simple env var references without large strings', () => {
      const source = `const key = process.env.AWS_ACCESS_KEY_ID;`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });
  });

  describe('scanForSecrets', () => {
    it('aggregates findings across multiple files', () => {
      const files = new Map<string, string>();
      files.set('valid.ts', `const key = "AKIA1234567890ABCDEF";`);
      files.set('ignored.png', `const key = "AKIA1234567890ABCDEF";`);
      files.set('clean.ts', `const noSecretsHere = true;`);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(3);
      expect(report.secretsFound).toBe(1);
      expect(report.clean).toBe(false);
      expect(report.byType['aws-access-key']).toBe(1);
      expect(report.bySeverity.critical).toBeGreaterThan(0);
      expect(report.findings[0].file).toBe('valid.ts');
    });

    it('returns clean report if no secrets found', () => {
      const files = new Map<string, string>();
      files.set('clean.ts', `const noSecretsHere = true;`);

      const report = scanForSecrets(files);

      expect(report.secretsFound).toBe(0);
      expect(report.clean).toBe(true);
      expect(report.bySeverity.critical).toBe(0);
      expect(report.bySeverity.high).toBe(0);
      expect(report.bySeverity.medium).toBe(0);
    });
  });

  describe('SECRET_PATTERNS', () => {
    // Helper to test if a string matches a specific pattern ID
    const matchesPattern = (text: string, patternId: string) => {
      const pattern = SECRET_PATTERNS.find(p => p.id === patternId);
      if (!pattern) return false;
      return pattern.pattern.test(text);
    };

    it('SEC-001 (aws-access-key) matches AWS Access Key IDs', () => {
      expect(matchesPattern('AKIA' + '1234567890ABCDEF', 'SEC-001')).toBe(true);
      expect(matchesPattern('const k = "AKIA' + '1234567890ABCDEF";', 'SEC-001')).toBe(true);
      expect(matchesPattern('FAKE1234567890ABCDEF', 'SEC-001')).toBe(false);
    });

    it('SEC-002 (aws-secret-key) matches AWS Secret Access Keys', () => {
      expect(matchesPattern('aws_secret_access_key=' + 'a1b2c3d4e5f6g7h8i9j0A1B2C3D4E5F6G7H8I9J0', 'SEC-002')).toBe(true);
      expect(matchesPattern('aws_secret: "' + 'a1b2c3d4e5f6g7h8i9j0A1B2C3D4E5F6G7H8I9J0' + '"', 'SEC-002')).toBe(true);
    });

    it('SEC-003 (github-token) matches GitHub PAT classic', () => {
      expect(matchesPattern('ghp_' + 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8', 'SEC-003')).toBe(true);
    });

    it('SEC-004 (github-fine-grained) matches GitHub fine-grained tokens', () => {
      expect(matchesPattern('github_pat_' + '11AABBCCDDEEFF0011223344556677889900aabbccddeeff11223344556677889900aabbccddeeff11', 'SEC-004')).toBe(true);
    });

    it('SEC-005 (gitlab-token) matches GitLab PAT', () => {
      expect(matchesPattern('glpat-' + 'a1b2c3d4e5f6-g7h8i9j', 'SEC-005')).toBe(true);
    });

    it('SEC-006 (slack-token) matches Slack tokens', () => {
      expect(matchesPattern('xoxb-' + '123456789012-1234567890123-abcdef123456', 'SEC-006')).toBe(true);
      expect(matchesPattern('xoxp-' + '123456789012-1234567890123-abcdef123456', 'SEC-006')).toBe(true);
    });

    it('SEC-007 (slack-webhook) matches Slack webhooks', () => {
      expect(matchesPattern('https://hooks.slack.com/services/T' + '12345678/B' + '12345678/abcdef1234567890', 'SEC-007')).toBe(true);
    });

    it('SEC-008 (stripe-key) matches Stripe API keys', () => {
      expect(matchesPattern('sk_live_' + 'a1b2c3d4e5f6g7h8i9j0k1l2', 'SEC-008')).toBe(true);
      expect(matchesPattern('sk_test_' + 'a1b2c3d4e5f6g7h8i9j0k1l2', 'SEC-008')).toBe(true);
    });

    it('SEC-009 (twilio-key) matches Twilio API keys', () => {
      expect(matchesPattern('SK' + 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'SEC-009')).toBe(true);
    });

    it('SEC-010 (sendgrid-key) matches SendGrid API keys', () => {
      expect(matchesPattern('SG.' + 'a1b2c3d4e5f6g7h8i9j0k1' + '.' + 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v', 'SEC-010')).toBe(true);
    });

    it('SEC-011 (jwt) matches JSON Web Tokens', () => {
      expect(matchesPattern('eyJ' + 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' + '.eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' + '.' + 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', 'SEC-011')).toBe(true);
    });

    it('SEC-012 (private-key) matches Private Keys', () => {
      expect(matchesPattern('-----BEGIN RSA PRIVATE KEY-----', 'SEC-012')).toBe(true);
      expect(matchesPattern('-----BEGIN PRIVATE KEY-----', 'SEC-012')).toBe(true);
      expect(matchesPattern('-----BEGIN OPENSSH PRIVATE KEY-----', 'SEC-012')).toBe(true);
    });

    it('SEC-013 (npm-token) matches npm access tokens', () => {
      expect(matchesPattern('npm_' + 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8', 'SEC-013')).toBe(true);
    });

    it('SEC-014 (pypi-token) matches PyPI API tokens', () => {
      expect(matchesPattern('pypi-' + 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6', 'SEC-014')).toBe(true);
    });

    it('SEC-015 (gcp-service-account) matches GCP Service Account Keys', () => {
      expect(matchesPattern('"type": "service_account"', 'SEC-015')).toBe(true);
    });

    it('SEC-016 (database-url) matches Database URLs with credentials', () => {
      expect(matchesPattern('postgres://user:pass@localhost:5432/db', 'SEC-016')).toBe(true);
      expect(matchesPattern('mongodb://user:pass@localhost:27017/db', 'SEC-016')).toBe(true);
      expect(matchesPattern('redis://user:pass@localhost:6379/0', 'SEC-016')).toBe(true);
    });

    it('SEC-017 (generic-api-key) matches generic API key assignment', () => {
      expect(matchesPattern('apiKey="' + 'a1b2c3d4e5f6g7h8i9j0' + '"', 'SEC-017')).toBe(true);
    });

    it('SEC-018 (generic-password) matches generic password assignment', () => {
      expect(matchesPattern('password="' + 'supersecret123' + '"', 'SEC-018')).toBe(true);
    });

    it('SEC-019 (basic-auth-header) matches Basic Auth Headers', () => {
      expect(matchesPattern('Authorization: Basic ' + 'dW5kZWZpbmVkOnVuZGVmaW5lZA==', 'SEC-019')).toBe(true);
    });

    it('SEC-020 (bearer-token) matches hardcoded Bearer Tokens', () => {
      expect(matchesPattern('Authorization: Bearer ' + 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0', 'SEC-020')).toBe(true);
    });
  });
});
