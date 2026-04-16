import { jest, expect, describe, it } from '@jest/globals';
import {
  shannonEntropy,
  redactSecret,
  SECRET_PATTERNS,
  shouldScanFile,
  scanFileForSecrets,
  scanForSecrets
} from '../secret-scanner/index.js';

describe('Secret Scanner', () => {
  describe('shannonEntropy', () => {
    it('should return 0 for an empty string', () => {
      expect(shannonEntropy('')).toBe(0);
    });

    it('should return 0 for a string with identical characters', () => {
      expect(shannonEntropy('aaaa')).toBe(0);
    });

    it('should return a positive entropy for varied characters', () => {
      expect(shannonEntropy('abcd')).toBeGreaterThan(1);
    });
  });

  describe('redactSecret', () => {
    it('should completely redact secrets length 8 or less', () => {
      expect(redactSecret('12345678')).toBe('***');
      expect(redactSecret('abc')).toBe('***');
    });

    it('should partially redact secrets longer than 8 characters', () => {
      const secret = '12345678901234567890'; // 20 chars
      const redacted = redactSecret(secret);
      // 20 * 0.15 = 3
      expect(redacted).toBe('123***890');

      const longerSecret = '1234567890123456789012345678901234567890'; // 40 chars
      const longerRedacted = redactSecret(longerSecret);
      // Math.min(4, Math.floor(40 * 0.15)) = Math.min(4, 6) = 4
      expect(longerRedacted).toBe('1234***7890');
    });
  });

  describe('shouldScanFile', () => {
    it('should skip excluded extensions', () => {
      expect(shouldScanFile('image.png')).toBe(false);
      expect(shouldScanFile('document.pdf')).toBe(false);
      expect(shouldScanFile('yarn.lock')).toBe(false);
    });

    it('should skip excluded paths', () => {
      expect(shouldScanFile('node_modules/library/index.js')).toBe(false);
      expect(shouldScanFile('.git/config')).toBe(false);
      expect(shouldScanFile('dist/bundle.js')).toBe(false);
    });

    it('should include scan-worthy files', () => {
      expect(shouldScanFile('src/index.ts')).toBe(true);
      expect(shouldScanFile('.env')).toBe(true);
      expect(shouldScanFile('config.json')).toBe(true);
    });
  });

  describe('scanFileForSecrets', () => {
    it('should return an empty array if no secrets are found', () => {
      const source = `
        const a = 1;
        const b = 2;
        console.log(a + b);
      `;
      expect(scanFileForSecrets(source, 'file.js')).toEqual([]);
    });

    it('should skip lines with exclusion markers or environment variables', () => {
      const source = `
        // example your_key = "SG.abcde12345abcde12345.abcde12345abcde12345abcde12345abcde12345abc"
        const key = process.env.AWS_SECRET_ACCESS_KEY;
        // secret-scan-disable
        const myKey = "SG.abcde12345abcde12345.abcde12345abcde12345abcde12345abcde12345abc";
      `;
      expect(scanFileForSecrets(source, 'file.js')).toEqual([]);
    });

    it('should detect AWS Access Keys', () => {
      const source = `const awsKey = "AKIA1234567890ABCDEF";`;
      const findings = scanFileForSecrets(source, 'file.js');
      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('aws-access-key');
      expect(findings[0].matchedText).toBe('AKIA1234567890ABCDEF');
      expect(findings[0].severity).toBe('critical');
    });

    it('should enforce entropy gates for generic patterns', () => {
      // "aaaa..." has low entropy
      const lowEntropySource = `const apiKey = "aaaaaaaaaaaaaaaaaaaa";`;
      expect(scanFileForSecrets(lowEntropySource, 'file.js')).toEqual([]);

      // "random..." has higher entropy
      const highEntropySource = `const apiKey = "a1b2c3d4e5f6g7h8i9j0";`;
      const findings = scanFileForSecrets(highEntropySource, 'file.js');
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('generic-api-key');
    });
  });

  describe('scanForSecrets', () => {
    it('should scan multiple files and produce a report', () => {
      const files = new Map([
        ['src/index.ts', 'const a = 1;'],
        ['src/config.js', 'const AWS_KEY = "AKIA1234567890ABCDEF";'],
        ['node_modules/test/index.js', 'const AWS_KEY = "AKIA1234567890ABCDEF";'], // should be ignored
      ]);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(3); // Wait, shouldScanFile filters inside the loop, the size of files is 3. The `filesScanned` uses `files.size`, so 3.
      expect(report.secretsFound).toBe(1);
      expect(report.clean).toBe(false);
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].file).toBe('src/config.js');
      expect(report.byType['aws-access-key']).toBe(1);
      expect(report.bySeverity.critical).toBe(1);
    });

    it('should return a clean report when no secrets are found', () => {
      const files = new Map([
        ['src/index.ts', 'const a = 1;'],
      ]);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(1);
      expect(report.secretsFound).toBe(0);
      expect(report.clean).toBe(true);
      expect(report.findings).toHaveLength(0);
    });
  });
});
