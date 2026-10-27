/**
 * Centralized Pricing & Entitlement Rules
 * Shared between Frontend and Backend for Solaris Reef Campaign
 *
 * Rules:
 * - Minimum donation: RM 50 (5,000 sen)
 * - Monthly updates eligibility threshold: RM 100 (10,000 sen)
 * - Preset 1 (RM 50): 1 coral fragment, 0 months updates
 * - Preset 2 (RM 100): 1 coral fragment, 12 months verified photo/health updates
 * - Preset 3 (RM 500): 25 coral fragments (Complete Spider Frame Restoration), 12 months verified updates
 *
 * Custom amounts:
 * - Below RM 50: Ineligible (0 fragments, no updates)
 * - RM 50 to RM 99: 1 fragment, no updates
 * - RM 100 to RM 499: 1 fragment + Math.floor((amountRm - 100) / 50) additional fragments (i.e. Math.floor(amountRm / 50) - 1 with update package, min 1 frag), eligible for updates
 * - RM 500 and above: 25 fragments + Math.floor((amountRm - 500) / 50) additional fragments, eligible for updates
 */

export const MIN_DONATION_RM = 50;
export const MIN_DONATION_SEN = 5000;
export const MAX_DONATION_RM = 100000;
export const MAX_DONATION_SEN = 10000000;
export const UPDATES_THRESHOLD_RM = 100;
export const UPDATES_THRESHOLD_SEN = 10000;

export interface DonationEntitlement {
  amountRm: number;
  amountSen: number;
  coralFragmentsCount: number;
  updatesEligible: boolean;
  updatesDurationMonths: number;
  entitlementTitle: string;
  entitlementDescription: string;
  isPreset: boolean;
}

export const DONATION_PRESETS: Record<number, { fragments: number; updates: boolean; title: string; desc: string }> = {
  50: {
    fragments: 1,
    updates: false,
    title: 'Coral Seed Sponsor',
    desc: 'Adopt 1 micro-fragment secured via Coral Clips onto nursery structures.',
  },
  100: {
    fragments: 1,
    updates: true,
    title: 'Guardian Donor',
    desc: 'Adopt 1 micro-fragment with 12 months of quarterly photo updates & growth reports.',
  },
  500: {
    fragments: 25,
    updates: true,
    title: 'Spider Frame Patron',
    desc: 'Sponsor an entire 25-fragment spider frame restoring a degraded reef patch with 12 months of updates.',
  },
};

/**
 * Calculates fragments and update entitlements deterministically from donation amount.
 */
export function calculateEntitlements(amountRm: number): DonationEntitlement {
  const roundedRm = Math.floor(amountRm);
  const amountSen = roundedRm * 100;

  if (roundedRm < MIN_DONATION_RM) {
    return {
      amountRm: roundedRm,
      amountSen,
      coralFragmentsCount: 0,
      updatesEligible: false,
      updatesDurationMonths: 0,
      entitlementTitle: 'Below Minimum',
      entitlementDescription: `Minimum contribution is RM ${MIN_DONATION_RM}.`,
      isPreset: false,
    };
  }

  // Exact Presets
  if (DONATION_PRESETS[roundedRm]) {
    const preset = DONATION_PRESETS[roundedRm];
    return {
      amountRm: roundedRm,
      amountSen,
      coralFragmentsCount: preset.fragments,
      updatesEligible: preset.updates,
      updatesDurationMonths: preset.updates ? 12 : 0,
      entitlementTitle: preset.title,
      entitlementDescription: preset.desc,
      isPreset: true,
    };
  }

  // Custom Amounts
  const updatesEligible = roundedRm >= UPDATES_THRESHOLD_RM;
  let coralFragmentsCount = 1;

  if (roundedRm >= 500) {
    // 25 fragments for the first RM 500, +1 fragment per additional RM 50
    coralFragmentsCount = 25 + Math.floor((roundedRm - 500) / 50);
  } else if (roundedRm >= 100) {
    // 1 fragment for first RM 100 (which includes updates package), +1 fragment per additional RM 50
    coralFragmentsCount = 1 + Math.floor((roundedRm - 100) / 50);
  } else {
    // RM 50 - RM 99
    coralFragmentsCount = 1;
  }

  return {
    amountRm: roundedRm,
    amountSen,
    coralFragmentsCount,
    updatesEligible,
    updatesDurationMonths: updatesEligible ? 12 : 0,
    entitlementTitle: `Custom Sponsor (RM ${roundedRm})`,
    entitlementDescription: `${coralFragmentsCount} coral fragment${coralFragmentsCount > 1 ? 's' : ''}${
      updatesEligible ? ' with 12 months quarterly monitoring updates' : ''
    }.`,
    isPreset: false,
  };
}

export function calculateEntitlementsFromSen(amountSen: number): DonationEntitlement {
  return calculateEntitlements(Math.floor(amountSen / 100));
}
