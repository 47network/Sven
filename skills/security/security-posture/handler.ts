import {
  generateSecurityPosture,
  generateSecurityDigest,
  postureToMarkdown,
  type SecurityPosture,
} from '@sven/security-toolkit/report';
import type { SastReport } from '@sven/security-toolkit/sast';
import type { DepAuditReport } from '@sven/security-toolkit/dependency-audit';
import type { SecretScanReport } from '@sven/security-toolkit/secret-scanner';
import type { InfraAuditReport } from '@sven/security-toolkit/infra-scanner';
import type { PentestReport } from '@sven/security-toolkit/pentest';

type InputPayload = {
  action: 'posture' | 'digest' | 'markdown';
  sast?: SastReport;
  dependencies?: DepAuditReport;
  secrets?: SecretScanReport;
  infrastructure?: InfraAuditReport;
  pentest?: PentestReport;
  previous?: SecurityPosture;
  period?: 'daily' | 'weekly';
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'posture': {
      const posture = generateSecurityPosture({
        sast: payload.sast ?? null,
        dependencies: payload.dependencies ?? null,
        secrets: payload.secrets ?? null,
        infrastructure: payload.infrastructure ?? null,
        pentest: payload.pentest ?? null,
      });
      return { action, result: posture };
    }

    case 'digest': {
      const posture = generateSecurityPosture({
        sast: payload.sast ?? null,
        dependencies: payload.dependencies ?? null,
        secrets: payload.secrets ?? null,
        infrastructure: payload.infrastructure ?? null,
        pentest: payload.pentest ?? null,
      });
      const digest = generateSecurityDigest(posture, payload.previous ?? null, payload.period ?? 'weekly');
      return { action, result: digest };
    }

    case 'markdown': {
      const posture = generateSecurityPosture({
        sast: payload.sast ?? null,
        dependencies: payload.dependencies ?? null,
        secrets: payload.secrets ?? null,
        infrastructure: payload.infrastructure ?? null,
        pentest: payload.pentest ?? null,
      });
      const markdown = postureToMarkdown(posture);
      return { action, result: { markdown, posture } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
