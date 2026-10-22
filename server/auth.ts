/**
 * Worker-Compatible Authentication & Cryptography
 * Uses the Web Crypto API (crypto.subtle) supported natively in Cloudflare Workers,
 * V8 isolates, and Node.js 18+. Completely independent of Express.
 */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function generateRandomSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

/**
 * Derives a PBKDF2 hash using Web Crypto.
 * Defaults to SHA-256 (100,000 iterations), compatible with Cloudflare Workers.
 */
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const actualSaltHex = saltHex || generateRandomSalt();
  const saltBytes = hexToBytes(actualSaltHex);
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes = 256 bits
  );

  return {
    hash: bytesToHex(new Uint8Array(derived)),
    salt: actualSaltHex,
  };
}

/**
 * Verifies a password against a stored hash.
 * Supports both modern SHA-256 (64 hex characters) and legacy/seed SHA-512 (128 hex characters).
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  saltHex: string
): Promise<boolean> {
  if (!password || !storedHash || !saltHex) return false;

  try {
    const saltBytes = hexToBytes(saltHex);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // If stored hash is 128 characters (64 bytes), it was generated with SHA-512 / 10,000 iterations
    if (storedHash.length === 128) {
      const derived512 = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes as any,
          iterations: 10000,
          hash: 'SHA-512',
        },
        keyMaterial,
        512
      );
      const computed = bytesToHex(new Uint8Array(derived512));
      return timingSafeEqual(computed, storedHash);
    }

    // Default: SHA-256 / 100,000 iterations
    const derived256 = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const computed = bytesToHex(new Uint8Array(derived256));
    return timingSafeEqual(computed, storedHash);
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

/**
 * Constant-time string equality check to prevent timing analysis attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export class AuthenticationConfigError extends Error {
  constructor(message: string = 'SESSION_SECRET is missing or shorter than 32 characters') {
    super(message);
    this.name = 'AuthenticationConfigError';
  }
}

/**
 * Creates an HMAC-SHA256 signed session token using Web Crypto.
 * Requires SESSION_SECRET of at least 32 characters.
 */
export async function createToken(userId: string, secret?: string): Promise<string> {
  if (!secret || secret.length < 32) {
    console.error('[AUTH ERROR] SESSION_SECRET is missing or shorter than 32 characters.');
    throw new AuthenticationConfigError();
  }
  const sessionSecret = secret;
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const signatureHex = bytesToHex(new Uint8Array(signatureBuffer));
  const tokenRaw = `${payload}:${signatureHex}`;

  // Base64 encode for cookie and header transport
  return btoa(tokenRaw);
}

/**
 * Verifies an HMAC-SHA256 signed session token using Web Crypto.
 * Requires SESSION_SECRET of at least 32 characters.
 * Session validity is set to 7 days.
 */
export async function verifyToken(token: string, secret?: string): Promise<string | null> {
  if (!token) return null;
  if (!secret || secret.length < 32) {
    console.error('[AUTH ERROR] SESSION_SECRET is missing or shorter than 32 characters.');
    throw new AuthenticationConfigError();
  }
  const sessionSecret = secret;

  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;

    const [userId, timestampStr, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return null;

    // 7-day expiration check
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > SEVEN_DAYS_MS) {
      return null;
    }

    const payload = `${userId}:${timestampStr}`;
    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(sessionSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = hexToBytes(providedSignature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as any,
      enc.encode(payload)
    );

    return isValid ? userId : null;
  } catch (err) {
    if (err instanceof AuthenticationConfigError) {
      throw err;
    }
    return null;
  }
}

/**
 * Parses cookies from standard Cookie header string.
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, value] = pair.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  }
  return cookies;
}

/**
 * Extracts session token from standard Web Request (Cookie or Authorization: Bearer).
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  if (cookies.admin_token) {
    return cookies.admin_token;
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}
