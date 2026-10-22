import type { PagesFunction, Env } from './types.js';

/**
 * Cloudflare Pages Global Middleware
 * Tightens CORS, applies security headers, preserves cookies, and handles edge errors.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const origin = context.request.headers.get('Origin') || '*';
  const isOptions = context.request.method === 'OPTIONS';

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin === '*' ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-Requested-With, Cookie',
    'Access-Control-Max-Age': '86400',
  };

  if (origin !== '*') {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    corsHeaders['Vary'] = 'Origin';
  }

  // Handle CORS Preflight immediately at edge
  if (isOptions) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const response = await context.next();
    const headers = new Headers(response.headers);

    // Apply CORS headers to response if not already present
    for (const [key, val] of Object.entries(corsHeaders)) {
      if (!headers.has(key)) {
        headers.set(key, val);
      }
    }

    // Security Headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err: any) {
    console.error('Edge Middleware Unhandled Exception:', err);
    return new Response(
      JSON.stringify({
        error: 'Edge runtime processing exception',
        message: err?.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
};
