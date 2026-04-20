import {
  composeAnimation,
  getEasing,
  getEasingsByCategory,
  EASING_PRESETS,
  getSpringPreset,
  simulateSpring,
  generateStagger,
  recommendDuration,
  easingTokensToCSS,
  durationTokensToCSS,
  type AnimationIntent,
  type ElementCategory,
  type EasingPreset,
} from '@sven/design-system/motion';

type InputPayload = {
  action: 'animate' | 'easing' | 'spring' | 'stagger' | 'duration' | 'css_tokens';
  intent?: AnimationIntent;
  category?: ElementCategory;
  easing_name?: string;
  easing_category?: EasingPreset['category'];
  spring_preset?: string;
  stagger_count?: number;
  stagger_delay_ms?: number;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'animate': {
      const intent = payload.intent ?? 'slide-up';
      const category = payload.category ?? 'medium';
      const spec = composeAnimation(intent, category);
      const fullCSS = [spec.keyframes, '', `.${spec.name} {`, `  animation: ${spec.name} ${spec.duration} ${spec.easing} ${spec.fillMode};`, '}', '', spec.reducedMotionFallback].join('\n');
      return { action, result: { ...spec, fullCSS } };
    }

    case 'easing': {
      if (payload.easing_name) {
        const preset = getEasing(payload.easing_name);
        if (!preset) {
          return { action, result: { error: `Unknown easing: ${payload.easing_name}`, available: EASING_PRESETS.map((p) => p.name) } };
        }
        return { action, result: preset };
      }
      if (payload.easing_category) {
        const presets = getEasingsByCategory(payload.easing_category);
        return { action, result: { category: payload.easing_category, presets } };
      }
      return { action, result: { presets: EASING_PRESETS } };
    }

    case 'spring': {
      const presetName = payload.spring_preset ?? 'default';
      const config = getSpringPreset(presetName);
      if (!config) {
        return { action, result: { error: `Unknown spring preset: ${presetName}`, available: ['gentle', 'default', 'snappy', 'wobbly', 'stiff', 'slow'] } };
      }
      const result = simulateSpring(config);
      return { action, result: { preset: presetName, config, duration: `${result.duration}ms`, cssKeyframes: result.cssKeyframes } };
    }

    case 'stagger': {
      const count = Math.max(2, Math.min(50, payload.stagger_count ?? 5));
      const intent = payload.intent ?? 'slide-up';
      const category = payload.category ?? 'medium';
      const delayMs = Math.max(10, Math.min(500, payload.stagger_delay_ms ?? 50));
      const css = generateStagger(count, intent, category, delayMs);
      return { action, result: { count, intent, category, stagger_delay_ms: delayMs, css } };
    }

    case 'duration': {
      const category = payload.category ?? 'medium';
      const result = recommendDuration(category);
      return { action, result: { category, ...result } };
    }

    case 'css_tokens': {
      const easingCSS = easingTokensToCSS();
      const durationCSS = durationTokensToCSS();
      return { action, result: { css: `${easingCSS}\n\n${durationCSS}` } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
