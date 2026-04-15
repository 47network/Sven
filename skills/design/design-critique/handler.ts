import {
  evaluateContrast,
  simulateColorBlindness,
  hexToOklch,
  type ContrastResult,
  type ColorBlindnessType,
} from '@sven/design-system/color';
import { analyzeReadability, type ReadabilityAnalysis } from '@sven/design-system/typography';

// ──── Types ──────────────────────────────────────────────────────

interface ColorEntry {
  name?: string;
  hex: string;
  role: 'background' | 'foreground' | 'primary' | 'secondary' | 'accent' | 'border' | 'success' | 'warning' | 'error';
}

interface TypographyInput {
  body_size_px?: number;
  heading_size_px?: number;
  line_height?: number;
  line_width_chars?: number;
  letter_spacing_em?: number;
}

type InputPayload = {
  action: 'audit_colors' | 'audit_typography' | 'audit_full' | 'suggest_improvements';
  colors?: ColorEntry[];
  typography?: TypographyInput;
};

interface Finding {
  severity: 'critical' | 'warning' | 'info' | 'pass';
  category: string;
  message: string;
  fix?: string;
}

// ──── Audit Logic ────────────────────────────────────────────────

function auditColors(colors: ColorEntry[]): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 100;

  const bg = colors.find((c) => c.role === 'background');
  const fg = colors.find((c) => c.role === 'foreground');

  // Contrast audit: foreground on background
  if (bg && fg) {
    const contrast = evaluateContrast(fg.hex, bg.hex);
    if (!contrast.wcagAA) {
      score -= 30;
      findings.push({
        severity: 'critical',
        category: 'contrast',
        message: `Foreground (${fg.hex}) on background (${bg.hex}) fails WCAG AA — ratio ${contrast.ratio}:1 (requires 4.5:1)`,
        fix: `Increase contrast: darken foreground or lighten background to achieve at least 4.5:1 ratio`,
      });
    } else if (!contrast.wcagAAA) {
      findings.push({
        severity: 'info',
        category: 'contrast',
        message: `Foreground on background passes AA (${contrast.ratio}:1) but not AAA (requires 7:1)`,
      });
    } else {
      findings.push({ severity: 'pass', category: 'contrast', message: `Foreground on background passes WCAG AAA (${contrast.ratio}:1)` });
    }
  }

  // Check all interactive colors against background for contrast
  const interactiveRoles = ['primary', 'secondary', 'accent'] as const;
  for (const role of interactiveRoles) {
    const color = colors.find((c) => c.role === role);
    if (color && bg) {
      const contrast = evaluateContrast(color.hex, bg.hex);
      if (!contrast.wcagAALarge) {
        score -= 15;
        findings.push({
          severity: 'warning',
          category: 'contrast',
          message: `${role} (${color.hex}) on background (${bg.hex}) fails WCAG AA for large text — ratio ${contrast.ratio}:1`,
          fix: `Adjust ${role} color to achieve at least 3:1 contrast against background`,
        });
      }
    }
  }

  // Color blindness safety
  const CB_TYPES: ColorBlindnessType[] = ['protanopia', 'deuteranopia', 'tritanopia'];
  const uniqueColors = colors.filter((c) => ['primary', 'success', 'warning', 'error'].includes(c.role));
  if (uniqueColors.length >= 2) {
    for (const cbType of CB_TYPES) {
      const simulated = uniqueColors.map((c) => ({
        role: c.role,
        original: c.hex,
        simulated: simulateColorBlindness(c.hex, cbType),
      }));

      // Check if any two semantic colors become too similar under simulation
      for (let i = 0; i < simulated.length; i++) {
        for (let j = i + 1; j < simulated.length; j++) {
          const a = hexToOklch(simulated[i].simulated);
          const b = hexToOklch(simulated[j].simulated);
          const deltaL = Math.abs(a.l - b.l);
          const deltaC = Math.abs(a.c - b.c);
          const deltaH = Math.abs(a.h - b.h);

          if (deltaL < 0.05 && deltaC < 0.03 && deltaH < 15) {
            score -= 10;
            findings.push({
              severity: 'warning',
              category: 'color-blindness',
              message: `${simulated[i].role} and ${simulated[j].role} become indistinguishable under ${cbType}`,
              fix: `Add non-color indicators (icons, patterns, text labels) to distinguish ${simulated[i].role} from ${simulated[j].role}`,
            });
          }
        }
      }
    }
  }

  return { score: Math.max(0, score), findings };
}

