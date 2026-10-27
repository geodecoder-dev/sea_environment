/**
 * Centralized & Validated Server Configuration
 * Works across Cloudflare Pages Functions (env object) and Node.js/Express (process.env).
 */

export interface AppConfig {
  isProduction: boolean;
  port: number;
  canonicalAppUrl: string;
  sessionSecret: string;
  adminEmail?: string;
  adminPasswordHash?: string;
  adminSalt?: string;
  billplz: {
    apiKey?: string;
    xSignatureKey?: string;
    collectionId?: string;
    isSandbox: boolean;
    isConfigured: boolean;
  };
  enableSimulation: boolean;
  email: {
    apiKey?: string;
    from: string;
    isConfigured: boolean;
  };
  corsAllowedOrigins: string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(`[ConfigError] ${message}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(runtimeEnv: Record<string, string | undefined> = {}): AppConfig {
  // Merge process.env with runtimeEnv (Cloudflare env takes priority when passed)
  const env: Record<string, string | undefined> = {
    ...(typeof process !== 'undefined' && process.env ? process.env : {}),
    ...runtimeEnv,
  };

  const isProduction = env.NODE_ENV === 'production';
  const port = parseInt(env.PORT || '3000', 10);

  // Canonical App URL - Essential for tamper-proof Billplz redirects & callbacks
  let canonicalAppUrl = env.CANONICAL_APP_URL || env.APP_URL || '';
  if (!canonicalAppUrl) {
    if (isProduction) {
      console.warn('[CONFIG] CANONICAL_APP_URL not set in production. Defaulting to empty; host header will be rejected for sensitive webhooks.');
    } else {
      canonicalAppUrl = `http://localhost:${port}`;
    }
  } else {
    // Strip trailing slashes
    canonicalAppUrl = canonicalAppUrl.replace(/\/+$/, '');
  }

  // Session Secret Validation
  const sessionSecret = env.SESSION_SECRET || '';
  if (isProduction) {
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new ConfigError('SESSION_SECRET is required and must be at least 32 characters in production.');
    }
  }

  // Billplz Configuration
  const billplzApiKey = env.BILLPLZ_API_KEY?.trim();
  const billplzXSignature = env.BILLPLZ_X_SIGNATURE_KEY?.trim();
  const billplzCollection = env.BILLPLZ_COLLECTION_ID?.trim();
  const isSandbox = env.BILLPLZ_SANDBOX !== 'false'; // Default to true (sandbox) for safety

  const isBillplzConfigured = Boolean(billplzApiKey && billplzXSignature && billplzCollection);

  // Payment simulation - NEVER allowed in production
  let enableSimulation = env.ENABLE_PAYMENT_SIMULATION === 'true';
  if (isProduction && enableSimulation) {
    console.error('[SECURITY ALERT] ENABLE_PAYMENT_SIMULATION cannot be enabled in production! Forcing disabled.');
    enableSimulation = false;
  }

  // Email Configuration
  const emailApiKey = env.RESEND_API_KEY?.trim();
  const emailFrom = env.EMAIL_FROM?.trim() || 'Solaris Reef Campaign <receipts@solaris-reef.org>';

  // CORS origins
  const rawOrigins = env.ALLOWED_ORIGINS || '';
  const corsAllowedOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [canonicalAppUrl].filter(Boolean);

  return {
    isProduction,
    port,
    canonicalAppUrl,
    sessionSecret: sessionSecret || 'dev-fallback-insecure-session-secret-min-32-chars-long!',
    adminEmail: env.ADMIN_EMAIL?.trim(),
    adminPasswordHash: env.ADMIN_PASSWORD_HASH?.trim(),
    adminSalt: env.ADMIN_SALT?.trim(),
    billplz: {
      apiKey: billplzApiKey,
      xSignatureKey: billplzXSignature,
      collectionId: billplzCollection,
      isSandbox,
      isConfigured: isBillplzConfigured,
    },
    enableSimulation,
    email: {
      apiKey: emailApiKey,
      from: emailFrom,
      isConfigured: Boolean(emailApiKey),
    },
    corsAllowedOrigins,
  };
}
