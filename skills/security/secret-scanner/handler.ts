import {
  scanForSecrets,
  scanFileForSecrets,
  shannonEntropy,
} from '@sven/security-toolkit/secret-scanner';

type InputPayload = {
  action: 'scan' | 'scan_file' | 'check_entropy';
  files?: Record<string, string>;
  file_path?: string;
  file_content?: string;
  text?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'scan': {
      if (!payload.files || Object.keys(payload.files).length === 0) {
        throw new Error('files map is required for scanning');
      }
      const fileMap = new Map(Object.entries(payload.files));
      const report = scanForSecrets(fileMap);
      return { action, result: report };
    }

    case 'scan_file': {
      if (!payload.file_path || !payload.file_content) {
        throw new Error('file_path and file_content are required');
      }
      const findings = scanFileForSecrets(payload.file_content, payload.file_path);
      return {
        action,
        result: {
          file: payload.file_path,
          secretsFound: findings.length,
          findings,
          clean: findings.length === 0,
        },
      };
    }

    case 'check_entropy': {
      if (!payload.text) throw new Error('text is required');
      const entropy = shannonEntropy(payload.text);
      return {
        action,
        result: {
          text_length: payload.text.length,
          entropy_bits_per_char: Math.round(entropy * 1000) / 1000,
          is_high_entropy: entropy > 4.0,
          assessment: entropy > 4.5 ? 'Likely random/secret' : entropy > 3.5 ? 'Possibly random' : 'Likely not random',
        },
      };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