function auditTypography(typo: TypographyInput): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 100;

  // Body text readability
  const bodyAnalysis = analyzeReadability({
    fontSizePx: typo.body_size_px ?? 16,
    lineHeight: typo.line_height ?? 1.5,
    lineWidthChars: typo.line_width_chars ?? 65,
    letterSpacingEm: typo.letter_spacing_em ?? 0,
  });

  score = bodyAnalysis.score;

  for (const issue of bodyAnalysis.issues) {
    findings.push({ severity: 'warning', category: 'readability', message: issue });
  }
  for (const suggestion of bodyAnalysis.suggestions) {
    findings.push({ severity: 'info', category: 'readability', message: suggestion });
  }

  if (bodyAnalysis.issues.length === 0) {
    findings.push({ severity: 'pass', category: 'readability', message: 'Body text meets all readability guidelines' });
  }

  // Heading size check
  if (typo.heading_size_px) {
    const bodySize = typo.body_size_px ?? 16;
    const ratio = typo.heading_size_px / bodySize;
    if (ratio < 1.2) {
      score -= 10;
      findings.push({
        severity: 'warning',
        category: 'hierarchy',
        message: `Heading-to-body ratio is ${ratio.toFixed(2)}x — too close for clear hierarchy (minimum 1.2x)`,
        fix: 'Increase heading size to at least 1.25x body size for visual hierarchy',
      });
    } else if (ratio > 4) {
      findings.push({
        severity: 'info',
        category: 'hierarchy',
        message: `Heading-to-body ratio is ${ratio.toFixed(2)}x — very large; verify it works at mobile sizes`,
      });
    }
  }

  return { score: Math.max(0, score), findings };
}

function generateSuggestions(findings: Finding[]): string[] {
  return findings
    .filter((f) => f.fix)
    .map((f) => `[${f.severity.toUpperCase()}] ${f.category}: ${f.fix}`);
}

// ──── Handler ────────────────────────────────────────────────────

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'audit_colors': {
      if (!payload.colors || payload.colors.length === 0) {
        throw new Error('colors array is required for color audit');
      }
      const result = auditColors(payload.colors);
      return { action, result };
    }

    case 'audit_typography': {
      if (!payload.typography) {
        throw new Error('typography object is required for typography audit');
      }
      const result = auditTypography(payload.typography);
      return { action, result };
    }

    case 'audit_full': {
      const colorResult = payload.colors && payload.colors.length > 0
        ? auditColors(payload.colors)
        : { score: 100, findings: [{ severity: 'info' as const, category: 'colors', message: 'No colors provided — skipped color audit' }] };

      const typoResult = payload.typography
        ? auditTypography(payload.typography)
        : { score: 100, findings: [{ severity: 'info' as const, category: 'typography', message: 'No typography data provided — skipped typography audit' }] };

      const overallScore = Math.round((colorResult.score + typoResult.score) / 2);
      const allFindings = [...colorResult.findings, ...typoResult.findings];
      const grade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F';

      return {
        action,
        result: {
          overall_score: overallScore,
          grade,
          color_score: colorResult.score,
          typography_score: typoResult.score,
          findings: allFindings,
          critical_count: allFindings.filter((f) => f.severity === 'critical').length,
          warning_count: allFindings.filter((f) => f.severity === 'warning').length,
          pass_count: allFindings.filter((f) => f.severity === 'pass').length,
        },
      };
    }

    case 'suggest_improvements': {
      const findings: Finding[] = [];
      if (payload.colors && payload.colors.length > 0) {
        findings.push(...auditColors(payload.colors).findings);
      }
      if (payload.typography) {
        findings.push(...auditTypography(payload.typography).findings);
      }
      const suggestions = generateSuggestions(findings);
      return { action, result: { suggestions, finding_count: findings.length } };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
