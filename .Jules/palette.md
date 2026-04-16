## 2025-05-14 - Visual feedback for copy actions
**Learning:** Users often click copy buttons but are unsure if the action succeeded without explicit visual confirmation. Switching the icon to a checkmark for a short duration (2s) provides clear, delighting feedback.
**Action:** Always implement a transient "success" state for copy buttons using a state-driven icon swap and ARIA label update.

## 2025-05-14 - Accessibility for icon-only action bars
**Learning:** Chat interface action bars often use dense icon-only buttons that are completely opaque to screen readers if `aria-label` is missing.
**Action:** Audit all icon-only button groups and ensure each has a descriptive `aria-label` that matches its `title` or provides additional context.
