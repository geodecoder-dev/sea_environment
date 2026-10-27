import { describe, it, expect } from 'vitest';
import {
  buildReceiptPayload,
  generateReceiptEmailHtml,
  escapeHtml,
} from '../server/services/receipts.js';
import { sanitizeCsvField } from '../server/middleware/security.js';
import { Donation } from '../server/types.js';

describe('Receipts, Security Escaping & Sanitization', () => {
  const baseDonation: Donation = {
    id: 'don-test-1',
    internalReference: 'SOL-202610-A1B2',
    verificationToken: '0123456789abcdef0123456789abcdef',
    campaignId: 'solaris-reef-2026',
    donorName: 'Marina Protector <script>alert("xss")</script>',
    donorEmail: 'marina@ocean.org',
    amountSen: 10000,
    currency: 'MYR',
    attributionPreference: 'public',
    message: 'Best wishes & good luck! <div>Malicious</div>',
    referral: 'REF-LION-"&<>\'',
    coralName: 'Reef Star <img src=x onerror=alert(1)>',
    isGift: true,
    recipientName: 'Recipient <b>Bold</b>',
    recipientEmail: 'recip@ocean.org',
    billplzBillId: 'bpz_receipt_001',
    paymentStatus: 'paid',
    paidAt: '2026-10-27T12:00:00.000Z',
    createdAt: '2026-10-27T11:50:00.000Z',
    updatedAt: '2026-10-27T12:00:00.000Z',
  };

  describe('Authoritative Paid Status Verification', () => {
    it('builds receipt payload successfully when donation status is paid', () => {
      const payload = buildReceiptPayload(baseDonation);
      expect(payload.internalReference).toBe('SOL-202610-A1B2');
      expect(payload.amountRm).toBe(100);
      expect(payload.coralCount).toBe(1);
      expect(payload.includesUpdates).toBe(true);
    });

    it('strictly forbids receipt generation for pending donation', () => {
      const pendingDonation: Donation = { ...baseDonation, paymentStatus: 'pending' };
      expect(() => buildReceiptPayload(pendingDonation)).toThrow(/RECEIPT_FORBIDDEN_UNPAID/);
    });

    it('strictly forbids receipt generation for failed or cancelled donation', () => {
      const failedDonation: Donation = { ...baseDonation, paymentStatus: 'failed' };
      const cancelledDonation: Donation = { ...baseDonation, paymentStatus: 'cancelled' };

      expect(() => buildReceiptPayload(failedDonation)).toThrow(/RECEIPT_FORBIDDEN_UNPAID/);
      expect(() => buildReceiptPayload(cancelledDonation)).toThrow(/RECEIPT_FORBIDDEN_UNPAID/);
    });
  });

  describe('HTML Escaping in Receipt Templates', () => {
    it('escapes dangerous HTML special characters in strings', () => {
      const dangerous = '<script>alert("hack")</script> & \'test\'';
      const safe = escapeHtml(dangerous);

      expect(safe).not.toContain('<script>');
      expect(safe).toContain('&lt;script&gt;');
      expect(safe).toContain('&amp;');
      expect(safe).toContain('&quot;');
      expect(safe).toContain('&#39;');
    });

    it('neutralizes XSS vectors in generated receipt HTML', () => {
      const payload = buildReceiptPayload(baseDonation);
      const html = generateReceiptEmailHtml(payload);

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).not.toContain('<b>Bold</b>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('SOL-202610-A1B2');
    });
  });

  describe('CSV Formula Injection Defense', () => {
    it('neutralizes Excel/Sheets formula prefixes (=, +, -, @)', () => {
      expect(sanitizeCsvField('=cmd|/c calc')).toBe('"\'=cmd|/c calc"');
      expect(sanitizeCsvField('+12345')).toBe('"\' +12345"'.replace(' ', ''));
      expect(sanitizeCsvField('-12345')).toBe('"\' -12345"'.replace(' ', ''));
      expect(sanitizeCsvField('@SUM(A1:A10)')).toBe('"\'@SUM(A1:A10)"');
    });

    it('escapes inner quotes in standard text cells', () => {
      expect(sanitizeCsvField('Hello "World"')).toBe('"Hello ""World"""');
    });
  });
});
