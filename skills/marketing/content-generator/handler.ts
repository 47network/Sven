import {
  createBrief,
  analyzeContent,
  generateCalendar,
  type ContentType,
  type Channel,
} from '@sven/marketing-intel/content-generator';

type InputPayload = {
  action: 'create_brief' | 'analyze' | 'calendar';
  content_type?: ContentType;
  channel?: Channel;
  title?: string;
  body?: string;
  start_date?: string;
  weeks?: number;
  channels?: Channel[];
  key_points?: string[];
  keywords?: string[];
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'create_brief': {
      if (!payload.content_type) throw new Error('content_type is required');
      if (!payload.channel) throw new Error('channel is required');
      if (!payload.title) throw new Error('title is required');
      const brief = createBrief(payload.content_type, payload.channel, payload.title, {
        keyPoints: payload.key_points,
        keywords: payload.keywords,
      });
      return { action, result: brief };
    }

    case 'analyze': {
      if (!payload.body) throw new Error('body is required');
      if (!payload.content_type) throw new Error('content_type is required');
      if (!payload.channel) throw new Error('channel is required');
      const brief = createBrief(payload.content_type, payload.channel, payload.title ?? 'Untitled');
      const analysis = analyzeContent(payload.body, brief);
      return { action, result: analysis };
    }

    case 'calendar': {
      const startDate = payload.start_date ?? new Date().toISOString().slice(0, 10);
      const weeks = payload.weeks ?? 4;
      const channels = payload.channels ?? ['blog', 'twitter', 'linkedin', 'email'] as Channel[];
      const calendar = generateCalendar(startDate, weeks, channels);
      return { action, result: { entries: calendar, weeks, channels } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
