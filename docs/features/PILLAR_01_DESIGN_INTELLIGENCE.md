# Pillar 1 — Design Intelligence

> Source: Video 1 (Design Skills for AI)
> User directive: "I want Sven's abilities at coding to reproduce all those, so that we don't depend on other repositories and so that he improves himself"

---

## Goal

Sven becomes his own design system expert — capable of generating, critiquing, and refining visual designs with professional-grade understanding of motion, typography, color theory, contrast, layout, and spacing. No external design tool dependency.

---

## Feature Breakdown

### 1.1 Motion & Animation Intelligence

**What**: Sven understands and generates CSS/JS animations with proper easing, timing, and physics.

**Capabilities**:
- [ ] Easing function library (cubic-bezier presets: ease, spring, bounce, elastic, smooth)
- [ ] Duration intelligence (knows optimal durations by element type: micro 100-200ms, macro 300-500ms, page 500-800ms)
- [ ] Animation composition (entrance, exit, state change, attention, loading sequences)
- [ ] Spring physics simulation (mass, stiffness, damping → natural motion)
- [ ] Stagger/orchestration patterns (sequential reveals, cascade effects, parallax)
- [ ] Performance awareness (will-change, transform-only, GPU-accelerated properties)
- [ ] `prefers-reduced-motion` compliance (always generates accessible fallbacks)
- [ ] Lottie/Rive animation analysis and generation
- [ ] Scroll-triggered animation patterns (intersection observer, scroll progress)
- [ ] Gesture-driven animation for mobile (swipe, pinch, drag with momentum)

**Implementation**:
- New package: `packages/design-system/src/motion/`
- Skill: `skills/design/motion-design.ts`
- Tool handler in skill-runner for generating animations from natural language descriptions

### 1.2 Typography System

**What**: Sven selects, pairs, and applies typefaces with professional typographic knowledge.

**Capabilities**:
- [ ] Font pairing intelligence (serif+sans, display+body, mood-based matching)
- [ ] Type scale generation (modular scales: minor third, major third, perfect fourth, golden ratio)
- [ ] Responsive typography (fluid type using clamp(), viewport-relative sizing)
- [ ] Reading comfort analysis (line-height, line-length 45-75 chars, letter-spacing)
- [ ] Vertical rhythm enforcement (baseline grid alignment)
- [ ] Variable font axis utilization (weight, width, optical size, slant)
- [ ] Font performance optimization (subsetting, font-display strategy, FOUT/FOIT handling)
- [ ] Accessibility: minimum body size 16px, contrast ratios per WCAG 2.1 AA
- [ ] Multi-script support awareness (Latin, Cyrillic, Arabic, CJK considerations)
- [ ] Fallback stack generation (system font stacks, metric-compatible fallbacks)

**Implementation**:
- New package: `packages/design-system/src/typography/`
- Skill: `skills/design/typography.ts`
- Reference database of 200+ curated font pairings

### 1.3 Color System

**What**: Sven generates, manipulates, and applies color palettes with perceptual accuracy.

**Capabilities**:
- [ ] Color space intelligence (sRGB, P3, OKLCH, OKLAB for perceptual uniformity)
- [ ] Palette generation algorithms (analogous, complementary, split-complementary, triadic, tetradic)
- [ ] Semantic color mapping (primary, secondary, accent, success, warning, error, neutral)
- [ ] Dark/light theme generation from a single seed color
- [ ] Contrast ratio calculation (WCAG AA 4.5:1 text, 3:1 large text/UI)
- [ ] APCA contrast (advanced perceptual contrast algorithm for next-gen compliance)
- [ ] Color blindness simulation (protanopia, deuteranopia, tritanopia, achromatopsia)
- [ ] Harmonics and temperature analysis (warm/cool balance)
- [ ] Brand color extraction from image/logo
- [ ] CSS custom property generation with light/dark token maps
- [ ] Gradient generation (linear, radial, conic with perceptually uniform stops)

**Implementation**:
- New package: `packages/design-system/src/color/`
- Skill: `skills/design/color-system.ts`
- OKLCH-first approach for all color manipulation

### 1.4 Layout & Spacing System

**What**: Sven designs layouts with proper spatial relationships, grid systems, and responsive behavior.

**Capabilities**:
- [ ] Spacing scale generation (4px base, geometric or modular progression)
- [ ] Grid system intelligence (12-column, auto-fit, subgrid, masonry)
- [ ] Responsive breakpoint strategy (mobile-first, container queries, fluid design)
- [ ] Whitespace analysis (negative space, visual breathing room, density scoring)
- [ ] Component spacing rules (padding vs margin, gap patterns, consistent insets)
- [ ] Layout pattern library (hero, card grid, sidebar+content, dashboard, feed, split-screen)
- [ ] Flexbox vs Grid decision intelligence (when to use which)
- [ ] Container query utilization (component-level responsive design)
- [ ] z-index management (layered system: base, dropdown, modal, toast, tooltip)
- [ ] Scroll behavior design (sticky headers, snap points, virtual scrolling decision)

**Implementation**:
- New package: `packages/design-system/src/layout/`
- Skill: `skills/design/layout-spacing.ts`

### 1.5 Design Reference & Critique

**What**: Sven can analyze existing designs, pull references, and provide professional critique.

