## 2025-05-14 - Use timingSafeEqual for Cryptographic Comparisons
**Vulnerability:** Timing attacks on HMAC signatures and PIN hashes.
**Learning:** Comparing cryptographic hashes or signatures using standard equality operators (`===` or `==`) can leak information about the correct value through timing differences, allowing attackers to brute-force values more efficiently.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing sensitive values like tokens, signatures, and PIN hashes. Ensure both buffers have equal length before comparison to avoid TypeErrors.
