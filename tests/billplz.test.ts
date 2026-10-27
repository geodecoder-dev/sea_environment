import { describe, it, expect } from 'vitest';
import { BillplzService } from '../server/payments/billplz.js';

describe('Billplz Payment Provider & X-Signature Verification', () => {
  const service = new BillplzService();
  const mockEnv = {
    BILLPLZ_API_KEY: 'test-api-key',
    BILLPLZ_COLLECTION_ID: 'col_test_123',
    BILLPLZ_X_SIGNATURE_KEY: 'my-ultra-secure-billplz-x-signature-key-2026',
    BILLPLZ_SANDBOX: 'true',
  };

  it('generates consistent X-Signature according to alphabetical parameter sorting and pipe-joining', async () => {
    const payload = {
      id: 'w_72a8cb',
      collection_id: 'col_test_123',
      paid: 'true',
      state: 'paid',
      amount: '10000',
      paid_amount: '10000',
      due_at: '2026-10-31',
      email: 'donor@example.com',
    };

    const sig = await service.generateXSignature(payload, mockEnv);
    expect(sig).toBeTypeOf('string');
    expect(sig.length).toBe(64); // SHA-256 hex string

    // Verification succeeds
    const isValid = await service.verifyXSignature(payload, sig, mockEnv);
    expect(isValid).toBe(true);
  });

  it('rejects tampered amounts or parameters', async () => {
    const originalPayload = {
      id: 'w_72a8cb',
      amount: '50000',
      paid: 'true',
    };

    const validSig = await service.generateXSignature(originalPayload, mockEnv);

    // Attacker modifies amount to RM 50 (5000 sen) instead of RM 500 (50000 sen)
    const tamperedPayload = {
      ...originalPayload,
      amount: '5000',
    };

    const isValid = await service.verifyXSignature(tamperedPayload, validSig, mockEnv);
    expect(isValid).toBe(false);
  });

  it('handles verifyWebhook end-to-end', async () => {
    const payload = {
      id: 'bpz_test_998',
      paid: 'true',
      state: 'paid',
      amount: '10000',
      reference_1: 'SOL-202610-88A1',
    };

    const sig = await service.generateXSignature(payload, mockEnv);
    const result = await service.verifyWebhook({ ...payload, x_signature: sig }, sig, mockEnv);

    expect(result.isValid).toBe(true);
    expect(result.billId).toBe('bpz_test_998');
    expect(result.isPaid).toBe(true);
    expect(result.state).toBe('paid');
    expect(result.internalRef).toBe('SOL-202610-88A1');
  });

  it('rejects unconfigured provider without credentials when simulation is disabled', async () => {
    const emptyEnv = {
      ENABLE_PAYMENT_SIMULATION: 'false',
      BILLPLZ_API_KEY: '',
    };

    await expect(
      service.createBill(
        {
          email: 'test@example.com',
          name: 'Test Donor',
          amountSen: 5000,
          callbackUrl: 'https://example.com/callback',
          redirectUrl: 'https://example.com/redirect',
          description: 'Test Bill',
        },
        emptyEnv
      )
    ).rejects.toThrow();
  });
});
