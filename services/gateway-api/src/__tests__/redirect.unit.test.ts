import { describe, expect, it } from '@jest/globals';
import { toSafeLocalRedirectPath, normalizeTokenExchangeRedirectTarget } from '../routes/auth.js';

describe('Redirect protection unit tests', () => {
  describe('toSafeLocalRedirectPath', () => {
    it('allows safe local paths', () => {
      expect(toSafeLocalRedirectPath('/dashboard')).toBe('/dashboard');
      expect(toSafeLocalRedirectPath('/settings/profile')).toBe('/settings/profile');
      expect(toSafeLocalRedirectPath('/正常路径')).toBe('/正常路径');
    });

    it('blocks protocol-relative URLs', () => {
      expect(toSafeLocalRedirectPath('//evil.com')).toBe('/');
    });

    it('blocks backslash bypasses', () => {
      expect(toSafeLocalRedirectPath('/\\evil.com')).toBe('/');
    });

    it('blocks URL-encoded backslash bypasses', () => {
      expect(toSafeLocalRedirectPath('/%5cevil.com')).toBe('/');
      expect(toSafeLocalRedirectPath('/%2f/evil.com')).toBe('/');
    });

    it('blocks paths with ASCII control characters', () => {
      expect(toSafeLocalRedirectPath('/path\r\nnext')).toBe('/');
    });

    it('blocks absolute URLs', () => {
      expect(toSafeLocalRedirectPath('http://evil.com')).toBe('/');
      expect(toSafeLocalRedirectPath('https://evil.com')).toBe('/');
    });
  });

  describe('normalizeTokenExchangeRedirectTarget', () => {
    it('uses the same robust logic', () => {
      expect(normalizeTokenExchangeRedirectTarget('/%5cevil.com')).toBe('/');
      expect(normalizeTokenExchangeRedirectTarget('//evil.com')).toBe('/');
      expect(normalizeTokenExchangeRedirectTarget('/\\evil.com')).toBe('/');
    });
  });
});
