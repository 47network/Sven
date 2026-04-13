import {
  auditDependencies,
  parseDependencies,
  classifyLicense,
  checkTyposquat,
  type KnownVulnerability,
} from '@sven/security-toolkit/dependency-audit';

type InputPayload = {
  action: 'audit' | 'check_license' | 'check_typosquat' | 'parse_deps';
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  known_vulns?: KnownVulnerability[];
  licenses?: Record<string, string>;
  package_name?: string;
  license?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'audit': {
      const deps = parseDependencies(payload.dependencies ?? {}, payload.devDependencies ?? {});
      const licenseMap = new Map(Object.entries(payload.licenses ?? {}));
      const report = auditDependencies(deps, payload.known_vulns ?? [], licenseMap);
      return { action, result: report };
    }

    case 'check_license': {
      if (!payload.license) throw new Error('license string is required');
      const result = classifyLicense(payload.license);
      return { action, result: { license: payload.license, ...result } };
    }

    case 'check_typosquat': {
      if (!payload.package_name) throw new Error('package_name is required');
      const result = checkTyposquat(payload.package_name);
      return { action, result: { package: payload.package_name, ...result } };
    }

    case 'parse_deps': {
      const deps = parseDependencies(payload.dependencies ?? {}, payload.devDependencies ?? {});
      return { action, result: { packages: deps, total: deps.length } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
