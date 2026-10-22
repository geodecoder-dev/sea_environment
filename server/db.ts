/**
 * Database Layer for Solaris Reef Campaign Hub
 * Supports Cloudflare D1 (Edge SQL) with zero Node.js filesystem dependencies.
 * Provides an asynchronous interface and in-memory store for development/fallback.
 */

import {
  Campaign,
  Donation,
  CampaignUpdate,
  AdminUser,
  AdminActivity,
  WebhookLog,
  DatabaseSchema,
  PaymentStatus,
  AttributionPreference,
} from './types.js';

export type D1PreparedStatement = {
  bind: (...params: any[]) => D1PreparedStatement;
  first: <T = any>(colName?: string) => Promise<T | null>;
  all: <T = any>() => Promise<{ results?: T[]; success: boolean }>;
  run: () => Promise<{ success: boolean }>;
};

export type D1DatabaseBinding = {
  prepare: (query: string) => D1PreparedStatement;
  batch?: (statements: any[]) => Promise<any[]>;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRandomHex(length = 4): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function createDefaultSeed(): DatabaseSchema {
  const initialCampaign: Campaign = {
    id: 'solaris-reef-2026',
    title: 'Solaris Reef: Coralku Community Restoration Initiative',
    slug: 'solaris-reef',
    description:
      'In scientific partnership with Coralku and local marine researchers, Leo-Lion Club of KL Solaris accelerates resilience-based reef restoration at Pulau Lang Tengah and Peninsular marine parks. Utilizing Coral Clips technology, deep-water nurseries, and Project ASSIST super-corals, we restore depleted reefs into self-sustaining, naturally spawning ecosystems.',
    fundraisingTargetSen: 5000000, // RM 50,000.00
    coralPlantingTarget: 15000,
    verifiedCoralPlantingCount: 7420,
    volunteerCount: 56,
    campaignStatus: 'active',
    location: 'Pulau Lang Tengah & Terengganu Marine Sanctuary, Malaysia',
    milestones: [
      {
        id: 'ms-coralku-1',
        title: 'Phase 1: Shallow Reef Nursery Foundation (Summer Bay, Pulau Lang Tengah)',
        targetSen: 1500000,
        coralCount: 3500,
        description: 'Deployed initial 50 modular nursery spider tables and citizen restoration plots, establishing baseline thermal monitoring.',
        achieved: true,
      },
      {
        id: 'ms-coralku-2',
        title: 'Phase 2: Coral Clips Substrate Deployment (7,000+ Corals Secured)',
        targetSen: 2500000,
        coralCount: 7000,
        description: 'Introduced eco-friendly spring-steel Coral Clips in collaboration with Australian marine biologists, achieving an 80% 6-month survival rate.',
        achieved: true,
      },
      {
        id: 'ms-coralku-3',
        title: 'Phase 3: Landmark Multi-Species Coral Spawning Documented',
        targetSen: 3500000,
        coralCount: 9500,
        description: 'Documented 8 distinct restored coral species reaching sexual maturity and spawning simultaneously in the wild, enabling natural larval replenishment.',
        achieved: true,
      },
      {
        id: 'ms-coralku-4',
        title: 'Phase 4: Project ASSIST — "Super Corals" & Deep Nursery Expansion',
        targetSen: 5000000,
        coralCount: 15000,
        description: 'Pioneered Malaysia’s largest deep-water nursery (12m depth) to cultivate heat-tolerant super-corals, shielding colonies from severe marine bleaching.',
        achieved: false,
      },
      {
        id: 'ms-coralku-5',
        title: 'Phase 5: 20,000+ Outplants & Marine Sanctuary Ranger Training',
        targetSen: 7500000,
        coralCount: 20000,
        description: 'Scale outplanting to exceed 20,000 verified colonies with >72% long-term survival, funding local island youth conservation rangers.',
        achieved: false,
      },
    ],
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-10-19T08:30:00.000Z',
  };

  const initialUpdates: CampaignUpdate[] = [
    {
      id: 'upd-coralku-1',
      title: 'Historic Milestone: 8 Restored Coral Species Spawn in Lang Tengah Garden',
      slug: 'historic-coral-spawning-lang-tengah',
      description:
        'During our seasonal night dive survey at Summer Bay, marine biologists documented a historic triumph: 8 transplanted coral species spawned simultaneously, releasing viable egg-and-sperm bundles into the ocean currents. This proves outplanted corals have reached reproductive maturity, triggering self-sustaining larval recruitment across Terengganu waters.',
      imageUrl: '/src/assets/images/coral_spawning_night_1792398688907.jpg',
      category: 'milestone',
      publicationStatus: 'published',
      publicationDate: '2026-09-24T21:40:00.000Z',
      createdAt: '2026-09-24T21:40:00.000Z',
      updatedAt: '2026-09-24T21:40:00.000Z',
    },
    {
      id: 'upd-coralku-2',
      title: 'Project ASSIST: Deep-Water Nurseries Shield "Super Corals" from Bleaching Spike',
      slug: 'project-assist-deep-water-nurseries',
      description:
        'Coralku’s pioneering Project ASSIST cultivates heat-resilient "super corals" in Malaysia’s largest deep-water nursery at 12m depth. Positioning nursery frames below shallow surface thermal layers shielded our colonies from light and heat stress, achieving an outstanding >80% survival rate throughout the recent severe El Niño bleaching event.',
      imageUrl: '/src/assets/images/coral_fragment_nursery_1792397670199.jpg',
      category: 'biodiversity',
      publicationStatus: 'published',
      publicationDate: '2026-10-06T11:15:00.000Z',
      createdAt: '2026-10-06T11:15:00.000Z',
      updatedAt: '2026-10-06T11:15:00.000Z',
    },
    {
      id: 'upd-coralku-3',
      title: 'Coral Clips Innovation: Over 7,000 Fragments Secured to Natural Substrate',
      slug: 'coral-clips-innovation-deployment',
      description:
        'In collaboration with Australian marine researchers, Coralku introduced spring-steel Coral Clips to anchor loose coral fragments directly to solid limestone substrate without toxic chemical adhesives or single-use plastic zip ties. Over 7,000 corals have benefited to date, exhibiting rapid skeletal encrustation.',
      imageUrl: '/src/assets/images/coral_clips_substrate_1792398689267.jpg',
      category: 'volunteer',
      publicationStatus: 'published',
      publicationDate: '2026-10-14T14:30:00.000Z',
      createdAt: '2026-10-14T14:30:00.000Z',
      updatedAt: '2026-10-14T14:30:00.000Z',
    },
    {
      id: 'upd-coralku-4',
      title: 'Citizen Restoration: 331 Corals Planted onto 20 Frames with Youth Divers',
      slug: 'citizen-restoration-youth-divers-expedition',
      description:
        'Leo-Lion Club of KL Solaris youth divers joined Coralku marine scientists for a two-day hands-on field workshop. 331 healthy fragments were tagged and attached onto 20 spider frames. Subsequent 6-month benthic photogrammetry confirms rapid tissue fusion and healthy damselfish repopulation.',
      imageUrl: '/src/assets/images/volunteer_divers_restoration_1792397671746.jpg',
      category: 'volunteer',
      publicationStatus: 'published',
      publicationDate: '2026-10-18T16:00:00.000Z',
      createdAt: '2026-10-18T16:00:00.000Z',
      updatedAt: '2026-10-18T16:00:00.000Z',
    },
  ];

  const initialDonations: Donation[] = [
    {
      id: 'don-1',
      internalReference: 'SOL-202609-8472',
      campaignId: 'solaris-reef-2026',
      donorName: 'Tan Sri Jeffrey Lim',
      donorEmail: 'jeffrey.lim@example.com',
      amountSen: 500000,
      currency: 'MYR',
      attributionPreference: 'public',
      message: 'Proud to support KL Solaris youth on this vital marine mission!',
      billplzBillId: 'bpz_seed_101',
      paymentStatus: 'paid',
      paidAt: '2026-09-12T10:14:22.000Z',
      createdAt: '2026-09-12T10:12:00.000Z',
      updatedAt: '2026-09-12T10:14:22.000Z',
    },
    {
      id: 'don-2',
      internalReference: 'SOL-202609-9134',
      campaignId: 'solaris-reef-2026',
      donorName: 'Nurul Aisyah & Family',
      donorEmail: 'aisyah.m@example.my',
      amountSen: 100000,
      currency: 'MYR',
      attributionPreference: 'public',
      message: 'For future generations of Malaysian divers and children.',
      billplzBillId: 'bpz_seed_102',
      paymentStatus: 'paid',
      paidAt: '2026-09-20T16:45:00.000Z',
      createdAt: '2026-09-20T16:43:00.000Z',
      updatedAt: '2026-09-20T16:45:00.000Z',
    },
    {
      id: 'don-3',
      internalReference: 'SOL-202610-1082',
      campaignId: 'solaris-reef-2026',
      donorName: 'Anonymous Supporter',
      donorEmail: 'supporter@secret.my',
      amountSen: 25000,
      currency: 'MYR',
      attributionPreference: 'anonymous',
      message: 'Every fragment matters.',
      billplzBillId: 'bpz_seed_103',
      paymentStatus: 'paid',
      paidAt: '2026-10-04T08:22:15.000Z',
      createdAt: '2026-10-04T08:20:00.000Z',
      updatedAt: '2026-10-04T08:22:15.000Z',
    },
    {
      id: 'don-4',
      internalReference: 'SOL-202610-2391',
      campaignId: 'solaris-reef-2026',
      donorName: 'Dr. Ramesh Kumar',
      donorEmail: 'ramesh.kumar@example.com',
      amountSen: 50000,
      currency: 'MYR',
      attributionPreference: 'public',
      message: 'Keep planting corals! Great work team.',
      billplzBillId: 'bpz_seed_104',
      paymentStatus: 'paid',
      paidAt: '2026-10-08T19:05:40.000Z',
      createdAt: '2026-10-08T19:02:00.000Z',
      updatedAt: '2026-10-08T19:05:40.000Z',
    },
    {
      id: 'don-5',
      internalReference: 'SOL-202610-3945',
      campaignId: 'solaris-reef-2026',
      donorName: 'Chloe Wong',
      donorEmail: 'chloe.wong@example.com',
      amountSen: 10000,
      currency: 'MYR',
      attributionPreference: 'public',
      message: 'Planted 10 fragments with love 🪸',
      billplzBillId: 'bpz_seed_105',
      paymentStatus: 'paid',
      paidAt: '2026-10-14T12:30:10.000Z',
      createdAt: '2026-10-14T12:28:00.000Z',
      updatedAt: '2026-10-14T12:30:10.000Z',
    },
    {
      id: 'don-6',
      internalReference: 'SOL-202610-4109',
      campaignId: 'solaris-reef-2026',
      donorName: 'Leo Club Solaris Alumni',
      donorEmail: 'alumni@leolion-solaris.org',
      amountSen: 1500000,
      currency: 'MYR',
      attributionPreference: 'public',
      message: 'Youth leadership in conservation!',
      billplzBillId: 'bpz_seed_106',
      paymentStatus: 'paid',
      paidAt: '2026-10-16T15:20:00.000Z',
      createdAt: '2026-10-16T15:18:00.000Z',
      updatedAt: '2026-10-16T15:20:00.000Z',
    },
  ];

  return {
    campaign: initialCampaign,
    updates: initialUpdates,
    donations: initialDonations,
    admins: [],
    activities: [
      {
        id: 'act-1',
        adminId: 'admin-1',
        adminName: 'KL Solaris Club Administrator',
        action: 'CAMPAIGN_INITIALIZED',
        entityType: 'campaign',
        entityReference: 'solaris-reef-2026',
        details: 'Initialized Solaris Reef flagship campaign with RM 50,000 goal and 1,500 target fragments.',
        timestamp: '2026-08-01T08:00:00.000Z',
      },
    ],
    webhookLogs: [],
  };
}

export class Database {
  private memData: DatabaseSchema;

  constructor() {
    this.memData = createDefaultSeed();
  }

  // ---------------------------------------------------------------------------
  // CAMPAIGN METHODS (D1 / In-Memory)
  // ---------------------------------------------------------------------------

  public async getCampaign(d1?: D1DatabaseBinding) {
    if (d1) {
      try {
        const campaignRow = await d1
          .prepare('SELECT * FROM campaigns WHERE id = ? LIMIT 1')
          .bind('solaris-reef-2026')
          .first<any>();

        if (campaignRow) {
          const stats = await d1
            .prepare(
              "SELECT COALESCE(SUM(amount_sen), 0) AS total_raised, COUNT(*) AS paid_count FROM donations WHERE payment_status = 'paid'"
            )
            .first<any>();

          const totalRaisedSen = Number(stats?.total_raised || 0);
          const donorCount = Number(stats?.paid_count || 0);
          const targetSen = Number(campaignRow.fundraising_target_sen);
          const percentAchieved = Math.min(100, Math.round((totalRaisedSen / targetSen) * 100));

          let milestones = [];
          try {
            milestones = JSON.parse(campaignRow.milestones_json || '[]');
          } catch {
            milestones = this.memData.campaign.milestones;
          }

          return {
            id: campaignRow.id,
            title: campaignRow.title,
            slug: campaignRow.slug,
            description: campaignRow.description,
            fundraisingTargetSen: targetSen,
            coralPlantingTarget: Number(campaignRow.coral_planting_target),
            verifiedCoralPlantingCount: Number(campaignRow.verified_coral_planting_count),
            volunteerCount: Number(campaignRow.volunteer_count),
            campaignStatus: campaignRow.campaign_status as 'active' | 'completed' | 'paused',
            location: campaignRow.location,
            milestones,
            createdAt: campaignRow.created_at,
            updatedAt: campaignRow.updated_at,
            totalRaisedSen,
            totalRaisedRm: totalRaisedSen / 100,
            fundraisingTargetRm: targetSen / 100,
            successfulDonationsCount: donorCount,
            percentAchieved,
          };
        }
      } catch (err) {
        console.warn('D1 getCampaign query fallback to memory:', err);
      }
    }

    // Fallback in-memory
    const paidDonations = this.memData.donations.filter((d) => d.paymentStatus === 'paid');
    const totalRaisedSen = paidDonations.reduce((sum, d) => sum + d.amountSen, 0);
    const donorCount = paidDonations.length;
    const percentAchieved = Math.min(
      100,
      Math.round((totalRaisedSen / this.memData.campaign.fundraisingTargetSen) * 100)
    );

    return {
      ...this.memData.campaign,
      totalRaisedSen,
      totalRaisedRm: totalRaisedSen / 100,
      fundraisingTargetRm: this.memData.campaign.fundraisingTargetSen / 100,
      successfulDonationsCount: donorCount,
      percentAchieved,
    };
  }

  public async updateCampaign(
    updates: Partial<Campaign>,
    adminUser: { id: string; name: string },
    d1?: D1DatabaseBinding
  ) {
    const updatedAt = new Date().toISOString();

    if (d1) {
      try {
        const current = await this.getCampaign(d1);
        const merged = { ...current, ...updates, updatedAt };

        await d1
          .prepare(
            `UPDATE campaigns SET 
              title = ?, description = ?, fundraising_target_sen = ?, 
              coral_planting_target = ?, verified_coral_planting_count = ?, 
              volunteer_count = ?, campaign_status = ?, milestones_json = ?, updated_at = ?
            WHERE id = ?`
          )
          .bind(
            merged.title,
            merged.description,
            merged.fundraisingTargetSen,
            merged.coralPlantingTarget,
            merged.verifiedCoralPlantingCount,
            merged.volunteerCount,
            merged.campaignStatus,
            JSON.stringify(merged.milestones || []),
            updatedAt,
            'solaris-reef-2026'
          )
          .run();

        await this.logActivity(
          {
            adminId: adminUser.id,
            adminName: adminUser.name,
            action: 'CAMPAIGN_UPDATED',
            entityType: 'campaign',
            entityReference: 'solaris-reef-2026',
            details: `Updated campaign fields: ${Object.keys(updates).join(', ')}`,
          },
          d1
        );

        return this.getCampaign(d1);
      } catch (err) {
        console.warn('D1 updateCampaign error, applying to memory:', err);
      }
    }

    this.memData.campaign = {
      ...this.memData.campaign,
      ...updates,
      updatedAt,
    };

    await this.logActivity(
      {
        adminId: adminUser.id,
        adminName: adminUser.name,
        action: 'CAMPAIGN_UPDATED',
        entityType: 'campaign',
        entityReference: this.memData.campaign.id,
        details: `Updated campaign fields: ${Object.keys(updates).join(', ')}`,
      },
      d1
    );

    return this.getCampaign();
  }

  // ---------------------------------------------------------------------------
  // CAMPAIGN UPDATES METHODS (D1 / In-Memory)
  // ---------------------------------------------------------------------------

  public async getPublicUpdates(d1?: D1DatabaseBinding): Promise<CampaignUpdate[]> {
    if (d1) {
      try {
        const res = await d1
          .prepare(
            "SELECT * FROM campaign_updates WHERE publication_status = 'published' ORDER BY publication_date DESC"
          )
          .all<any>();
        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((r: any) => ({
            id: r.id,
            title: r.title,
            slug: r.slug,
            description: r.description,
            imageUrl: r.image_url,
            category: r.category,
            publicationStatus: r.publication_status,
            publicationDate: r.publication_date,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch (err) {
        console.warn('D1 getPublicUpdates error, falling back to memory:', err);
      }
    }

    return this.memData.updates
      .filter((u) => u.publicationStatus === 'published')
      .sort((a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime());
  }

  public async getAllUpdates(d1?: D1DatabaseBinding): Promise<CampaignUpdate[]> {
    if (d1) {
      try {
        const res = await d1
          .prepare('SELECT * FROM campaign_updates ORDER BY publication_date DESC')
          .all<any>();
        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((r: any) => ({
            id: r.id,
            title: r.title,
            slug: r.slug,
            description: r.description,
            imageUrl: r.image_url,
            category: r.category,
            publicationStatus: r.publication_status,
            publicationDate: r.publication_date,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch (err) {
        console.warn('D1 getAllUpdates error, falling back to memory:', err);
      }
    }

    return [...this.memData.updates].sort(
      (a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime()
    );
  }

  public async createUpdate(
    updateData: Omit<CampaignUpdate, 'id' | 'createdAt' | 'updatedAt'>,
    adminUser: { id: string; name: string },
    d1?: D1DatabaseBinding
  ): Promise<CampaignUpdate> {
    const id = `upd-${generateRandomHex(4)}`;
    const now = new Date().toISOString();
    const newUpdate: CampaignUpdate = {
      ...updateData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO campaign_updates 
              (id, title, slug, description, image_url, category, publication_status, publication_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            newUpdate.title,
            newUpdate.slug,
            newUpdate.description,
            newUpdate.imageUrl || null,
            newUpdate.category,
            newUpdate.publicationStatus,
            newUpdate.publicationDate,
            now,
            now
          )
          .run();
      } catch (err) {
        console.warn('D1 createUpdate error:', err);
      }
    }

    this.memData.updates.unshift(newUpdate);

    await this.logActivity(
      {
        adminId: adminUser.id,
        adminName: adminUser.name,
        action: 'UPDATE_CREATED',
        entityType: 'update',
        entityReference: newUpdate.id,
        details: `Created campaign update "${newUpdate.title}" (${newUpdate.publicationStatus})`,
      },
      d1
    );

    return newUpdate;
  }

  public async updateUpdate(
    id: string,
    updateData: Partial<CampaignUpdate>,
    adminUser: { id: string; name: string },
    d1?: D1DatabaseBinding
  ): Promise<CampaignUpdate | null> {
    const now = new Date().toISOString();

    if (d1) {
      try {
        const existing = await d1
          .prepare('SELECT * FROM campaign_updates WHERE id = ? LIMIT 1')
          .bind(id)
          .first<any>();

        if (existing) {
          const merged: CampaignUpdate = {
            id,
            title: updateData.title ?? existing.title,
            slug: updateData.slug ?? existing.slug,
            description: updateData.description ?? existing.description,
            imageUrl: updateData.imageUrl ?? existing.image_url,
            category: (updateData.category ?? existing.category) as any,
            publicationStatus: (updateData.publicationStatus ?? existing.publication_status) as any,
            publicationDate: updateData.publicationDate ?? existing.publication_date,
            createdAt: existing.created_at,
            updatedAt: now,
          };

          await d1
            .prepare(
              `UPDATE campaign_updates SET 
                title = ?, slug = ?, description = ?, image_url = ?, 
                category = ?, publication_status = ?, publication_date = ?, updated_at = ?
               WHERE id = ?`
            )
            .bind(
              merged.title,
              merged.slug,
              merged.description,
              merged.imageUrl || null,
              merged.category,
              merged.publicationStatus,
              merged.publicationDate,
              now,
              id
            )
            .run();

          await this.logActivity(
            {
              adminId: adminUser.id,
              adminName: adminUser.name,
              action: 'UPDATE_MODIFIED',
              entityType: 'update',
              entityReference: id,
              details: `Modified campaign update "${merged.title}"`,
            },
            d1
          );

          return merged;
        }
      } catch (err) {
        console.warn('D1 updateUpdate error:', err);
      }
    }

    const index = this.memData.updates.findIndex((u) => u.id === id);
    if (index === -1) return null;

    this.memData.updates[index] = {
      ...this.memData.updates[index],
      ...updateData,
      updatedAt: now,
    };

    await this.logActivity(
      {
        adminId: adminUser.id,
        adminName: adminUser.name,
        action: 'UPDATE_MODIFIED',
        entityType: 'update',
        entityReference: id,
        details: `Modified campaign update "${this.memData.updates[index].title}"`,
      },
      d1
    );

    return this.memData.updates[index];
  }

  public async deleteUpdate(
    id: string,
    adminUser: { id: string; name: string },
    d1?: D1DatabaseBinding
  ): Promise<boolean> {
    if (d1) {
      try {
        await d1.prepare('DELETE FROM campaign_updates WHERE id = ?').bind(id).run();
      } catch (err) {
        console.warn('D1 deleteUpdate error:', err);
      }
    }

    const target = this.memData.updates.find((u) => u.id === id);
    this.memData.updates = this.memData.updates.filter((u) => u.id !== id);

    await this.logActivity(
      {
        adminId: adminUser.id,
        adminName: adminUser.name,
        action: 'UPDATE_DELETED',
        entityType: 'update',
        entityReference: id,
        details: `Deleted campaign update "${target?.title || id}"`,
      },
      d1
    );

    return true;
  }

  // ---------------------------------------------------------------------------
  // DONATIONS METHODS (D1 / In-Memory)
  // ---------------------------------------------------------------------------

  public async createDonation(
    data: {
      donorName: string;
      donorEmail: string;
      amountSen: number;
      attributionPreference: AttributionPreference;
      message?: string;
      billplzBillId: string;
      billplzUrl?: string;
    },
    d1?: D1DatabaseBinding
  ): Promise<Donation> {
    const internalReference = `SOL-${new Date().toISOString().slice(0, 7).replace('-', '')}-${generateRandomHex(2).toUpperCase()}`;
    const id = `don-${generateRandomHex(6)}`;
    const now = new Date().toISOString();

    const newDonation: Donation = {
      id,
      internalReference,
      campaignId: 'solaris-reef-2026',
      donorName: data.donorName || 'Generous Supporter',
      donorEmail: data.donorEmail,
      amountSen: Math.round(data.amountSen),
      currency: 'MYR',
      attributionPreference: data.attributionPreference,
      message: data.message || '',
      billplzBillId: data.billplzBillId,
      billplzUrl: data.billplzUrl,
      paymentStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO donations 
              (id, internal_reference, campaign_id, donor_name, donor_email, amount_sen, currency, attribution_preference, message, billplz_bill_id, billplz_url, payment_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            internalReference,
            'solaris-reef-2026',
            newDonation.donorName,
            newDonation.donorEmail,
            newDonation.amountSen,
            newDonation.currency,
            newDonation.attributionPreference,
            newDonation.message || null,
            newDonation.billplzBillId,
            newDonation.billplzUrl || null,
            'pending',
            now,
            now
          )
          .run();
      } catch (err) {
        console.warn('D1 createDonation error, saving in memory:', err);
      }
    }

    this.memData.donations.unshift(newDonation);
    return newDonation;
  }

  public async getDonationByReference(reference: string, d1?: D1DatabaseBinding): Promise<Donation | null> {
    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM donations WHERE internal_reference = ? LIMIT 1')
          .bind(reference)
          .first<any>();

        if (row) {
          return {
            id: row.id,
            internalReference: row.internal_reference,
            campaignId: row.campaign_id,
            donorName: row.donor_name,
            donorEmail: row.donor_email,
            amountSen: Number(row.amount_sen),
            currency: row.currency,
            attributionPreference: row.attribution_preference,
            message: row.message || '',
            billplzBillId: row.billplz_bill_id,
            billplzUrl: row.billplz_url,
            paymentStatus: row.payment_status,
            paidAt: row.paid_at,
            callbackReceivedAt: row.callback_received_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      } catch (err) {
        console.warn('D1 getDonationByReference error:', err);
      }
    }

    return this.memData.donations.find((d) => d.internalReference === reference) || null;
  }

  public async getDonationByBillId(billId: string, d1?: D1DatabaseBinding): Promise<Donation | null> {
    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM donations WHERE billplz_bill_id = ? LIMIT 1')
          .bind(billId)
          .first<any>();

        if (row) {
          return {
            id: row.id,
            internalReference: row.internal_reference,
            campaignId: row.campaign_id,
            donorName: row.donor_name,
            donorEmail: row.donor_email,
            amountSen: Number(row.amount_sen),
            currency: row.currency,
            attributionPreference: row.attribution_preference,
            message: row.message || '',
            billplzBillId: row.billplz_bill_id,
            billplzUrl: row.billplz_url,
            paymentStatus: row.payment_status,
            paidAt: row.paid_at,
            callbackReceivedAt: row.callback_received_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      } catch (err) {
        console.warn('D1 getDonationByBillId error:', err);
      }
    }

    return this.memData.donations.find((d) => d.billplzBillId === billId) || null;
  }

  public async updateDonationPaymentStatus(
    referenceOrBillId: string,
    status: PaymentStatus,
    paidAt?: string,
    d1?: D1DatabaseBinding
  ): Promise<{ donation: Donation | null; isStateChanged: boolean }> {
    const donation =
      (await this.getDonationByReference(referenceOrBillId, d1)) ||
      (await this.getDonationByBillId(referenceOrBillId, d1));

    if (!donation) {
      return { donation: null, isStateChanged: false };
    }

    // Idempotent check
    if (donation.paymentStatus === status) {
      return { donation, isStateChanged: false };
    }

    const now = new Date().toISOString();
    const finalPaidAt = status === 'paid' ? paidAt || now : donation.paidAt;

    if (d1) {
      try {
        await d1
          .prepare(
            `UPDATE donations SET 
              payment_status = ?, 
              paid_at = COALESCE(?, paid_at), 
              callback_received_at = ?, 
              updated_at = ? 
             WHERE internal_reference = ?`
          )
          .bind(status, finalPaidAt || null, now, now, donation.internalReference)
          .run();
      } catch (err) {
        console.warn('D1 updateDonationPaymentStatus error:', err);
      }
    }

    // Also update in-memory record
    const memDonation = this.memData.donations.find(
      (d) => d.internalReference === donation.internalReference
    );
    if (memDonation) {
      memDonation.paymentStatus = status;
      memDonation.updatedAt = now;
      memDonation.callbackReceivedAt = now;
      if (finalPaidAt) memDonation.paidAt = finalPaidAt;
    }

    donation.paymentStatus = status;
    donation.updatedAt = now;
    donation.callbackReceivedAt = now;
    if (finalPaidAt) donation.paidAt = finalPaidAt;

    return { donation, isStateChanged: true };
  }

  public async getDonations(
    filters?: {
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    d1?: D1DatabaseBinding
  ): Promise<{ items: Donation[]; totalCount: number; hasMore: boolean }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    if (d1) {
      try {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (filters?.status && filters.status !== 'all') {
          whereClauses.push('payment_status = ?');
          params.push(filters.status);
        }

        if (filters?.search) {
          const q = `%${filters.search.toLowerCase()}%`;
          whereClauses.push(
            '(LOWER(internal_reference) LIKE ? OR LOWER(donor_name) LIKE ? OR LOWER(donor_email) LIKE ? OR LOWER(billplz_bill_id) LIKE ?)'
          );
          params.push(q, q, q, q);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) as count FROM donations ${whereSql}`;
        const countRes = await d1.prepare(countQuery).bind(...params).first<any>();
        const totalCount = Number(countRes?.count || 0);

        const listQuery = `SELECT * FROM donations ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const listRes = await d1.prepare(listQuery).bind(...params, limit, offset).all<any>();

        const items: Donation[] = (listRes?.results || []).map((row) => ({
          id: row.id,
          internalReference: row.internal_reference,
          campaignId: row.campaign_id,
          donorName: row.donor_name,
          donorEmail: row.donor_email,
          amountSen: Number(row.amount_sen),
          currency: row.currency,
          attributionPreference: row.attribution_preference,
          message: row.message || '',
          billplzBillId: row.billplz_bill_id,
          billplzUrl: row.billplz_url,
          paymentStatus: row.payment_status,
          paidAt: row.paid_at,
          callbackReceivedAt: row.callback_received_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        return {
          items,
          totalCount,
          hasMore: offset + limit < totalCount,
        };
      } catch (err) {
        console.warn('D1 getDonations error, falling back to memory:', err);
      }
    }

    let list = [...this.memData.donations];

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((d) => d.paymentStatus === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (d) =>
          d.internalReference.toLowerCase().includes(q) ||
          d.donorName.toLowerCase().includes(q) ||
          d.donorEmail.toLowerCase().includes(q) ||
          d.billplzBillId.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCount = list.length;
    const items = list.slice(offset, offset + limit);

    return {
      items,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  }

  public async getPublicRecentDonations(limit: number = 8, d1?: D1DatabaseBinding) {
    if (d1) {
      try {
        const res = await d1
          .prepare(
            `SELECT id, donor_name, attribution_preference, amount_sen, message, paid_at, created_at 
             FROM donations 
             WHERE payment_status = 'paid' 
             ORDER BY COALESCE(paid_at, created_at) DESC 
             LIMIT ?`
          )
          .bind(limit)
          .all<any>();

        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((d) => ({
            id: d.id,
            donorName: d.attribution_preference === 'anonymous' ? 'Anonymous Reef Friend' : d.donor_name,
            amountSen: Number(d.amount_sen),
            amountRm: Number(d.amount_sen) / 100,
            message: d.message || '',
            paidAt: d.paid_at || d.created_at,
          }));
        }
      } catch (err) {
        console.warn('D1 getPublicRecentDonations error:', err);
      }
    }

    return this.memData.donations
      .filter((d) => d.paymentStatus === 'paid')
      .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
      .slice(0, limit)
      .map((d) => ({
        id: d.id,
        donorName: d.attributionPreference === 'anonymous' ? 'Anonymous Reef Friend' : d.donorName,
        amountSen: d.amountSen,
        amountRm: d.amountSen / 100,
        message: d.message,
        paidAt: d.paidAt || d.createdAt,
      }));
  }

  // ---------------------------------------------------------------------------
  // ADMIN USERS (D1 / In-Memory / Environment Secrets)
  // ---------------------------------------------------------------------------

  public async getAdminByEmail(email: string, d1?: D1DatabaseBinding): Promise<AdminUser | null> {
    if (!email) return null;

    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?) LIMIT 1')
          .bind(email.trim())
          .first<any>();

        if (row) {
          return {
            id: row.id,
            name: row.name,
            email: row.email,
            passwordHash: row.password_hash,
            salt: row.salt,
            role: row.role as 'superadmin' | 'admin',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      } catch (err) {
        console.warn('D1 getAdminByEmail error:', err);
      }
    }

    return this.memData.admins.find((a) => a.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public async getAdminById(id: string, d1?: D1DatabaseBinding): Promise<AdminUser | null> {
    if (!id) return null;

    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
          .bind(id)
          .first<any>();

        if (row) {
          return {
            id: row.id,
            name: row.name,
            email: row.email,
            passwordHash: row.password_hash,
            salt: row.salt,
            role: row.role as 'superadmin' | 'admin',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      } catch (err) {
        console.warn('D1 getAdminById error:', err);
      }
    }

    return this.memData.admins.find((a) => a.id === id) || null;
  }

  public async upsertAdminUser(
    admin: AdminUser,
    d1?: D1DatabaseBinding
  ): Promise<AdminUser> {
    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO admin_users (id, name, email, password_hash, salt, role, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(email) DO UPDATE SET 
               password_hash = excluded.password_hash, 
               salt = excluded.salt, 
               updated_at = excluded.updated_at`
          )
          .bind(
            admin.id,
            admin.name,
            admin.email,
            admin.passwordHash,
            admin.salt,
            admin.role,
            admin.createdAt,
            admin.updatedAt
          )
          .run();
      } catch (err) {
        console.warn('D1 upsertAdminUser error:', err);
      }
    }

    const idx = this.memData.admins.findIndex((a) => a.email.toLowerCase() === admin.email.toLowerCase());
    if (idx >= 0) {
      this.memData.admins[idx] = admin;
    } else {
      this.memData.admins.push(admin);
    }
    return admin;
  }

  // ---------------------------------------------------------------------------
  // AUDIT ACTIVITY & WEBHOOK LOGS (D1 / In-Memory)
  // ---------------------------------------------------------------------------

  public async logActivity(
    activity: Omit<AdminActivity, 'id' | 'timestamp'>,
    d1?: D1DatabaseBinding
  ) {
    const id = `act-${generateRandomHex(4)}`;
    const timestamp = new Date().toISOString();
    const entry: AdminActivity = {
      ...activity,
      id,
      timestamp,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO admin_activities (id, admin_id, admin_name, action, entity_type, entity_reference, details, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            entry.adminId,
            entry.adminName,
            entry.action,
            entry.entityType,
            entry.entityReference || null,
            entry.details,
            timestamp
          )
          .run();
      } catch (err) {
        console.warn('D1 logActivity error:', err);
      }
    }

    this.memData.activities.unshift(entry);
    if (this.memData.activities.length > 200) {
      this.memData.activities = this.memData.activities.slice(0, 200);
    }
  }

  public async getActivities(limit: number = 50, d1?: D1DatabaseBinding): Promise<AdminActivity[]> {
    if (d1) {
      try {
        const res = await d1
          .prepare('SELECT * FROM admin_activities ORDER BY timestamp DESC LIMIT ?')
          .bind(limit)
          .all<any>();

        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((r) => ({
            id: r.id,
            adminId: r.admin_id,
            adminName: r.admin_name,
            action: r.action,
            entityType: r.entity_type,
            entityReference: r.entity_reference,
            details: r.details,
            timestamp: r.timestamp,
          }));
        }
      } catch (err) {
        console.warn('D1 getActivities error:', err);
      }
    }

    return this.memData.activities.slice(0, limit);
  }

  public async logWebhook(
    entry: Omit<WebhookLog, 'id' | 'timestamp'>,
    d1?: D1DatabaseBinding
  ) {
    const id = `whk-${generateRandomHex(4)}`;
    const timestamp = new Date().toISOString();
    const log: WebhookLog = {
      ...entry,
      id,
      timestamp,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO webhook_logs (id, bill_id, internal_ref, status, signature_verified, payload_summary, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            log.billId,
            log.internalRef,
            log.status,
            log.signatureVerified ? 1 : 0,
            log.payloadSummary,
            timestamp
          )
          .run();
      } catch (err) {
        console.warn('D1 logWebhook error:', err);
      }
    }

    this.memData.webhookLogs.unshift(log);
    if (this.memData.webhookLogs.length > 100) {
      this.memData.webhookLogs = this.memData.webhookLogs.slice(0, 100);
    }
  }

  public async getWebhookLogs(limit: number = 20, d1?: D1DatabaseBinding): Promise<WebhookLog[]> {
    if (d1) {
      try {
        const res = await d1
          .prepare('SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT ?')
          .bind(limit)
          .all<any>();

        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((r) => ({
            id: r.id,
            billId: r.bill_id,
            internalRef: r.internal_ref,
            status: r.status,
            signatureVerified: Boolean(r.signature_verified),
            payloadSummary: r.payload_summary,
            timestamp: r.timestamp,
          }));
        }
      } catch (err) {
        console.warn('D1 getWebhookLogs error:', err);
      }
    }

    return this.memData.webhookLogs.slice(0, limit);
  }
}

export const db = new Database();
