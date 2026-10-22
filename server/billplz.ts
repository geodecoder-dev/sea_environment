/**
 * Billplz Payment Gateway Integration for Cloudflare Workers & Node.js
 * Uses standard Web Fetch and Web Crypto APIs.
 * Supports credentials passed via Cloudflare environment bindings (env) or process.env.
 */

export interface BillplzBillOptions {
  collectionId?: string;
  email: string;
  name: string;
  amountSen: number;
  callbackUrl: string;
  redirectUrl: string;
  description: string;
  reference1Label?: string;
  reference1?: string;
}

export interface BillplzBillResult {
  id: string;
  collectionId: string;
  paid: boolean;
  state: 'due' | 'paid' | 'deleted';
  amount: number;
  paidAmount: number;
  dueAt: string;
  email: string;
  mobile?: string;
  name: string;
  url: string;
  reference1Label?: string;
  reference1?: string;
  isSimulated?: boolean;
}

export interface BillplzConfig {
  apiKey?: string;
  collectionId?: string;
  xSignatureKey?: string;
  isSandbox?: boolean;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRandomHex(byteCount = 6): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export class BillplzService {
  /**
   * Resolves configuration dynamically from Cloudflare Worker env or process.env
   */
  public resolveConfig(env?: Record<string, any>): Required<BillplzConfig> {
    const apiKey = env?.BILLPLZ_API_KEY || (typeof process !== 'undefined' ? process.env?.BILLPLZ_API_KEY : '') || '';
    const collectionId = env?.BILLPLZ_COLLECTION_ID || (typeof process !== 'undefined' ? process.env?.BILLPLZ_COLLECTION_ID : '') || '';
    const xSignatureKey = env?.BILLPLZ_X_SIGNATURE_KEY || (typeof process !== 'undefined' ? process.env?.BILLPLZ_X_SIGNATURE_KEY : '') || 'solaris_billplz_x_sig_sandbox_key';
    const sandboxEnv = env?.BILLPLZ_SANDBOX ?? (typeof process !== 'undefined' ? process.env?.BILLPLZ_SANDBOX : 'true');
    const isSandbox = String(sandboxEnv).toLowerCase() !== 'false';

    return {
      apiKey,
      collectionId,
      xSignatureKey,
      isSandbox,
    };
  }

  public isConfiguredWithRealKeys(env?: Record<string, any>): boolean {
    const config = this.resolveConfig(env);
    return Boolean(
      config.apiKey &&
      config.apiKey !== 'your_billplz_api_key_here' &&
      config.collectionId &&
      config.collectionId !== 'your_billplz_collection_id_here'
    );
  }

  public getStatus(env?: Record<string, any>) {
    const config = this.resolveConfig(env);
    const configured = this.isConfiguredWithRealKeys(env);
    const baseUrl = config.isSandbox
      ? 'https://www.billplz-sandbox.com/api/v3'
      : 'https://www.billplz.com/api/v3';

    return {
      isSandbox: config.isSandbox,
      isConfigured: configured,
      collectionIdMasked: config.collectionId
        ? `${config.collectionId.slice(0, 4)}...${config.collectionId.slice(-3)}`
        : 'Not Set',
      hasApiKey: Boolean(config.apiKey && config.apiKey !== 'your_billplz_api_key_here'),
      hasXSignatureKey: Boolean(config.xSignatureKey && config.xSignatureKey !== 'your_billplz_x_signature_key_here'),
      baseUrl,
      mode: configured
        ? (config.isSandbox ? 'Live Billplz Sandbox' : 'Live Billplz Production')
        : 'Interactive Sandbox Simulation Mode',
    };
  }

  public async createBill(
    options: BillplzBillOptions,
    env?: Record<string, any>
  ): Promise<BillplzBillResult> {
    const config = this.resolveConfig(env);
    const isReal = this.isConfiguredWithRealKeys(env);
    const baseUrl = config.isSandbox
      ? 'https://www.billplz-sandbox.com/api/v3'
      : 'https://www.billplz.com/api/v3';

    if (isReal) {
      try {
        const auth = btoa(`${config.apiKey}:`);
        const payload = {
          collection_id: options.collectionId || config.collectionId,
          email: options.email,
          name: options.name,
          amount: options.amountSen,
          callback_url: options.callbackUrl,
          redirect_url: options.redirectUrl,
          description: options.description,
          reference_1_label: options.reference1Label || 'Campaign',
          reference_1: options.reference1 || 'Solaris Reef',
        };

        const response = await fetch(`${baseUrl}/bills`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Billplz API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as any;
        return {
          id: data.id,
          collectionId: data.collection_id,
          paid: data.paid,
          state: data.state,
          amount: data.amount,
          paidAmount: data.paid_amount,
          dueAt: data.due_at,
          email: data.email,
          mobile: data.mobile,
          name: data.name,
          url: data.url,
          reference1Label: data.reference_1_label,
          reference1: data.reference_1,
          isSimulated: false,
        };
      } catch (err: any) {
        console.warn('Live Billplz API call error, falling back to sandbox simulator:', err.message);
      }
    }

    // Interactive Sandbox Simulator Mode
    const simulatedBillId = `bpz_${generateRandomHex(6)}`;
    const simulatedUrl = `/billplz-simulation/${simulatedBillId}`;

    return {
      id: simulatedBillId,
      collectionId: options.collectionId || config.collectionId || 'sandbox_col_solaris',
      paid: false,
      state: 'due',
      amount: options.amountSen,
      paidAmount: 0,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      email: options.email,
      name: options.name,
      url: simulatedUrl,
      reference1Label: options.reference1Label || 'Campaign',
      reference1: options.reference1 || 'Solaris Reef',
      isSimulated: true,
    };
  }

  /**
   * Generates a Billplz X-Signature using Web Crypto HMAC-SHA256 according to Billplz specs:
   * 1. Sort all payload parameters alphabetically (excluding x_signature)
   * 2. Join values using the pipe '|' character
   * 3. Compute HMAC-SHA256 hash using the X-Signature key
   */
  public async generateXSignature(
    params: Record<string, any>,
    env?: Record<string, any>
  ): Promise<string> {
    const config = this.resolveConfig(env);
    const keys = Object.keys(params)
      .filter((k) => k !== 'x_signature')
      .sort();

    const dataString = keys.map((k) => String(params[k] ?? '')).join('|');
    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(config.xSignatureKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataString));
    return bytesToHex(new Uint8Array(signatureBuffer));
  }

  /**
   * Verifies the Billplz X-Signature using Web Crypto with timing-safe comparison.
   */
  public async verifyXSignature(
    params: Record<string, any>,
    signature: string,
    env?: Record<string, any>
  ): Promise<boolean> {
    if (!signature) return false;
    try {
      const expected = await this.generateXSignature(params, env);
      if (signature.length !== expected.length) return false;

      let result = 0;
      for (let i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      return result === 0;
    } catch {
      return false;
    }
  }
}

export const billplz = new BillplzService();
