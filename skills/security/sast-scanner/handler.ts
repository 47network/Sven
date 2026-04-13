import {
  scanFiles,
  listRules,
  getRule,
  filterRules,
  type Severity,
  type VulnerabilityCategory,
} from '@sven/security-toolkit/sast';

type InputPayload = {
  action: 'scan' | 'list_rules' | 'get_rule' | 'filter_rules';
  files?: Record<string, string>;
  rule_id?: string;
  severity?: Severity;
  category?: VulnerabilityCategory;
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
      const report = scanFiles(fileMap);
      return { action, result: report };
    }

    case 'list_rules': {
      return { action, result: { rules: listRules() } };
    }

    case 'get_rule': {
      if (!payload.rule_id) throw new Error('rule_id is required');
      const rule = getRule(payload.rule_id);
      if (!rule) return { action, result: { error: `Unknown rule: ${payload.rule_id}` } };
      return { action, result: { ...rule, patterns: rule.patterns.map((p) => p.source) } };
    }

    case 'filter_rules': {
      const rules = filterRules({ severity: payload.severity, category: payload.category });
      return { action, result: { rules: rules.map((r) => ({ id: r.id, category: r.category, severity: r.severity, title: r.title })) } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
