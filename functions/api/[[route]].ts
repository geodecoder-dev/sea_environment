import type { PagesFunction, Env } from '../types.js';
import { handleUniversalApiRequest } from '../../server/api-router.js';

/**
 * Cloudflare Pages Function: Catch-all API Handler
 * Handles all HTTP methods for /api/* on the Cloudflare Edge network.
 * Passes D1, R2, and environment secret bindings to the shared universal handler.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  return handleUniversalApiRequest(context.request, {
    env: context.env,
    waitUntil: context.waitUntil ? context.waitUntil.bind(context) : undefined,
  });
};
