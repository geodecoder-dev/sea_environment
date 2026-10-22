import type { PagesFunction } from './types.js';

/**
 * Cloudflare Pages Global Middleware
 * Attaches modern security headers and processes CORS across edge functions.
 */
export const onRequest: PagesFunction = async (context) => {
  // CORS Preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);

  // Security Headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
