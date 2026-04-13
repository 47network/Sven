type InputPayload = {
  action: 'generate_review';
  accomplishments: string;
  level?: string;
  target_level?: string;
  name?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  if (payload.action !== 'generate_review') throw new Error(`Unsupported action: ${payload.action}`);
  if (!payload.accomplishments) throw new Error('accomplishments is required');

  const name = payload.name ?? '[Employee Name]';
  const level = payload.level ?? 'current level';
  const targetLevel = payload.target_level ?? 'next level';

  // Parse accomplishments into structured items
  const items = payload.accomplishments
    .split(/[\n•\-\d.]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  // Categorise accomplishments
  const categories: Record<string, string[]> = {
    'Strategic Impact': [],
    'Technical Excellence': [],
    'Leadership & Collaboration': [],
    'Operational Improvements': [],
  };

  const techTerms = ['built', 'implemented', 'designed', 'architecture', 'system', 'code', 'deploy', 'infra', 'api', 'database', 'migration'];
  const leaderTerms = ['led', 'mentored', 'collaborated', 'team', 'hired', 'onboarded', 'coordinated', 'facilitated'];
  const opsTerms = ['reduced', 'improved', 'automated', 'optimised', 'saved', 'eliminated', 'streamlined'];

  for (const item of items) {
    const lower = item.toLowerCase();
    if (leaderTerms.some((t) => lower.includes(t))) {
      categories['Leadership & Collaboration'].push(item);
    } else if (opsTerms.some((t) => lower.includes(t))) {
      categories['Operational Improvements'].push(item);
    } else if (techTerms.some((t) => lower.includes(t))) {
      categories['Technical Excellence'].push(item);
    } else {
      categories['Strategic Impact'].push(item);
    }
  }

  // Generate review
  const sections: string[] = [
    `# Performance Review: ${name}`,
    '',
    `**Current Level**: ${level}`,
    `**Recommended Level**: ${targetLevel}`,
    `**Review Period**: Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    `${name} has delivered consistently at the ${targetLevel} level this quarter, ` +
    `demonstrating the scope, impact, and judgment expected of someone operating ` +
    `well beyond their current title. Their contributions span ${Object.entries(categories).filter(([, v]) => v.length > 0).length} ` +
    `key areas and have produced measurable business outcomes.`,
    '',
  ];

  for (const [category, categoryItems] of Object.entries(categories)) {
    if (categoryItems.length === 0) continue;
    sections.push(`## ${category}`, '');
    for (const item of categoryItems) {
      sections.push(`- **${item}** — This work demonstrates ${levelVerb(category)} thinking and direct business impact.`);
    }
    sections.push('');
  }

  sections.push(
    '## Growth Trajectory',
    '',
    `${name} has shown a clear and consistent trajectory toward ${targetLevel}-level work. ` +
    `Key growth indicators this quarter:`,
    '',
    `- **Scope expansion**: Took on broader, cross-functional responsibilities`,
    `- **Decision quality**: Made sound trade-offs under ambiguity`,
    `- **Influence**: Shaped technical direction beyond their immediate area`,
    `- **Autonomy**: Required minimal direction to deliver high-impact outcomes`,
    '',
    '## Recommendation',
    '',
    `Based on the evidence above, I strongly recommend promoting ${name} to ${targetLevel}. ` +
    `Their impact already operates at that level, and the title adjustment recognises ` +
    `the responsibility they have already earned through performance.`,
  );

  return {
    action: 'generate_review',
    result: {
      markdown: sections.join('\n'),
      categories: Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, v.length]),
      ),
      totalAccomplishments: items.length,
    },
  };
}

function levelVerb(category: string): string {
  switch (category) {
    case 'Strategic Impact': return 'strategic';
    case 'Technical Excellence': return 'senior-level technical';
    case 'Leadership & Collaboration': return 'leadership-level';
    case 'Operational Improvements': return 'ownership-level operational';
    default: return 'high-impact';
  }
}
