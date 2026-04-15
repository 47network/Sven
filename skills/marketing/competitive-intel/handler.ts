import {
  createProfile,
  createSignal,
  generateWeeklyReport,
  buildThreatMatrix,
  type CompetitorProfile,
  type CompetitorSignal,
  type SignalType,
} from '@sven/marketing-intel/competitive-intel';

type InputPayload = {
  action: 'create_profile' | 'add_signal' | 'weekly_report' | 'threat_matrix';
  name?: string;
  website?: string;
  competitor_id?: string;
  signal_type?: SignalType;
  title?: string;
  content?: string;
  source_url?: string;
  profiles?: CompetitorProfile[];
  signals?: CompetitorSignal[];
  previous_signals?: CompetitorSignal[];
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'create_profile': {
      if (!payload.name) throw new Error('name is required');
      const profile = createProfile(payload.name, { website: payload.website ?? null });
      return { action, result: profile };
    }

    case 'add_signal': {
      if (!payload.competitor_id) throw new Error('competitor_id is required');
      if (!payload.signal_type) throw new Error('signal_type is required');
      if (!payload.title) throw new Error('title is required');
      const signal = createSignal(
        payload.competitor_id,
        payload.signal_type,
        payload.title,
        payload.content ?? '',
        payload.source_url ?? null,
      );
      return { action, result: signal };
    }

    case 'weekly_report': {
      const profiles = payload.profiles ?? [];
      const signals = payload.signals ?? [];
      const report = generateWeeklyReport(profiles, signals);
      return { action, result: report };
    }

    case 'threat_matrix': {
      const profiles = payload.profiles ?? [];
      const signals = payload.signals ?? [];
      const prev = payload.previous_signals ?? [];
      const matrix = buildThreatMatrix(profiles, signals, prev);
      return { action, result: { threats: matrix } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
