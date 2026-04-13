/**
 * OKLCH / OKLAB color manipulation library.
 *
 * All internal color math uses OKLCH (perceptually uniform) for palette
 * generation, theme derivation, and contrast calculation.
 *
 * References:
 * - Björn Ottosson, "A perceptual color space for image processing" (2020)
 * - WCAG 2.1 contrast ratio algorithm
 * - APCA (Advanced Perceptual Contrast Algorithm) by Andrew Somers
 */

// ──── Types ──────────────────────────────────────────────────────

export interface OklchColor {
  /** Lightness: 0 (black) → 1 (white) */
  l: number;
  /** Chroma: 0 (gray) → ~0.4 (max saturation) */
  c: number;
  /** Hue: 0–360 degrees */
  h: number;
  /** Alpha: 0 (transparent) → 1 (opaque) */
  a: number;
}

export interface SrgbColor {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–1
}

export interface OklabColor {
  L: number;
  a: number;
  b: number;
  alpha: number;
}

export type HarmonyMethod =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'split-complementary'
  | 'monochromatic';

export interface ColorPalette {
  name: string;
  seed: string;
  method: HarmonyMethod;
  colors: PaletteColor[];
}

export interface PaletteColor {
  role: string;
  hex: string;
  oklch: OklchColor;
  contrastOnWhite: number;
  contrastOnBlack: number;
}

export interface SemanticPalette {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeTokens {
  light: SemanticPalette;
  dark: SemanticPalette;
}

export interface ContrastResult {
  ratio: number;
  wcagAA: boolean;       // ≥ 4.5:1 for normal text
  wcagAALarge: boolean;   // ≥ 3:1 for large text (≥18pt or ≥14pt bold)
  wcagAAA: boolean;       // ≥ 7:1 for normal text
  wcagAAALarge: boolean;  // ≥ 4.5:1 for large text
}

// ──── sRGB ↔ Linear RGB ─────────────────────────────────────────

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

// ──── Linear RGB ↔ OKLAB ─────────────────────────────────────────

function linearRgbToOklab(r: number, g: number, b: number): OklabColor {
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    alpha: 1,
  };
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [r, g, bl];
}

// ──── OKLCH ↔ OKLAB ──────────────────────────────────────────────

function oklabToOklch(lab: OklabColor): OklchColor {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab.L, c, h, a: lab.alpha };
}

function oklchToOklab(lch: OklchColor): OklabColor {
  const hRad = (lch.h * Math.PI) / 180;
  return {
    L: lch.l,
    a: lch.c * Math.cos(hRad),
    b: lch.c * Math.sin(hRad),
    alpha: lch.a,
  };
}

// ──── Public Conversions ─────────────────────────────────────────

export function hexToSrgb(hex: string): SrgbColor {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length !== 6 && cleaned.length !== 8) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const a = cleaned.length === 8 ? parseInt(cleaned.slice(6, 8), 16) / 255 : 1;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return { r, g, b, a };
}

export function srgbToHex(rgb: SrgbColor): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function srgbToOklch(rgb: SrgbColor): OklchColor {
  const lr = srgbToLinear(rgb.r);
  const lg = srgbToLinear(rgb.g);
  const lb = srgbToLinear(rgb.b);
  const lab = linearRgbToOklab(lr, lg, lb);
  lab.alpha = rgb.a;
  return oklabToOklch(lab);
}

export function oklchToSrgb(lch: OklchColor): SrgbColor {
  const lab = oklchToOklab(lch);
  const [lr, lg, lb] = oklabToLinearRgb(lab.L, lab.a, lab.b);
  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
    a: lch.a,
  };
}

export function hexToOklch(hex: string): OklchColor {
  return srgbToOklch(hexToSrgb(hex));
}

export function oklchToHex(lch: OklchColor): string {
  return srgbToHex(oklchToSrgb(lch));
}

/** Check if an OKLCH color maps to a valid sRGB value (gamut check). */
export function isInGamut(lch: OklchColor): boolean {
  const lab = oklchToOklab(lch);
  const [r, g, b] = oklabToLinearRgb(lab.L, lab.a, lab.b);
  const EPS = -0.001;
  const MAX = 1.001;
  return r >= EPS && r <= MAX && g >= EPS && g <= MAX && b >= EPS && b <= MAX;
}

