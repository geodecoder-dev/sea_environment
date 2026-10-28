/**
 * Centralized static brand copy and configuration for Solaris Reef.
 * Grounded directly in the official Coralku & Leo-Lion Club of KL Solaris
 * Citizen Restoration Programme (CRP) introduction deck.
 */

export interface TeamMember {
  name: string;
  role: string;
}

export interface SiteContact {
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  socialLinks?: Record<string, string>;
}

export interface SiteConfig {
  organisationName: string;
  leadCoordinator: string;
  initiativeName: string;
  partnerName: string;
  motto: string;
  tagline: string;
  location: {
    site: string;
    island: string;
    state: string;
    country: string;
    resortPartner: string;
  };
  contact: SiteContact;
  partners: {
    academic?: string[];
    hospitality: string;
  };
  coreTeam: TeamMember[];
  stats: {
    coralsPlantedSinceLaunch: string;
    studiesPublished: number;
    rdStartYear: number;
    officialLaunchYear: number;
    langTengahFishSpecies: string;
    langTengahHardCoralSpecies: string;
    langTengahMarineSpecies: string;
    plantingSeason: string;
  };
  bleachingReport2024: {
    title: string;
    source: string;
    nationalBleachedPct: string;
    nationalMortalityPct: string;
    peakSiteMortalityPct: string;
    terengganuAverageMortalityPct: string;
    keyImpact: string;
  };
  pricingRules: {
    coralUnitRm: number;
    annualUpdatesRm: number;
    thresholdForUpdatesRm: number;
    spiderFrameRm: number;
    spiderFrameFragments: number;
  };
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
  leadCoordinator: 'Bernice Tang',
  initiativeName: 'Adopt a coral',
  partnerName: 'Coralku',
  motto: 'coralku, coralmu jua',
  tagline: 'Science-Backed Coral Reef Conservation, Restoration & Research.',
  location: {
    site: 'Pantai Pasir Besar',
    island: 'Pulau Lang Tengah (Lang Tengah Island)',
    state: 'Terengganu',
    country: 'Malaysia',
    resortPartner: 'Summer Bay Resort',
  },
  contact: {
    email: 'bernicetcy@gmail.com',
    phone: '(+60) 12-3660188',
    website: 'https://www.coralku.org',
    address: 'Pantai Pasir Besar, Pulau Lang Tengah, Terengganu, Malaysia',
  },
  partners: {
    //academic: ['Universität Konstanz', 'University of Technology Sydney (UTS)'],
    hospitality: 'Summer Bay Resort (Lang Tengah Island)',
  },
  coreTeam: [
    { name: 'Sebastian Szereday', role: 'Director of Science' },
    { name: 'Dr Natasha Zulaikha', role: 'Co-Founder | Director' },
    { name: 'Chew Kok Lynn', role: 'Project Coordinator' },
  ],
  stats: {
    coralsPlantedSinceLaunch: '20,000+',
    studiesPublished: 8,
    rdStartYear: 2018,
    officialLaunchYear: 2021,
    langTengahFishSpecies: 'Over 200 species of fish',
    langTengahHardCoralSpecies: '120 species of hard corals',
    langTengahMarineSpecies: '500+ species of marine life',
    plantingSeason: 'April to October',
  },
  bleachingReport2024: {
    title: "Malaysia's Reef in Crisis: 2024 Coral Bleaching Impact Report",
    source: 'Reef Check Malaysia & Coralku',
    nationalBleachedPct: '50.7%',
    nationalMortalityPct: '34.1%',
    peakSiteMortalityPct: 'Over 80%',
    terengganuAverageMortalityPct: 'Nearly 45%',
    keyImpact:
      'Terengganu was hit the hardest with up to 80% coral mortality at some sites. Complex branching corals (essential reef builders and fish habitats) suffered the greatest losses.',
  },
  pricingRules: {
    coralUnitRm: 50,
    annualUpdatesRm: 50,
    thresholdForUpdatesRm: 100,
    spiderFrameRm: 500,
    spiderFrameFragments: 10,
  },
  claims: {
    speciesCountDescription:
      'The 2024 marine heatwave bleached 50.7% of Malaysia’s reefs and killed roughly 45% of corals in Terengganu. This threatens the biodiversity of Pulau Lang Tengah, which supports over 200 fish species, 120 hard coral species, and more than 500 species of marine life. Targeted restoration is therefore urgent.',

    marineLifeKeystoneDescription:
      'In the 2024 bleaching event documented by Reef Check Malaysia and Coralku, over 34.1% of surveyed corals died, with Terengganu suffering over 80% loss at hard-hit sites. We lost critical branching reef builders that provide 3D habitat complexity and dissipate coastal wave energy.',

    keystoneSource: 'Source: 2024 Coral Bleaching Impact Report (Reef Check Malaysia & Coralku)',

    zeroOverheadDescription:
      'Every ringgit directly funds physical nursery spider frames, coral collection, shoreline planting setups, dive boat fuel, and 12-month photogrammetric monitoring at Pantai Pasir Besar.',

    directAllocationBadge: 'Directly allocated to support our cause.',
  },
};
