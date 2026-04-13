---
name: motion-design
description: Generate CSS animations with proper easing, timing, spring physics, stagger patterns, and prefers-reduced-motion accessibility fallbacks.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["animate","easing","spring","stagger","duration","css_tokens"],"default":"animate"},"intent":{"type":"string","enum":["enter","exit","fade-in","fade-out","slide-up","slide-down","slide-left","slide-right","scale-up","scale-down","attention","loading"],"default":"slide-up"},"category":{"type":"string","enum":["micro","small","medium","large","page"],"default":"medium"},"easing_name":{"type":"string"},"easing_category":{"type":"string","enum":["standard","entrance","exit","emphasis","spring"]},"spring_preset":{"type":"string","enum":["gentle","default","snappy","wobbly","stiff","slow"],"default":"default"},"stagger_count":{"type":"integer","minimum":2,"maximum":50,"default":5},"stagger_delay_ms":{"type":"integer","minimum":10,"maximum":500,"default":50}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Motion Design Skill

Generate production-ready CSS animations with professional easing, spring physics simulation, stagger patterns, and automatic accessibility fallbacks.

## Actions

- `animate` — Generate a complete animation spec for a given intent and element category
- `easing` — Look up an easing preset or list presets by category
- `spring` — Simulate a spring animation and generate CSS @keyframes
- `stagger` — Generate a stagger animation for a list of elements
- `duration` — Get recommended duration for an element category
- `css_tokens` — Generate all easing + duration CSS custom properties

## Examples

- "Animate a card sliding in" → `{ action: "animate", intent: "slide-up", category: "medium" }`
- "Make a bouncy spring animation" → `{ action: "spring", spring_preset: "wobbly" }`
- "Stagger reveal 8 items" → `{ action: "stagger", stagger_count: 8, intent: "slide-up" }`

## Scope Mapping
- `design.motion`: **read** (generates CSS code, no side effects)
