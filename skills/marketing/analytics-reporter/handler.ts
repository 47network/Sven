import {
  calculateChannelMetrics,
  aggregateMetrics,
  generateMarketingReport,
  type ChannelMetrics,
  type AggregateTotals,
  type MetricPeriod,
  type ContentRanking,
} from '@sven/marketing-intel/analytics';

type InputPayload = {
  action: 'channel_metrics' | 'aggregate' | 'report';
  channel?: string;
  data?: { reach: number; impressions: number; engagement: number; clicks: number; conversions: number; spend: number };
  channel_data?: ChannelMetrics[];
  period?: MetricPeriod;
  start_date?: string;
  end_date?: string;
  previous_totals?: AggregateTotals;
  top_content?: ContentRanking[];
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'channel_metrics': {
      if (!payload.channel) throw new Error('channel is required');
      if (!payload.data) throw new Error('data is required');
      const metrics = calculateChannelMetrics(payload.channel, payload.data);
      return { action, result: metrics };
    }

    case 'aggregate': {
      if (!payload.channel_data) throw new Error('channel_data is required');
      const period = payload.period ?? 'weekly';
      const startDate = payload.start_date ?? new Date().toISOString().slice(0, 10);
      const endDate = payload.end_date ?? new Date().toISOString().slice(0, 10);
      const metrics = aggregateMetrics(
        payload.channel_data,
        period,
        startDate,
        endDate,
        payload.previous_totals,
      );
      return { action, result: metrics };
    }

    case 'report': {
      if (!payload.channel_data) throw new Error('channel_data is required');
      const period = payload.period ?? 'weekly';
      const startDate = payload.start_date ?? new Date().toISOString().slice(0, 10);
      const endDate = payload.end_date ?? new Date().toISOString().slice(0, 10);
      const metrics = aggregateMetrics(
        payload.channel_data,
        period,
        startDate,
        endDate,
        payload.previous_totals,
      );
      const report = generateMarketingReport(metrics, payload.top_content);
      return { action, result: report };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
