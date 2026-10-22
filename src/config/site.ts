/**
 * Centralized static brand copy and configuration for Solaris Reef.
 * Single source of truth for organization details and ecological marketing claims.
 */

export interface SiteContact {
  address?: string;
  email?: string;
  phone?: string;
  socialLinks?: Record<string, string>;
}

export interface SiteConfig {
  organisationName: string;
  initiativeName: string;
  tagline: string;
  contact: SiteContact;
  claims: {
    speciesCountDescription: string;
    marineLifeKeystoneDescription: string;
    keystoneSource: string;
    zeroOverheadDescription: string;
    directAllocationBadge: string;
  };
}

export const siteConfig: SiteConfig = {
  organisationName: 'Leo-Lion Club of KL Solaris',
  initiativeName: 'Solaris Reef',
  tagline: 'We Serve Our Oceans, We Protect Our Future.',
  contact: {
    // Contact details omitted as none were provided in the configuration brief
  },
  claims: {
    // TODO: verify this claim and source before launch
    speciesCountDescription:
      'Coral reefs are the rainforests of the ocean. In Malaysia’s tropical seas, they shelter more than 3,000 species of marine flora and fauna. Yet, climate spikes and human disturbance have left large swaths of seabed fractured.',

    // TODO: verify this claim and source before launch
    marineLifeKeystoneDescription:
      'Although reefs cover less than 1% of the world’s seabed, they support 25% of all marine life. In Malaysia, healthy barrier reefs dissipate up to 97% of wave energy, defending coastal villages from seasonal monsoons and coastal erosion.',

    keystoneSource: 'Source: Reef Check Malaysia & Department of Fisheries',

    // TODO: verify this claim and source before launch
    zeroOverheadDescription:
      'Donations are never consumed by corporate overhead. We operate as an NGO club with volunteer labor. 100% of campaign proceeds go straight into metal spider-frame fabrication, eco-friendly marine adhesive, dive boat fuel, and benthic survey equipment.',

    // TODO: verify this claim and source before launch
    directAllocationBadge: '100% directly allocated to reef beds',
  },
};