**Capabilities**:
- [ ] Screenshot analysis (using vision models to assess design quality)
- [ ] Design principle scoring (alignment, repetition, contrast, proximity — CRAP score)
- [ ] Competitive design analysis (given a URL, analyze the design system used)
- [ ] Design token extraction from existing CSS/Figma files
- [ ] Before/after comparison with specific improvement suggestions
- [ ] Design system audit (consistency check across components)
- [ ] Accessibility audit (automated a11y scoring with actionable fixes)
- [ ] Performance impact analysis of design choices (paint, layout, composite)
- [ ] Mood/brand alignment scoring (does the design match the stated brand values?)
- [ ] Design changelog (track design drift over time)

**Implementation**:
- Skill: `skills/design/design-critique.ts`
- Integration with vision model (Gemma4 or GLM-OCR for visual analysis)
- HTML/CSS parser for automated design token extraction

### 1.6 Design Command Interface

**What**: Natural language commands that Sven understands for design work.

**Commands** (registered as skills):
- [ ] `design:palette <mood/brand>` — Generate a complete color palette
- [ ] `design:typography <context>` — Select and configure a type system
- [ ] `design:animate <element> <intent>` — Generate animation code
- [ ] `design:layout <pattern>` — Scaffold a layout with proper spacing
- [ ] `design:audit <url|screenshot>` — Full design quality audit
- [ ] `design:theme <light|dark|both>` — Generate theme token system
- [ ] `design:component <name>` — Design a component with all tokens applied
- [ ] `design:responsive <breakpoints>` — Generate responsive strategy
- [ ] `design:a11y-check` — Run accessibility audit on current canvas
- [ ] `design:improve <screenshot>` — Suggest concrete visual improvements

---

## Technical Dependencies

| Dependency | Purpose | Status |
|-----------|---------|--------|
| Vision model (Gemma4/GLM-OCR) | Design screenshot analysis | Available |
| OKLCH color math library | Perceptual color manipulation | To build (no external dep) |
| CSS parser | Design token extraction | Use existing PostCSS |
| Font metrics library | Typography calculations | To build |
| Intersection Observer | Scroll animation helpers | Browser-native |

---

## Integration Points

- **Skill Runner**: New design skill handlers registered
- **Agent Runtime**: Design commands routed to skill-runner
- **Canvas UI**: Design preview and live editing
- **Admin UI**: Design system dashboard for 47 admin
- **Self-Healing**: Design skills improve over time via feedback loops

---

## Checklist

### Foundation
- [ ] Create `packages/design-system/` package with tsconfig, package.json
- [ ] Create `skills/design/` directory with skill definitions
- [ ] Register design skills in skill-runner tool handlers
- [ ] Wire design commands through agent-runtime routing

### Motion (1.1)
- [ ] Implement easing function library with 20+ presets
- [ ] Implement duration recommendation engine
- [ ] Implement animation composition system
- [ ] Implement spring physics simulator
- [ ] Implement stagger/orchestration patterns
- [ ] Add `prefers-reduced-motion` fallback generation
- [ ] Unit tests for all easing functions and timing calculations
- [ ] Integration test: natural language → animation CSS output

### Typography (1.2)
- [ ] Implement font pairing database (200+ pairs)
- [ ] Implement modular type scale generator
- [ ] Implement fluid typography calculator (clamp generation)
- [ ] Implement reading comfort analyzer
- [ ] Implement vertical rhythm calculator
- [ ] Unit tests for scale generation and comfort metrics
- [ ] Integration test: "make this readable" → typography CSS output

### Color (1.3)
- [ ] Implement OKLCH color manipulation library
- [ ] Implement palette generation algorithms (6 methods)
- [ ] Implement contrast ratio calculator (WCAG + APCA)
- [ ] Implement color blindness simulator
- [ ] Implement dark/light theme generator from seed color
- [ ] CSS custom property output generator
- [ ] Unit tests for all color math functions
- [ ] Integration test: "professional blue theme" → complete token set

### Layout (1.4)
- [ ] Implement spacing scale generator
- [ ] Implement grid system generator (CSS Grid + Flexbox)
- [ ] Implement responsive breakpoint strategy generator
- [ ] Implement z-index management system
- [ ] Unit tests for spacing calculations
- [ ] Integration test: "dashboard layout" → complete CSS layout

### Critique (1.5)
- [ ] Implement design principle scoring (CRAP analysis)
- [ ] Implement design token extractor from CSS
- [ ] Implement a11y audit (color contrast + focus + semantics)
- [ ] Wire vision model for screenshot analysis
- [ ] Integration test: provide screenshot → receive scored critique

### Commands (1.6)
- [ ] Register all 10 design commands as skills
- [ ] Wire through agent-runtime command router
- [ ] End-to-end test: each command produces valid output

---

## Success Criteria

1. Sven can generate a complete design system from a natural language brief
2. All design output passes WCAG 2.1 AA automatically
3. Animation code respects `prefers-reduced-motion` without prompting
4. Color palettes are perceptually uniform (OKLCH-based)
5. Typography selections include proper fallback stacks and fluid sizing
6. Design critique provides actionable, scored feedback
7. Zero external design tool dependencies — all logic is Sven's own code
