---
name: typography
description: Generate modular type scales, recommend font pairings by mood, create fluid responsive typography, and analyze text readability metrics.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["scale","pairing","readability","vertical_rhythm","css_scale"],"default":"scale"},"base_size_px":{"type":"number","default":16},"ratio":{"type":"string","enum":["minor-second","major-second","minor-third","major-third","perfect-fourth","augmented-fourth","perfect-fifth","golden-ratio"],"default":"major-third"},"mood":{"type":"string","description":"Font pairing mood: clean, elegant, technical, modern, editorial, geometric, startup, bold"},"font_size_px":{"type":"number"},"line_height":{"type":"number"},"line_width_chars":{"type":"number"},"letter_spacing_em":{"type":"number"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Typography Skill

Generate professional type systems with modular scales, font pairings, fluid responsive sizing, and readability analysis.

## Actions

- `scale` — Generate a modular type scale from base size and ratio
- `pairing` — Recommend a font pairing from mood
- `readability` — Analyze text readability against typographic best practices
- `vertical_rhythm` — Generate a vertical rhythm baseline system
- `css_scale` — Generate a full CSS custom property type scale

## Examples

- "Create a type system for a dashboard" → `{ action: "scale", ratio: "major-third" }`
- "What fonts work for a modern SaaS?" → `{ action: "pairing", mood: "modern" }`
- "Is this text comfortable to read?" → `{ action: "readability", font_size_px: 14, line_height: 1.3, line_width_chars: 90 }`

## Scope Mapping
- `design.typography`: **read** (generates data, no side effects)