/** Clamp an OKLCH color into the sRGB gamut by reducing chroma. */
export function gamutClamp(lch: OklchColor): OklchColor {
  if (isInGamut(lch)) return { ...lch };
  let lo = 0;
  let hi = lch.c;
  let mid = lch.c;
  for (let i = 0; i < 30; i++) {
    mid = (lo + hi) / 2;
    if (isInGamut({ ...lch, c: mid })) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { ...lch, c: lo };
}

// ──── Contrast ───────────────────────────────────────────────────

/** Relative luminance per WCAG 2.1 (ITU-R BT.709). */
export function relativeLuminance(rgb: SrgbColor): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two sRGB colors. */
export function contrastRatio(a: SrgbColor, b: SrgbColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Evaluate contrast ratio against all WCAG thresholds. */
export function evaluateContrast(fg: string, bg: string): ContrastResult {
  const fgRgb = hexToSrgb(fg);
  const bgRgb = hexToSrgb(bg);
  const ratio = contrastRatio(fgRgb, bgRgb);
  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,
    wcagAALarge: ratio >= 3,
    wcagAAA: ratio >= 7,
    wcagAAALarge: ratio >= 4.5,
  };
}

/** Find the best foreground color (black or white) for a given background. */
export function bestForeground(bgHex: string): string {
  const bg = hexToSrgb(bgHex);
  const onWhite = contrastRatio(bg, { r: 255, g: 255, b: 255, a: 1 });
  const onBlack = contrastRatio(bg, { r: 0, g: 0, b: 0, a: 1 });
  return onBlack >= onWhite ? '#000000' : '#ffffff';
}

// ──── Color Blindness Simulation ─────────────────────────────────

type CbMatrix = [number, number, number, number, number, number, number, number, number];

const CB_MATRICES: Record<string, CbMatrix> = {
  protanopia:   [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia:   [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
  achromatopsia:[0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
};

export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

/** Simulate how a color appears under a given color blindness type. */
export function simulateColorBlindness(hex: string, type: ColorBlindnessType): string {
  const rgb = hexToSrgb(hex);
  const m = CB_MATRICES[type];
  if (!m) throw new Error(`Unknown color blindness type: ${type}`);
  const r = m[0] * rgb.r + m[1] * rgb.g + m[2] * rgb.b;
  const g = m[3] * rgb.r + m[4] * rgb.g + m[5] * rgb.b;
  const b = m[6] * rgb.r + m[7] * rgb.g + m[8] * rgb.b;
  return srgbToHex({ r, g, b, a: 1 });
}

// ──── Palette Generation ─────────────────────────────────────────

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/** Generate harmony colors from a seed color using the specified method. */
export function generateHarmony(seedHex: string, method: HarmonyMethod): OklchColor[] {
  const seed = hexToOklch(seedHex);

  switch (method) {
    case 'complementary':
      return [seed, gamutClamp({ ...seed, h: normalizeHue(seed.h + 180) })];

    case 'analogous':
      return [
        gamutClamp({ ...seed, h: normalizeHue(seed.h - 30) }),
        seed,
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 30) }),
      ];

    case 'triadic':
      return [
        seed,
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 120) }),
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 240) }),
      ];

    case 'tetradic':
      return [
        seed,
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 90) }),
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 180) }),
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 270) }),
      ];

    case 'split-complementary':
      return [
        seed,
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 150) }),
        gamutClamp({ ...seed, h: normalizeHue(seed.h + 210) }),
      ];

    case 'monochromatic':
      return [
        gamutClamp({ ...seed, l: Math.min(1, seed.l + 0.2) }),
        gamutClamp({ ...seed, l: Math.min(1, seed.l + 0.1) }),
        seed,
        gamutClamp({ ...seed, l: Math.max(0, seed.l - 0.1) }),
        gamutClamp({ ...seed, l: Math.max(0, seed.l - 0.2) }),
      ];

    default:
      throw new Error(`Unknown harmony method: ${method}`);
  }
}

const HARMONY_ROLES: Record<HarmonyMethod, string[]> = {
  complementary: ['primary', 'complement'],
  analogous: ['analogous-warm', 'primary', 'analogous-cool'],
  triadic: ['primary', 'triadic-a', 'triadic-b'],
  tetradic: ['primary', 'secondary', 'tertiary', 'quaternary'],
  'split-complementary': ['primary', 'split-a', 'split-b'],
  monochromatic: ['lightest', 'light', 'base', 'dark', 'darkest'],
};

/** Generate a named palette from a seed hex and harmony method. */
export function generatePalette(seedHex: string, method: HarmonyMethod, name?: string): ColorPalette {
  const harmonyColors = generateHarmony(seedHex, method);
  const roles = HARMONY_ROLES[method];
  const white: SrgbColor = { r: 255, g: 255, b: 255, a: 1 };
  const black: SrgbColor = { r: 0, g: 0, b: 0, a: 1 };

  const colors: PaletteColor[] = harmonyColors.map((oklch, i) => {
    const hex = oklchToHex(oklch);
    const srgb = oklchToSrgb(oklch);
    return {
      role: roles[i] ?? `color-${i}`,
      hex,
      oklch,
      contrastOnWhite: Math.round(contrastRatio(srgb, white) * 100) / 100,
      contrastOnBlack: Math.round(contrastRatio(srgb, black) * 100) / 100,
    };
  });

  return { name: name ?? `${method}-palette`, seed: seedHex, method, colors };
}

