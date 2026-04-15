import {
  createCampaign,
  generateTimeline,
  scoreCampaign,
  campaignToMarkdown,
  type Campaign,
  type CampaignGoal,
  type CampaignBudget,
} from '@sven/marketing-intel/campaign-planner';

type InputPayload = {
  action: 'create' | 'timeline' | 'score' | 'report';
  name?: string;
  description?: string;
  channels?: string[];
  goals?: CampaignGoal[];
  budget?: CampaignBudget;
  campaign?: Campaign;
  duration_weeks?: number;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'create': {
      if (!payload.name) throw new Error('name is required');
      const campaign = createCampaign(payload.name, {
        description: payload.description,
        channels: payload.channels,
        goals: payload.goals,
        budget: payload.budget,
      });
      return { action, result: campaign };
    }

    case 'timeline': {
      const weeks = payload.duration_weeks ?? 4;
      const timeline = generateTimeline(weeks);
      return { action, result: timeline };
    }

    case 'score': {
      if (!payload.campaign) throw new Error('campaign object is required');
      const score = scoreCampaign(payload.campaign);
      return { action, result: score };
    }

    case 'report': {
      if (!payload.campaign) throw new Error('campaign object is required');
      const score = scoreCampaign(payload.campaign);
      const md = campaignToMarkdown(payload.campaign, score);
      return { action, result: { markdown: md, score } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
