import {
  generatePalette,
  generateTheme,
  themeToCSS,
  evaluateContrast,
  simulateColorBlindness,
  hexToOklch,
  type HarmonyMethod,
  type ColorBlindnessType,
} from '@sven/design-system/color';

type InputPayload = {
  action: 'palette' | 'theme' | 'contrast' | 'blindness' | 'css_theme';
  seed_color?: string;
  method?: HarmonyMethod;
  palette_name?: string;
  foreground?: string;
  background?: string;
  blindness_type?: ColorBlindnessType;
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function validateHex(value: string | undefined, fieldName: string): string {
  if (!value) throw new Error(`${fieldName} is required`);
  if (!HEX_PATTERN.test(value)) throw new Error(`${fieldName} must be a valid hex color (e.g. #3366ff)`);
  return value;
}

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'palette': {
      const seed = validateHex(payload.seed_color, 'seed_color');
      const method = payload.method ?? 'triadic';
      const name = payload.palette_name ?? undefined;
      const palette = generatePalette(seed, method, name);
      return { action, result: palette };
    }

    case 'theme': {
      const seed = validateHex(payload.seed_color, 'seed_color');
      const theme = generateTheme(seed);
      return { action, result: theme };
    }

    case 'contrast': {
      const fg = validateHex(payload.foreground, 'foreground');
      const bg = validateHex(payload.background, 'background');
      const result = evaluateContrast(fg, bg);
      return { action, result };
    }

    case 'blindness': {
      const color = validateHex(payload.seed_color, 'seed_color');
      const type = payload.blindness_type ?? 'deuteranopia';
      const simulated = simulateColorBlindness(color, type);
      const original = hexToOklch(color);
      const simulatedOklch = hexToOklch(simulated);
      return {
        action,
        result: {
          original: color,
          simulated,
          blindness_type: type,
          original_oklch: original,
          simulated_oklch: simulatedOklch,
        },
      };
    }

    case 'css_theme': {
      const seed = validateHex(payload.seed_color, 'seed_color');
      const theme = generateTheme(seed);
      const css = themeToCSS(theme);
      return { action, result: { tokens: theme, css } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
