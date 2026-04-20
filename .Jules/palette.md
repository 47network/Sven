## 2026-04-19 - AppShell Sidebar Accessibility

**Learning:** When using icon-only buttons in responsive or collapsible UI components (like `AppShell`'s collapsed sidebar and footer items), standard text `<span>` elements are typically hidden. To maintain accessibility for screen readers, you MUST ensure that these components have `aria-label`s, which act as the accessible name when the visible text is hidden. Using `title` attributes also helps sighted users understand what the icons represent on hover.

**Action:** Whenever building or modifying components that condense their content into icon-only representations (like collapsed sidebars or mobile menus), explicitly add `aria-label`s and `title`s to the interactive elements to guarantee they remain accessible and usable without the visible text labels.
