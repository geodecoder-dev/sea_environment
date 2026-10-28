/**
 * Payment Provider Abstraction Interface
 * Decouples core donation logic from provider-specific gateways (Billplz, Simulator, etc.)
 */

export interface CreateBillOptions {
  email: string;
  name: string;
  amountSen: number;
  callbackUrl: string;
  redirectUrl: string;
  description: string;
  reference1Label?: string;
  reference1?: string;
  reference2Label?: string;
  reference2?: string;
  collectionId?: string;
}

export interface BillResult {
  id: string;
  collectionId: string;
  paid: boolean;
  state: 'due' | 'paid' | 'deleted';
  amount: number;
  paidAmount: number;
  dueAt: string;
  email: string;
  name: string;
  url: string;
  reference1?: string;
  reference2?: string;
  callbackUrl?: string;
  redirectUrl?: string;
  isSimulated?: boolean;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  billId: string;
  isPaid: boolean;
  state: 'paid' | 'due' | 'deleted';
  paidAt?: string;
  amountSen?: number;
  internalRef?: string;
  rawPayload: Record<string, any>;
  reason?: string;
}

export interface RedirectVerificationResult {
  isValid: boolean;
  billId: string;
  isPaid: boolean;
  paidAt?: string;
  internalRef?: string;
  rawPayload: Record<string, any>;
  reason?: string;
}

export interface PaymentProvider {
  createBill(options: CreateBillOptions, env?: Record<string, any>): Promise<BillResult>;
  verifyWebhook(params: Record<string, any>, signature: string, env?: Record<string, any>): Promise<WebhookVerificationResult>;
  verifyRedirect?(params: Record<string, any>, signature?: string, env?: Record<string, any>): Promise<RedirectVerificationResult>;
}

