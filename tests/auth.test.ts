import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  timingSafeEqual,
  AuthenticationConfigError,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from '../server/auth.js';
import { loadConfig, ConfigError } from '../server/config/index.js';

describe('Authentication & Cryptography Security', () => {
  const TEST_SECRET = 'a-super-secret-key-that-is-at-least-32-chars-long!';

  describe('Password Hashing & Timing-Safe Verification', () => {
    it('generates unique salt and PBKDF2 hash using Web Crypto', async () => {
      const result1 = await hashPassword('SecretCoralPassword2026!');
      const result2 = await hashPassword('SecretCoralPassword2026!');

      expect(result1.hash).toBeDefined();
      expect(result1.salt).toBeDefined();
      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('verifies correct password and rejects incorrect password', async () => {
      const { hash, salt } = await hashPassword('CorrectPassword123');
      const isMatch = await verifyPassword('CorrectPassword123', hash, salt);
      const isBadMatch = await verifyPassword('WrongPassword456', hash, salt);

      expect(isMatch).toBe(true);
      expect(isBadMatch).toBe(false);
    });

    it('timingSafeEqual correctly compares strings of equal and unequal lengths', () => {
      expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
      expect(timingSafeEqual('abcdef', 'abc')).toBe(false);
    });
  });

  describe('Session Token Lifecycle & Secret Enforcement', () => {
    it('creates and verifies HMAC-SHA256 session token', async () => {
      const token = await createToken('admin-user-001', TEST_SECRET);
      expect(token).toBeTypeOf('string');

      const verifiedUserId = await verifyToken(token, TEST_SECRET);
      expect(verifiedUserId).toBe('admin-user-001');
    });

    it('rejects token when secret is missing or under 32 characters', async () => {
      await expect(createToken('user-1', '')).rejects.toThrow(AuthenticationConfigError);
      await expect(createToken('user-1', 'short-secret')).rejects.toThrow(AuthenticationConfigError);
      await expect(verifyToken('dummy-token', 'short-secret')).rejects.toThrow(AuthenticationConfigError);
    });

    it('rejects tampered tokens', async () => {
      const token = await createToken('admin-user-001', TEST_SECRET);
      const decoded = atob(token);
      const tampered = btoa(decoded.replace('admin-user-001', 'attacker-user'));

      const verified = await verifyToken(tampered, TEST_SECRET);
      expect(verified).toBeNull();
    });
  });

  describe('Configuration Security Baseline', () => {
    it('fails securely when production lacks SESSION_SECRET', () => {
      expect(() => {
        loadConfig({
          NODE_ENV: 'production',
          SESSION_SECRET: '',
        });
      }).toThrow(ConfigError);
    });

    it('disables payment simulation in production by construction', () => {
      const config = loadConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: TEST_SECRET,
        ENABLE_PAYMENT_SIMULATION: 'true',
      });
      expect(config.enableSimulation).toBe(false);
    });
  });

  describe('Login Rate Limiting', () => {
    const testIp = '198.51.100.42';

    it('locks out after 5 consecutive failed attempts', () => {
      resetLoginAttempts(testIp);

      for (let i = 0; i < 4; i++) {
        recordFailedLogin(testIp);
        const check = checkLoginRateLimit(testIp, 5);
        expect(check.allowed).toBe(true);
      }

      recordFailedLogin(testIp);
      const lockedCheck = checkLoginRateLimit(testIp, 5);
      expect(lockedCheck.allowed).toBe(false);
      expect(lockedCheck.retryAfterSec).toBeGreaterThan(0);

      resetLoginAttempts(testIp);
      const afterReset = checkLoginRateLimit(testIp, 5);
      expect(afterReset.allowed).toBe(true);
    });
  });
});
