/**
 * Cloudflare Pages Function Type Definitions
 */

export interface Env {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  KV?: KVNamespace;
  BILLPLZ_API_KEY?: string;
  BILLPLZ_COLLECTION_ID?: string;
  BILLPLZ_X_SIGNATURE_KEY?: string;
  BILLPLZ_SANDBOX?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  [key: string]: any;
}

export interface EventContext<EnvType = Env, P extends string = string, Data = Record<string, unknown>> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: EnvType;
  params: Record<P, string | string[]>;
  data: Data;
}

export type PagesFunction<
  EnvType = Env,
  P extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>
> = (context: EventContext<EnvType, P, Data>) => Response | Promise<Response>;
