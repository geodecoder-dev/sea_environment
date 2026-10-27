/**
 * Security Middleware & Defensive Utilities
 * - CORS origin verification
 * - Security headers
 * - CSV formula injection protection
 * - Endpoint rate limiting (in-memory sliding window)
 * - Safe error response formatter
 */

export function sanitizeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  let str = String(field);

  // CSV Formula Injection mitigation:
  // If field starts with =, +, -, @, \t, \r, prepend a single quote (')
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes and enclose in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

interface RequestRateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RequestRateLimitRecord>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { timestamps: [] };

  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  record.timestamps.push(now);
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
  };
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
  };
}

export function formatErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, any>
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    }
  );
}
