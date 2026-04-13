import {
  generateTypeScale,
  typeScaleToCSS,
  getFontPairing,
  getAvailableMoods,
  fontSpecToCSS,
  analyzeReadability,
  generateVerticalRhythm,
  type TypeScaleRatio,
} from '@sven/design-system/typography';

type InputPayload = {
  action: 'scale' | 'pairing' | 'readability' | 'vertical_rhythm' | 'css_scale';
  base_size_px?: number;
  ratio?: TypeScaleRatio;
  mood?: string;
  font_size_px?: number;
  line_height?: number;
  line_width_chars?: number;
  letter_spacing_em?: number;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'scale': {
      const baseSizePx = payload.base_size_px ?? 16;
      const ratio = payload.ratio ?? 'major-third';
      const scale = generateTypeScale(baseSizePx, ratio);
      return { action, result: scale };
    }

    case 'pairing': {
      const mood = payload.mood;
      if (!mood) {
        const available = getAvailableMoods();
        return { action, result: { error: 'mood is required', available_moods: available } };
      }
      const pairing = getFontPairing(mood);
      if (!pairing) {
        const available = getAvailableMoods();
        return { action, result: { error: `Unknown mood: ${mood}`, available_moods: available } };
      }
      return {
        action,
        result: {
          ...pairing,
          css: {
            heading: fontSpecToCSS(pairing.heading),
            body: fontSpecToCSS(pairing.body),
            mono: fontSpecToCSS(pairing.mono),
          },
        },
      };
    }

    case 'readability': {
      const analysis = analyzeReadability({
        fontSizePx: payload.font_size_px ?? 16,
        lineHeight: payload.line_height ?? 1.5,
        lineWidthChars: payload.line_width_chars ?? 65,
        letterSpacingEm: payload.letter_spacing_em ?? 0,
      });
      return { action, result: analysis };
    }

    case 'vertical_rhythm': {
      const baseSizePx = payload.base_size_px ?? 16;
      const lineHeight = payload.line_height ?? 1.5;
      const css = generateVerticalRhythm(baseSizePx, lineHeight);
      return { action, result: { baseSizePx, lineHeight, css } };
    }

    case 'css_scale': {
      const baseSizePx = payload.base_size_px ?? 16;
      const ratio = payload.ratio ?? 'major-third';
      const scale = generateTypeScale(baseSizePx, ratio);
      const css = typeScaleToCSS(scale);
      return { action, result: { scale, css } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
