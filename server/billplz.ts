import crypto from 'crypto';

export interface BillplzBillOptions {
  collectionId: string;
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

export class BillplzService {
  private apiKey: string;
  private collectionId: string;
  private xSignatureKey: string;
  private isSandbox: boolean;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.BILLPLZ_API_KEY || '';
    this.collectionId = process.env.BILLPLZ_COLLECTION_ID || '';
    this.xSignatureKey = process.env.BILLPLZ_X_SIGNATURE_KEY || 'solaris_billplz_x_sig_sandbox_key';
    this.isSandbox = process.env.BILLPLZ_SANDBOX !== 'false';
    this.baseUrl = this.isSandbox
      ? 'https://www.billplz-sandbox.com/api/v3'
      : 'https://www.billplz.com/api/v3';
  }

  public isConfiguredWithRealKeys(): boolean {
    return Boolean(
      this.apiKey &&
      this.apiKey !== 'your_billplz_api_key_here' &&
      this.collectionId &&
      this.collectionId !== 'your_billplz_collection_id_here'
    );
  }

  public getStatus() {
    return {
      isSandbox: this.isSandbox,
      isConfigured: this.isConfiguredWithRealKeys(),
      collectionIdMasked: this.collectionId
        ? `${this.collectionId.slice(0, 4)}...${this.collectionId.slice(-3)}`
        : 'Not Set',
      hasApiKey: Boolean(this.apiKey && this.apiKey !== 'your_billplz_api_key_here'),
      hasXSignatureKey: Boolean(this.xSignatureKey && this.xSignatureKey !== 'your_billplz_x_signature_key_here'),
      baseUrl: this.baseUrl,
      mode: this.isConfiguredWithRealKeys()
        ? (this.isSandbox ? 'Live Billplz Sandbox' : 'Live Billplz Production')
        : 'Interactive Sandbox Simulation Mode'
    };
  }

  public async createBill(options: BillplzBillOptions): Promise<BillplzBillResult> {
    const isReal = this.isConfiguredWithRealKeys();

    if (isReal) {
      try {
        const auth = Buffer.from(`${this.apiKey}:`).toString('base64');
        const payload = {
          collection_id: options.collectionId || this.collectionId,
          email: options.email,
          name: options.name,
          amount: options.amountSen,
          callback_url: options.callbackUrl,
          redirect_url: options.redirectUrl,
          description: options.description,
          reference_1_label: options.reference1Label || 'Campaign',
          reference_1: options.reference1 || 'Solaris Reef',
        };

        const response = await fetch(`${this.baseUrl}/bills`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Billplz API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
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
        console.warn('Real Billplz API call failed, falling back to simulated sandbox bill:', err.message);
        // Fall back to clean simulated sandbox adapter
      }
    }

    // Billplz Sandbox Adapter
    const simulatedBillId = `bpz_${crypto.randomBytes(6).toString('hex')}`;
    const simulatedUrl = `/billplz-simulation/${simulatedBillId}`;

    return {
      id: simulatedBillId,
      collectionId: options.collectionId || 'sandbox_col_solaris',
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
   * Generates a Billplz X-Signature according to official Billplz specifications:
   * 1. Sort all payload parameters alphabetically by parameter name (excluding x_signature)
   * 2. Join the values using the pipe '|' character
   * 3. Compute HMAC-SHA256 hash using the X-Signature key
   */
  public generateXSignature(params: Record<string, any>): string {
    const keys = Object.keys(params)
      .filter((k) => k !== 'x_signature')
      .sort();

    const dataString = keys.map((k) => String(params[k] ?? '')).join('|');
    const hmac = crypto.createHmac('sha256', this.xSignatureKey);
    hmac.update(dataString);
    return hmac.digest('hex');
  }

  /**
   * Verifies the Billplz X-Signature with timing-safe comparison
   */
  public verifyXSignature(params: Record<string, any>, signature: string): boolean {
    if (!signature) return false;
    try {
      const expected = this.generateXSignature(params);
      const signatureBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expected);
      if (signatureBuf.length !== expectedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(signatureBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  public getXSignatureKey(): string {
    return this.xSignatureKey;
  }
}

export const billplz = new BillplzService();
