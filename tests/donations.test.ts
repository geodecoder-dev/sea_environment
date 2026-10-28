import { describe, it, expect, beforeEach } from 'vitest';
import { Database, DatabaseError, D1DatabaseBinding } from '../server/db.js';

describe('Donations & Payment State Machine', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database();
    db.resetMemoryData();
  });

  describe('Donation Creation & Attributes', () => {
    it('creates donation with 128-bit verification token and gift attributes', async () => {
      const donation = await db.createDonation({
        donorName: 'Dr. Jane Reef',
        donorEmail: 'jane@ocean.org',
        amountSen: 50000,
        attributionPreference: 'public',
        message: 'For the staghorn corals!',
        referral: 'REF-REEF-2026',
        coralName: 'Solaris Lumina',
        isGift: true,
        recipientName: 'Alex Ocean',
        recipientEmail: 'alex@ocean.org',
        billplzBillId: 'bpz_test_111',
        billplzUrl: 'https://billplz.com/bills/bpz_test_111',
      });

      expect(donation.internalReference).toMatch(/^SOL-\d{6}-[A-F0-9]{4}$/);
      expect(donation.verificationToken).toBeTypeOf('string');
      expect(donation.verificationToken.length).toBeGreaterThanOrEqual(32); // 128-bit hex
      expect(donation.paymentStatus).toBe('pending');
      expect(donation.coralName).toBe('Solaris Lumina');
      expect(donation.isGift).toBe(true);
      expect(donation.recipientName).toBe('Alex Ocean');
      expect(donation.referral).toBe('REF-REEF-2026');
    });

    it('retrieves donation safely by secure verification token', async () => {
      const created = await db.createDonation({
        donorName: 'Anonymous Hero',
        donorEmail: 'anon@ocean.org',
        amountSen: 10000,
        attributionPreference: 'anonymous',
        billplzBillId: 'bpz_anon_222',
      });

      const found = await db.getDonationByToken(created.verificationToken);
      expect(found).not.toBeNull();
      expect(found?.internalReference).toBe(created.internalReference);
    });
  });

  describe('Authoritative Payment State Transitions & Anti-Reversion', () => {
    it('transitions pending -> paid idempotently', async () => {
      const donation = await db.createDonation({
        donorName: 'Test Supporter',
        donorEmail: 'supporter@reef.org',
        amountSen: 10000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_state_333',
      });

      // 1. Initial transition to paid
      const firstUpdate = await db.updateDonationPaymentStatus(
        donation.internalReference,
        'paid',
        '2026-10-27T10:00:00.000Z'
      );
      expect(firstUpdate.isStateChanged).toBe(true);
      expect(firstUpdate.donation?.paymentStatus).toBe('paid');

      // 2. Duplicate webhook callback (idempotent)
      const secondUpdate = await db.updateDonationPaymentStatus(
        donation.internalReference,
        'paid',
        '2026-10-27T10:00:00.000Z'
      );
      expect(secondUpdate.isStateChanged).toBe(false);
      expect(secondUpdate.donation?.paymentStatus).toBe('paid');
    });

    it('rejects illegal reversion: paid transaction cannot be reverted by late failure or cancellation callback', async () => {
      const donation = await db.createDonation({
        donorName: 'Confirmed Donor',
        donorEmail: 'confirmed@reef.org',
        amountSen: 50000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_state_444',
      });

      // Set to paid
      await db.updateDonationPaymentStatus(donation.internalReference, 'paid');

      // Attempt late failed callback
      const failedAttempt = await db.updateDonationPaymentStatus(
        donation.internalReference,
        'failed'
      );
      expect(failedAttempt.isStateChanged).toBe(false);
      expect(failedAttempt.rejectedReversion).toBe(true);
      expect(failedAttempt.donation?.paymentStatus).toBe('paid');

      // Attempt late cancellation callback
      const cancelAttempt = await db.updateDonationPaymentStatus(
        donation.internalReference,
        'cancelled'
      );
      expect(cancelAttempt.isStateChanged).toBe(false);
      expect(cancelAttempt.rejectedReversion).toBe(true);
      expect(cancelAttempt.donation?.paymentStatus).toBe('paid');
    });

    it('matches returned Billplz Bill ID to the correct internal donation reference', async () => {
      const donation1 = await db.createDonation({
        donorName: 'Donor Alpha',
        donorEmail: 'alpha@reef.org',
        amountSen: 10000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_alpha_111',
        internalReference: 'SOL-202610-ALFA',
      });

      const donation2 = await db.createDonation({
        donorName: 'Donor Beta',
        donorEmail: 'beta@reef.org',
        amountSen: 20000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_beta_222',
        internalReference: 'SOL-202610-BETA',
      });

      // Query by bill ID
      const matched1 = await db.getDonationByBillId('bpz_alpha_111');
      expect(matched1).not.toBeNull();
      expect(matched1?.internalReference).toBe('SOL-202610-ALFA');
      expect(matched1?.donorName).toBe('Donor Alpha');

      const matched2 = await db.getDonationByBillId('bpz_beta_222');
      expect(matched2).not.toBeNull();
      expect(matched2?.internalReference).toBe('SOL-202610-BETA');
      expect(matched2?.donorName).toBe('Donor Beta');

      // Update by bill ID updates only the target record
      const updateAlpha = await db.updateDonationPaymentStatus('bpz_alpha_111', 'paid');
      expect(updateAlpha.donation?.internalReference).toBe('SOL-202610-ALFA');
      expect(updateAlpha.donation?.paymentStatus).toBe('paid');

      const checkBeta = await db.getDonationByBillId('bpz_beta_222');
      expect(checkBeta?.paymentStatus).toBe('pending');
    });

    it('ensures payment updates are idempotent when webhook arrives BEFORE redirect', async () => {
      const donation = await db.createDonation({
        donorName: 'Order Flow 1',
        donorEmail: 'flow1@reef.org',
        amountSen: 15000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_flow1_webhook_first',
        internalReference: 'SOL-202610-FLW1',
      });

      // 1. Webhook arrives first
      const webhookUpdate = await db.updateDonationPaymentStatus(
        donation.billplzBillId,
        'paid',
        '2026-10-31T08:00:00Z'
      );
      expect(webhookUpdate.isStateChanged).toBe(true);
      expect(webhookUpdate.donation?.paymentStatus).toBe('paid');

      // Dispatch receipt
      await db.markReceiptSent(donation.internalReference);
      const afterReceipt = await db.getDonationByReference(donation.internalReference);
      expect(afterReceipt?.receiptCount).toBe(1);

      // 2. Browser redirect arrives later
      const redirectUpdate = await db.updateDonationPaymentStatus(
        donation.billplzBillId,
        'paid',
        '2026-10-31T08:00:02Z'
      );
      expect(redirectUpdate.isStateChanged).toBe(false);
      expect(redirectUpdate.donation?.paymentStatus).toBe('paid');

      // Receipt count must not duplicate
      const afterRedirect = await db.getDonationByReference(donation.internalReference);
      expect(afterRedirect?.receiptCount).toBe(1);
    });

    it('ensures payment updates are idempotent when redirect arrives BEFORE webhook', async () => {
      const donation = await db.createDonation({
        donorName: 'Order Flow 2',
        donorEmail: 'flow2@reef.org',
        amountSen: 25000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_flow2_redirect_first',
        internalReference: 'SOL-202610-FLW2',
      });

      // 1. Browser redirect arrives first and verifies payment
      const redirectUpdate = await db.updateDonationPaymentStatus(
        donation.billplzBillId,
        'paid',
        '2026-10-31T09:00:00Z'
      );
      expect(redirectUpdate.isStateChanged).toBe(true);
      expect(redirectUpdate.donation?.paymentStatus).toBe('paid');

      // Dispatch receipt
      await db.markReceiptSent(donation.internalReference);
      const afterReceipt = await db.getDonationByReference(donation.internalReference);
      expect(afterReceipt?.receiptCount).toBe(1);

      // 2. Webhook callback arrives second
      const webhookUpdate = await db.updateDonationPaymentStatus(
        donation.billplzBillId,
        'paid',
        '2026-10-31T09:00:05Z'
      );
      expect(webhookUpdate.isStateChanged).toBe(false);
      expect(webhookUpdate.donation?.paymentStatus).toBe('paid');

      // Receipt count must remain exactly 1
      const afterWebhook = await db.getDonationByReference(donation.internalReference);
      expect(afterWebhook?.receiptCount).toBe(1);
    });

    it('prevents late failure or cancellation from regressing status regardless of arrival order', async () => {
      const donation = await db.createDonation({
        donorName: 'Order Flow 3',
        donorEmail: 'flow3@reef.org',
        amountSen: 30000,
        attributionPreference: 'public',
        billplzBillId: 'bpz_flow3_reversion',
        internalReference: 'SOL-202610-FLW3',
      });

      // Paid via redirect
      await db.updateDonationPaymentStatus(donation.billplzBillId, 'paid');

      // Out-of-order delayed webhook indicating failed or cancelled
      const lateFail = await db.updateDonationPaymentStatus(donation.billplzBillId, 'failed');
      expect(lateFail.isStateChanged).toBe(false);
      expect(lateFail.rejectedReversion).toBe(true);
      expect(lateFail.donation?.paymentStatus).toBe('paid');

      const lateCancel = await db.updateDonationPaymentStatus(donation.billplzBillId, 'cancelled');
      expect(lateCancel.isStateChanged).toBe(false);
      expect(lateCancel.rejectedReversion).toBe(true);
      expect(lateCancel.donation?.paymentStatus).toBe('paid');
    });
  });

  describe('Durable Database Failure Handling', () => {
    it('throws DatabaseError when D1 fails (never falls back to ephemeral memory quietly)', async () => {
      // Mock D1 binding that throws SQL error
      const brokenD1: D1DatabaseBinding = {
        prepare: () => ({
          bind: () => brokenD1.prepare(''),
          first: async () => {
            throw new Error('D1_STORAGE_WRITE_FAILURE: disk full');
          },
          all: async () => {
            throw new Error('D1_STORAGE_READ_FAILURE: lock timeout');
          },
          run: async () => {
            throw new Error('D1_STORAGE_WRITE_FAILURE: database locked');
          },
        }),
      };

      await expect(
        db.createDonation(
          {
            donorName: 'Fail Test',
            donorEmail: 'fail@reef.org',
            amountSen: 5000,
            attributionPreference: 'public',
            billplzBillId: 'bpz_fail_001',
          },
          brokenD1
        )
      ).rejects.toThrow(DatabaseError);
    });
  });
});

