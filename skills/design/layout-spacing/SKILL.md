---
name: layout-spacing
description: Generate spacing scales, CSS grid systems, responsive breakpoints, z-index layers, and ready-to-use layout patterns (dashboard, sidebar, card grid, holy grail, etc).
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["spacing","grid","auto_grid","breakpoints","z_index","pattern","all_patterns"],"default":"spacing"},"base_px":{"type":"number","default":4},"scale_method":{"type":"string","enum":["linear","geometric","modular"],"default":"linear"},"columns":{"type":"integer","minimum":1,"maximum":24,"default":12},"gap_px":{"type":"number","default":16},"max_width_px":{"type":"number","default":1280},"min_item_width_px":{"type":"number","default":280},"strategy":{"type":"string","enum":["mobile-first","desktop-first"],"default":"mobile-first"},"pattern_name":{"type":"string","description":"Layout pattern: holy-grail, sidebar-content, card-grid, dashboard, split-screen, centered-content"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Layout & Spacing Skill

Generate spacing systems, CSS grid layouts, responsive breakpoints, z-index layers, and production-ready layout patterns.

## Actions

- `spacing` — Generate a spacing scale from base unit and method
- `grid` — Generate a CSS Grid system with responsive breakpoints
- `auto_grid` — Generate an auto-fit responsive card grid
- `breakpoints` — Generate responsive breakpoint media queries
- `z_index` — Get the z-index layer system
- `pattern` — Get a specific layout pattern
- `all_patterns` — List all available layout patterns

## Examples

- "Generate a 4px spacing scale" → `{ action: "spacing", base_px: 4 }`
- "Create a 12-column grid" → `{ action: "grid", columns: 12 }`
- "Give me a dashboard layout" → `{ action: "pattern", pattern_name: "dashboard" }`

## Scope Mapping
- `design.layout`: **read** (generates CSS code, no side effects)
