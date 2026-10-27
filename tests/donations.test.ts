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
