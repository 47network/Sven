---
name: color-system
description: Generate color palettes, evaluate contrast ratios, simulate color blindness, and create full light/dark themes from a single seed color. Uses OKLCH for perceptual uniformity.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["palette","theme","contrast","blindness","css_theme"],"default":"palette"},"seed_color":{"type":"string","description":"Hex color (e.g. #3366ff)"},"method":{"type":"string","enum":["complementary","analogous","triadic","tetradic","split-complementary","monochromatic"],"default":"triadic"},"palette_name":{"type":"string"},"foreground":{"type":"string","description":"Foreground hex for contrast check"},"background":{"type":"string","description":"Background hex for contrast check"},"blindness_type":{"type":"string","enum":["protanopia","deuteranopia","tritanopia","achromatopsia"],"default":"deuteranopia"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Color System Skill

Generate professional color palettes, evaluate WCAG contrast, simulate color blindness, and derive full light/dark themes from a single seed color.

## Actions

- `palette` — Generate a harmony palette from a seed color and method
- `theme` — Generate a complete light + dark semantic theme from a seed color
- `contrast` — Evaluate WCAG 2.1 contrast ratio between foreground and background
- `blindness` — Simulate how a color appears under a given color blindness type
- `css_theme` — Generate a full CSS custom property theme from a seed color

## Examples

- "Generate a professional blue palette" → `{ action: "palette", seed_color: "#3366ff", method: "triadic" }`
- "Check if this text is readable" → `{ action: "contrast", foreground: "#333333", background: "#f5f5f5" }`
- "Create a dark theme from our brand color" → `{ action: "theme", seed_color: "#3366ff" }`

## Scope Mapping
- `design.color`: **read** (generates data, no side effects)
