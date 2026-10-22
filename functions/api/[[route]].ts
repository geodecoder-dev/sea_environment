import type { PagesFunction } from '../types.js';
import { handleUniversalApiRequest } from '../../server/api-router.js';

/**
 * Cloudflare Pages Function: Catch-all API Handler
 * Handles all HTTP methods for /api/* on the Cloudflare Edge network.
 */
export const onRequest: PagesFunction = async (context) => {
  return handleUniversalApiRequest(context.request, {
    env: context.env,
    waitUntil: context.waitUntil.bind(context),
  });
};
