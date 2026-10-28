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

  it('strictly requires both callback_url and redirect_url in createBill', async () => {
    const simEnv = {
      ENABLE_PAYMENT_SIMULATION: 'true',
    };

    // Missing callbackUrl
    await expect(
      service.createBill(
        {
          email: 'test@example.com',
          name: 'Test Donor',
          amountSen: 5000,
          callbackUrl: '',
          redirectUrl: 'https://example.com/redirect',
          description: 'Test Bill',
        },
        simEnv
      )
    ).rejects.toThrow(/callback_url is required/);

    // Missing redirectUrl
    await expect(
      service.createBill(
        {
          email: 'test@example.com',
          name: 'Test Donor',
          amountSen: 5000,
          callbackUrl: 'https://example.com/callback',
          redirectUrl: '',
          description: 'Test Bill',
        },
        simEnv
      )
    ).rejects.toThrow(/redirect_url is required/);

    // Both provided -> succeeds and includes both in result
    const result = await service.createBill(
      {
        email: 'test@example.com',
        name: 'Test Donor',
        amountSen: 5000,
        callbackUrl: 'https://solarisreef.org/api/webhooks/billplz',
        redirectUrl: 'https://solarisreef.org/donation/result?ref=SOL-202610-88A1',
        description: 'Test Bill',
        reference1: 'SOL-202610-88A1',
      },
      simEnv
    );

    expect(result.callbackUrl).toBe('https://solarisreef.org/api/webhooks/billplz');
    expect(result.redirectUrl).toBe('https://solarisreef.org/donation/result?ref=SOL-202610-88A1');
    expect(result.reference1).toBe('SOL-202610-88A1');
  });

  it('generates and verifies Billplz redirect X-Signature with billplz[...] bracketed query parameters', async () => {
    const redirectParams = {
      'billplz[id]': 'W_79pJDk',
      'billplz[paid]': 'true',
      'billplz[paid_at]': '2026-10-31 10:00:00 +0800',
    };

    // Calculate signature using official spec (key+value sorted alphabetically and pipe-joined)
    const sig = await service.generateXSignature(redirectParams, mockEnv);
    expect(sig).toBeTypeOf('string');
    expect(sig.length).toBe(64);

    // Verify redirect using flat query parameter object
    const result = await service.verifyRedirect(
      {
        ...redirectParams,
        'billplz[x_signature]': sig,
      },
      undefined,
      mockEnv
    );

    expect(result.isValid).toBe(true);
    expect(result.billId).toBe('W_79pJDk');
    expect(result.isPaid).toBe(true);
    expect(result.paidAt).toBe('2026-10-31 10:00:00 +0800');
  });

  it('verifies redirect X-Signature when query params are parsed into a nested billplz object', async () => {
    const rawRedirectParams = {
      'billplz[id]': 'W_88xLMo',
      'billplz[paid]': 'true',
      'billplz[paid_at]': '2026-10-31 12:00:00 +0800',
    };
    const sig = await service.generateXSignature(rawRedirectParams, mockEnv);

    // Some HTTP routers parse billplz[id] into { billplz: { id: '...' } }
    const nestedParams = {
      billplz: {
        id: 'W_88xLMo',
        paid: 'true',
        paid_at: '2026-10-31 12:00:00 +0800',
        x_signature: sig,
      },
    };

    const result = await service.verifyRedirect(nestedParams, undefined, mockEnv);
    expect(result.isValid).toBe(true);
    expect(result.billId).toBe('W_88xLMo');
    expect(result.isPaid).toBe(true);
  });

  it('rejects tampered redirect payload (e.g. attacker changing billplz[paid] from false to true)', async () => {
    const legitimateParams = {
      'billplz[id]': 'W_unpaid_123',
      'billplz[paid]': 'false',
      'billplz[paid_at]': '',
    };
    const legitimateSig = await service.generateXSignature(legitimateParams, mockEnv);

    // Attacker modifies billplz[paid] to 'true' in URL query string
    const tamperedQuery = {
      'billplz[id]': 'W_unpaid_123',
      'billplz[paid]': 'true',
      'billplz[paid_at]': '',
      'billplz[x_signature]': legitimateSig,
    };

    const result = await service.verifyRedirect(tamperedQuery, undefined, mockEnv);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Invalid redirect X-Signature');
  });
});