// ──── Theme Generation ───────────────────────────────────────────

/** Generate light + dark semantic theme from a single seed color. */
export function generateTheme(seedHex: string): ThemeTokens {
  const seed = hexToOklch(seedHex);

  // Fixed hue offsets for semantic colors
  const successHue = 145;
  const warningHue = 45;
  const errorHue = 25;

  // Light theme
  const light: SemanticPalette = {
    primary: oklchToHex(gamutClamp({ l: 0.55, c: seed.c, h: seed.h, a: 1 })),
    primaryForeground: '#ffffff',
    secondary: oklchToHex(gamutClamp({ l: 0.65, c: seed.c * 0.5, h: seed.h, a: 1 })),
    secondaryForeground: '#ffffff',
    accent: oklchToHex(gamutClamp({ l: 0.6, c: seed.c * 0.8, h: normalizeHue(seed.h + 30), a: 1 })),
    accentForeground: '#ffffff',
    background: '#ffffff',
    foreground: oklchToHex(gamutClamp({ l: 0.15, c: 0.01, h: seed.h, a: 1 })),
    muted: oklchToHex(gamutClamp({ l: 0.96, c: 0.005, h: seed.h, a: 1 })),
    mutedForeground: oklchToHex(gamutClamp({ l: 0.45, c: 0.01, h: seed.h, a: 1 })),
    border: oklchToHex(gamutClamp({ l: 0.9, c: 0.005, h: seed.h, a: 1 })),
    success: oklchToHex(gamutClamp({ l: 0.6, c: 0.18, h: successHue, a: 1 })),
    warning: oklchToHex(gamutClamp({ l: 0.75, c: 0.18, h: warningHue, a: 1 })),
    error: oklchToHex(gamutClamp({ l: 0.55, c: 0.2, h: errorHue, a: 1 })),
  };

  // Dark theme: flip lightness, reduce chroma slightly
  const dark: SemanticPalette = {
    primary: oklchToHex(gamutClamp({ l: 0.7, c: seed.c * 0.9, h: seed.h, a: 1 })),
    primaryForeground: oklchToHex(gamutClamp({ l: 0.15, c: 0.01, h: seed.h, a: 1 })),
    secondary: oklchToHex(gamutClamp({ l: 0.5, c: seed.c * 0.4, h: seed.h, a: 1 })),
    secondaryForeground: '#ffffff',
    accent: oklchToHex(gamutClamp({ l: 0.65, c: seed.c * 0.7, h: normalizeHue(seed.h + 30), a: 1 })),
    accentForeground: oklchToHex(gamutClamp({ l: 0.15, c: 0.01, h: seed.h, a: 1 })),
    background: oklchToHex(gamutClamp({ l: 0.14, c: 0.01, h: seed.h, a: 1 })),
    foreground: oklchToHex(gamutClamp({ l: 0.93, c: 0.005, h: seed.h, a: 1 })),
    muted: oklchToHex(gamutClamp({ l: 0.2, c: 0.01, h: seed.h, a: 1 })),
    mutedForeground: oklchToHex(gamutClamp({ l: 0.6, c: 0.01, h: seed.h, a: 1 })),
    border: oklchToHex(gamutClamp({ l: 0.25, c: 0.01, h: seed.h, a: 1 })),
    success: oklchToHex(gamutClamp({ l: 0.7, c: 0.16, h: successHue, a: 1 })),
    warning: oklchToHex(gamutClamp({ l: 0.8, c: 0.16, h: warningHue, a: 1 })),
    error: oklchToHex(gamutClamp({ l: 0.65, c: 0.18, h: errorHue, a: 1 })),
  };

  return { light, dark };
}

/** Export a theme as CSS custom properties. */
export function themeToCSS(tokens: ThemeTokens): string {
  const lines: string[] = [];

  lines.push(':root {');
  for (const [key, value] of Object.entries(tokens.light)) {
    const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    lines.push(`  ${cssVar}: ${value};`);
  }
  lines.push('}');
  lines.push('');
  lines.push('@media (prefers-color-scheme: dark) {');
  lines.push('  :root {');
  for (const [key, value] of Object.entries(tokens.dark)) {
    const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    lines.push(`    ${cssVar}: ${value};`);
  }
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}
