import { describe, it, expect } from 'vitest';
import {
  calculateEntitlements,
  calculateEntitlementsFromSen,
  MIN_DONATION_RM,
  UPDATES_THRESHOLD_RM,
  DONATION_PRESETS,
} from '../server/services/pricing.js';

describe('Donation Pricing and Entitlements Service', () => {
  it('should define correct minimum donation and update thresholds', () => {
    expect(MIN_DONATION_RM).toBe(50);
    expect(UPDATES_THRESHOLD_RM).toBe(100);
  });

  describe('Advertised Presets Consistency', () => {
    it('Preset RM 50: sponsors exactly 1 fragment with no monthly updates', () => {
      const result = calculateEntitlements(50);
      expect(result.amountRm).toBe(50);
      expect(result.amountSen).toBe(5000);
      expect(result.coralFragmentsCount).toBe(1);
      expect(result.updatesEligible).toBe(false);
      expect(result.updatesDurationMonths).toBe(0);
      expect(result.isPreset).toBe(true);
      expect(result.entitlementTitle).toBe('Coral Seed Sponsor');
    });

    it('Preset RM 100: sponsors 1 fragment with 12 months monitoring updates', () => {
      const result = calculateEntitlements(100);
      expect(result.amountRm).toBe(100);
      expect(result.amountSen).toBe(10000);
      expect(result.coralFragmentsCount).toBe(1);
      expect(result.updatesEligible).toBe(true);
      expect(result.updatesDurationMonths).toBe(12);
      expect(result.isPreset).toBe(true);
      expect(result.entitlementTitle).toBe('Guardian Donor');
    });

    it('Preset RM 500: sponsors full Spider Frame with exactly 25 fragments + 12 months updates', () => {
      const result = calculateEntitlements(500);
      expect(result.amountRm).toBe(500);
      expect(result.amountSen).toBe(50000);
      expect(result.coralFragmentsCount).toBe(25);
      expect(result.updatesEligible).toBe(true);
      expect(result.updatesDurationMonths).toBe(12);
      expect(result.isPreset).toBe(true);
      expect(result.entitlementTitle).toBe('Spider Frame Patron');
    });
  });

  describe('Threshold Boundaries and Edge Cases', () => {
    it('rejects contributions below minimum (e.g. RM 49)', () => {
      const result = calculateEntitlements(49);
      expect(result.coralFragmentsCount).toBe(0);
      expect(result.updatesEligible).toBe(false);
      expect(result.entitlementTitle).toBe('Below Minimum');
    });

    it('RM 99 boundary: 1 fragment, strictly ineligible for updates', () => {
      const result = calculateEntitlements(99);
      expect(result.coralFragmentsCount).toBe(1);
      expect(result.updatesEligible).toBe(false);
      expect(result.updatesDurationMonths).toBe(0);
    });

    it('RM 100 boundary: exactly eligible for updates', () => {
      const result = calculateEntitlements(100);
      expect(result.updatesEligible).toBe(true);
      expect(result.updatesDurationMonths).toBe(12);
    });

    it('Custom RM 150: 2 fragments with 12 months updates', () => {
      // 1 fragment for first 100 (incl updates) + 1 fragment for remaining 50 = 2 frags
      const result = calculateEntitlements(150);
      expect(result.coralFragmentsCount).toBe(2);
      expect(result.updatesEligible).toBe(true);
    });

    it('Custom RM 600: 27 fragments (25 from 500 frame + 2 from extra 100)', () => {
      const result = calculateEntitlements(600);
      expect(result.coralFragmentsCount).toBe(27);
      expect(result.updatesEligible).toBe(true);
    });

    it('calculateEntitlementsFromSen matches Sen calculations accurately', () => {
      expect(calculateEntitlementsFromSen(5000).coralFragmentsCount).toBe(1);
      expect(calculateEntitlementsFromSen(10000).updatesEligible).toBe(true);
      expect(calculateEntitlementsFromSen(50000).coralFragmentsCount).toBe(25);
    });
  });
});
