/**
 * Billplz Payment Provider Implementation
 * Standard Web Fetch and Web Crypto APIs (compatible with Cloudflare Workers & Node.js 18+)
 */

import { CreateBillOptions, BillResult, PaymentProvider, WebhookVerificationResult } from './provider.js';

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

export class BillplzService implements PaymentProvider {
  /**
   * Resolves configuration dynamically from Cloudflare Worker env or process.env
   */
  public resolveConfig(env?: Record<string, any>): Required<BillplzConfig> {
    const apiKey = env?.BILLPLZ_API_KEY || (typeof process !== 'undefined' ? process.env?.BILLPLZ_API_KEY : '') || '';
    const collectionId = env?.BILLPLZ_COLLECTION_ID || (typeof process !== 'undefined' ? process.env?.BILLPLZ_COLLECTION_ID : '') || '';
    const xSignatureKey = env?.BILLPLZ_X_SIGNATURE_KEY || (typeof process !== 'undefined' ? process.env?.BILLPLZ_X_SIGNATURE_KEY : '') || '';
    const sandboxEnv = env?.BILLPLZ_SANDBOX ?? (typeof process !== 'undefined' ? process.env?.BILLPLZ_SANDBOX : 'true');
    const isSandbox = String(sandboxEnv).toLowerCase() === 'true';

    return {
      apiKey: apiKey.trim(),
      collectionId: collectionId.trim(),
      xSignatureKey: xSignatureKey.trim(),
      isSandbox,
    };
  }

  public isSimulationEnabled(env?: Record<string, any>): boolean {
    const isProduction = (env?.NODE_ENV || (typeof process !== 'undefined' ? process.env?.NODE_ENV : '')) === 'production';
    if (isProduction) return false;
    const val = env?.ENABLE_PAYMENT_SIMULATION ?? (typeof process !== 'undefined' ? process.env?.ENABLE_PAYMENT_SIMULATION : undefined);
    return String(val) === 'true';
  }

  public isConfiguredWithRealKeys(env?: Record<string, any>): boolean {
    const config = this.resolveConfig(env);
    return Boolean(
      config.apiKey &&
      config.apiKey !== 'your_billplz_api_key_here' &&
      config.apiKey !== 'YOUR_BILLPLZ_API_KEY' &&
      config.collectionId &&
      config.collectionId !== 'your_billplz_collection_id_here' &&
      config.collectionId !== 'YOUR_BILLPLZ_COLLECTION_ID'
    );
  }

  public getStatus(env?: Record<string, any>) {
    const config = this.resolveConfig(env);
    const configured = this.isConfiguredWithRealKeys(env);
    const simulationEnabled = this.isSimulationEnabled(env);
    const baseUrl = config.isSandbox
      ? 'https://www.billplz-sandbox.com/api/v3'
      : 'https://www.billplz.com/api/v3';

    let modeDesc = configured
      ? (config.isSandbox ? 'Live Billplz Sandbox' : 'Live Billplz Production')
      : (simulationEnabled ? 'Interactive Sandbox Simulation Mode' : (config.isSandbox ? 'Sandbox Mode (Offline)' : 'Live Production (Offline)'));

    return {
      isSandbox: config.isSandbox,
      isConfigured: configured,
      isSimulationEnabled: simulationEnabled,
      collectionIdMasked: config.collectionId
        ? `${config.collectionId.slice(0, 4)}...${config.collectionId.slice(-3)}`
        : 'Not Set',
      hasApiKey: Boolean(config.apiKey && config.apiKey !== 'your_billplz_api_key_here'),
      hasXSignatureKey: Boolean(config.xSignatureKey && config.xSignatureKey !== 'your_billplz_x_signature_key_here'),
      baseUrl,
      mode: modeDesc,
    };
  }

  public async createBill(
    options: CreateBillOptions,
    env?: Record<string, any>
  ): Promise<BillResult> {
    const config = this.resolveConfig(env);
    const isReal = this.isConfiguredWithRealKeys(env);
    const simulationAllowed = this.isSimulationEnabled(env);
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
          ...(options.reference2 ? {
            reference_2_label: options.reference2Label || 'Referral',
            reference_2: options.reference2,
          } : {}),
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
          name: data.name,
          url: data.url,
          reference1: data.reference_1,
          reference2: data.reference_2,
          isSimulated: false,
        };
      } catch (err: any) {
        console.error('Live Billplz API call error:', err.message);
        if (!simulationAllowed) {
          throw err;
        }
      }
    }

    if (!isReal && !simulationAllowed) {
      throw new Error('PAYMENTS_UNAVAILABLE: Payment provider is not configured and simulation is disabled.');
    }

    // Interactive Sandbox Simulator Mode (only when ENABLE_PAYMENT_SIMULATION === "true" and non-prod)
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
      reference1: options.reference1 || 'Solaris Reef',
      reference2: options.reference2,
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
    if (!config.xSignatureKey) {
      console.error('[BILLPLZ SECURITY] BILLPLZ_X_SIGNATURE_KEY is missing from environment secrets.');
      throw new Error('BILLPLZ_X_SIGNATURE_KEY_MISSING');
    }

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

  /**
   * Complete webhook verification combining signature validation & payload decoding
   */
  public async verifyWebhook(
    params: Record<string, any>,
    signature: string,
    env?: Record<string, any>
  ): Promise<WebhookVerificationResult> {
    const billId = String(params.id || params.bill_id || '').trim();
    if (!billId) {
      return {
        isValid: false,
        billId: '',
        isPaid: false,
        state: 'due',
        rawPayload: params,
        reason: 'Missing Billplz Bill ID in payload',
      };
    }

    const isValidSig = await this.verifyXSignature(params, signature, env);
    if (!isValidSig) {
      return {
        isValid: false,
        billId,
        isPaid: false,
        state: 'due',
        rawPayload: params,
        reason: 'Invalid X-Signature',
      };
    }

    const isPaid = String(params.paid).toLowerCase() === 'true';
    const state = params.state === 'paid' ? 'paid' : (params.state === 'deleted' ? 'deleted' : 'due');
    const amountSen = params.amount ? parseInt(params.amount, 10) : undefined;
    const paidAt = params.paid_at || (isPaid ? new Date().toISOString() : undefined);
    const internalRef = params.reference_1 || undefined;

    return {
      isValid: true,
      billId,
      isPaid,
      state,
      paidAt,
      amountSen,
      internalRef,
      rawPayload: params,
    };
  }
}

export const billplz = new BillplzService();
