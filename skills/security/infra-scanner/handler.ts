import {
  auditDockerCompose,
  auditTlsCerts,
  auditEnvFile,
  generateInfraReport,
  type DockerComposeService,
  type TlsCertInfo,
} from '@sven/security-toolkit/infra-scanner';

type InputPayload = {
  action: 'audit_compose' | 'audit_tls' | 'audit_env' | 'full_report';
  services?: DockerComposeService[];
  certs?: TlsCertInfo[];
  env_content?: string;
  env_path?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'audit_compose': {
      if (!payload.services || payload.services.length === 0) {
        throw new Error('services array is required');
      }
      const findings = auditDockerCompose(payload.services);
      const report = generateInfraReport(findings);
      return { action, result: report };
    }

    case 'audit_tls': {
      if (!payload.certs || payload.certs.length === 0) {
        throw new Error('certs array is required');
      }
      const findings = auditTlsCerts(payload.certs);
      const report = generateInfraReport(findings);
      return { action, result: report };
    }

    case 'audit_env': {
      if (!payload.env_content) throw new Error('env_content is required');
      const filePath = payload.env_path ?? '.env';
      const findings = auditEnvFile(payload.env_content, filePath);
      const report = generateInfraReport(findings);
      return { action, result: report };
    }

    case 'full_report': {
      const allFindings = [
        ...auditDockerCompose(payload.services ?? []),
        ...auditTlsCerts(payload.certs ?? []),
        ...(payload.env_content ? auditEnvFile(payload.env_content, payload.env_path ?? '.env') : []),
      ];
      const report = generateInfraReport(allFindings);
      return { action, result: report };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
