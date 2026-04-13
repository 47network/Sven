import {
  generateSpacingScale,
  spacingScaleToCSS,
  generateGrid,
  generateAutoFitGrid,
  generateBreakpoints,
  getZIndexLayers,
  zIndexToCSS,
  getLayoutPattern,
  getLayoutPatterns,
  type SpacingScaleMethod,
  type BreakpointStrategy,
} from '@sven/design-system/layout';

type InputPayload = {
  action: 'spacing' | 'grid' | 'auto_grid' | 'breakpoints' | 'z_index' | 'pattern' | 'all_patterns';
  base_px?: number;
  scale_method?: SpacingScaleMethod;
  columns?: number;
  gap_px?: number;
  max_width_px?: number;
  min_item_width_px?: number;
  strategy?: BreakpointStrategy;
  pattern_name?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'spacing': {
      const basePx = payload.base_px ?? 4;
      const method = payload.scale_method ?? 'linear';
      const scale = generateSpacingScale(basePx, method);
      const css = spacingScaleToCSS(scale);
      return { action, result: { scale, css } };
    }

    case 'grid': {
      const columns = Math.max(1, Math.min(24, payload.columns ?? 12));
      const gapPx = payload.gap_px ?? 16;
      const maxWidthPx = payload.max_width_px ?? 1280;
      const grid = generateGrid(columns, gapPx, maxWidthPx);
      return { action, result: grid };
    }

    case 'auto_grid': {
      const minItemWidthPx = payload.min_item_width_px ?? 280;
      const gapPx = payload.gap_px ?? 16;
      const css = generateAutoFitGrid(minItemWidthPx, gapPx);
      return { action, result: { minItemWidthPx, gapPx, css } };
    }

    case 'breakpoints': {
      const strategy = payload.strategy ?? 'mobile-first';
      const breakpointSet = generateBreakpoints(strategy);
      return { action, result: breakpointSet };
    }

    case 'z_index': {
      const layers = getZIndexLayers();
      const css = zIndexToCSS();
      return { action, result: { layers, css } };
    }

    case 'pattern': {
      const name = payload.pattern_name;
      if (!name) {
        const available = getLayoutPatterns().map((p) => p.name);
        return { action, result: { error: 'pattern_name is required', available } };
      }
      const pattern = getLayoutPattern(name);
      if (!pattern) {
        const available = getLayoutPatterns().map((p) => p.name);
        return { action, result: { error: `Unknown pattern: ${name}`, available } };
      }
      return { action, result: pattern };
    }

    case 'all_patterns': {
      const patterns = getLayoutPatterns();
      return { action, result: { patterns } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
