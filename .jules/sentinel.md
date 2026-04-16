## 2026-05-20 - HTML Sanitization: Block-list to Allow-list Migration
**Vulnerability:** The A2UI rendering logic in the Canvas UI used a manual block-list approach for HTML sanitization, which was susceptible to bypasses via less common tags (e.g., `<svg>`, `<math>`) and attributes (e.g., `formaction`).
**Learning:** Manual block-lists are fragile and difficult to maintain as new HTML features are added to browsers. An allow-list approach is the standard security best practice for XSS prevention when a full library like DOMPurify is not available or desired.
**Prevention:** Always default to a "deny-all" stance for user-provided HTML rendering. Use an explicit whitelist of safe tags and attributes, and enforce strict protocol checks for URI-based attributes.
