## 2026-04-19 - Robust Redirect Validation
**Vulnerability:** Open Redirect bypass in `toSafeLocalRedirectPath` using backslashes (`/\url`), URL-encoded backslashes (`/%5c`), or control characters.
**Learning:** Simple checks for `//` are insufficient for local redirect validation as many browsers treat `/` followed by `\ ` as an absolute redirect. Robust validation must handle URL decoding and explicitly block backslashes and control characters.
**Prevention:** Always use a unified, robust redirect validation function that handles URL decoding and rejects known bypass patterns (backslashes, protocol-relative URLs, and control characters).
