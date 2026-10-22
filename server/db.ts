import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists if filesystem is accessible (Node.js/local dev)
try {
  if (typeof fs !== 'undefined' && typeof fs.existsSync === 'function' && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // Running in Cloudflare Workers / Edge runtime where fs is not writable
}

function hashPasswordWithSalt(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function createDefaultSeed(): DatabaseSchema {
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'SolarisReef2026!';
  const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@leolion-solaris.org';
  const adminHash = hashPasswordWithSalt(defaultAdminPassword, adminSalt);

  const initialCampaign: Campaign = {
    id: 'solaris-reef-2026',
    title: 'Solaris Reef: Coralku Community Restoration Initiative',
    slug: 'solaris-reef',
    description:
      'In scientific partnership with Coralku and local marine researchers, Leo-Lion Club of KL Solaris accelerates resilience-based reef restoration at Pulau Lang Tengah and Peninsular marine parks. Utilizing Coral Clips technology, deep-water nurseries, and Project ASSIST super-corals, we restore depleted reefs into self-sustaining, naturally spawning ecosystems.',
    fundraisingTargetSen: 5000000, // RM 50,000.00
    coralPlantingTarget: 15000,    // Scaled with Coralku target
    verifiedCoralPlantingCount: 7420, // Coralku verified corals planted & clipped
    volunteerCount: 56,
    campaignStatus: 'active',
    location: 'Pulau Lang Tengah & Terengganu Marine Sanctuary, Malaysia',
    milestones: [
      {
        id: 'ms-coralku-1',
        title: 'Phase 1: Shallow Reef Nursery Foundation (Summer Bay, Pulau Lang Tengah)',
        targetSen: 1500000, // RM 15,000
        coralCount: 3500,
        description: 'Deployed initial 50 modular nursery spider tables and citizen restoration plots, establishing baseline thermal monitoring.',
        achieved: true,
      },
      {
        id: 'ms-coralku-2',
        title: 'Phase 2: Coral Clips Substrate Deployment (7,000+ Corals Secured)',
        targetSen: 2500000, // RM 25,000
        coralCount: 7000,
        description: 'Introduced eco-friendly spring-steel Coral Clips in collaboration with Australian marine biologists, achieving an 80% 6-month survival rate.',
        achieved: true,
      },
      {
        id: 'ms-coralku-3',
        title: 'Phase 3: Landmark Multi-Species Coral Spawning Documented',
        targetSen: 3500000, // RM 35,000
        coralCount: 9500,
        description: 'Documented 8 distinct restored coral species reaching sexual maturity and spawning simultaneously in the wild, enabling natural larval replenishment.',
        achieved: true,
      },
      {
        id: 'ms-coralku-4',
        title: 'Phase 4: Project ASSIST — "Super Corals" & Deep Nursery Expansion',
        targetSen: 5000000, // RM 50,000
        coralCount: 15000,
        description: 'Pioneered Malaysia’s largest deep-water nursery (12m depth) to cultivate heat-tolerant super-corals, shielding colonies from severe marine bleaching.',
        achieved: false,
      },
      {
        id: 'ms-coralku-5',
        title: 'Phase 5: 20,000+ Outplants & Marine Sanctuary Ranger Training',
        targetSen: 7500000, // RM 75,000
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
      amountSen: 500000, // RM 5,000.00
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
      amountSen: 100000, // RM 1,000.00
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
      amountSen: 25000, // RM 250.00
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
      amountSen: 50000, // RM 500.00
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
      amountSen: 10000, // RM 100.00
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
      amountSen: 1500000, // RM 15,000.00
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

  const initialAdmins: AdminUser[] = [
    {
      id: 'admin-1',
      name: 'KL Solaris Club Administrator',
      email: defaultAdminEmail,
      passwordHash: adminHash,
      salt: adminSalt,
      role: 'superadmin',
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-01T08:00:00.000Z',
    },
  ];

  const initialActivities: AdminActivity[] = [
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
    {
      id: 'act-2',
      adminId: 'admin-1',
      adminName: 'KL Solaris Club Administrator',
      action: 'UPDATE_PUBLISHED',
      entityType: 'update',
      entityReference: 'upd-1',
      details: 'Published Phase 1 nursery deployment update.',
      timestamp: '2026-09-18T09:00:00.000Z',
    },
  ];

  return {
    campaign: initialCampaign,
    updates: initialUpdates,
    donations: initialDonations,
    admins: initialAdmins,
    activities: initialActivities,
    webhookLogs: [],
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (typeof fs !== 'undefined' && typeof fs.existsSync === 'function' && fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (err) {
      // In-memory fallback
    }
    const seed = createDefaultSeed();
    this.saveData(seed);
    return seed;
  }

  private saveData(dataToSave?: DatabaseSchema) {
    const payload = dataToSave || this.data;
    try {
      if (typeof fs !== 'undefined' && typeof fs.writeFileSync === 'function') {
        const tempPath = `${DB_PATH}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
        fs.renameSync(tempPath, DB_PATH);
      }
    } catch {
      // Edge runtime / read-only filesystem (Cloudflare Workers)
    }
  }

  // --- Campaign Methods ---
  public getCampaign() {
    // Only verified PAID payments count towards total raised!
    const paidDonations = this.data.donations.filter((d) => d.paymentStatus === 'paid');
    const totalRaisedSen = paidDonations.reduce((sum, d) => sum + d.amountSen, 0);
    const donorCount = paidDonations.length;
    const percentAchieved = Math.min(
      100,
      Math.round((totalRaisedSen / this.data.campaign.fundraisingTargetSen) * 100)
    );

    return {
      ...this.data.campaign,
      totalRaisedSen,
      totalRaisedRm: totalRaisedSen / 100,
      fundraisingTargetRm: this.data.campaign.fundraisingTargetSen / 100,
      successfulDonationsCount: donorCount,
      percentAchieved,
    };
  }

  public updateCampaign(
    updates: Partial<Campaign>,
    adminUser: { id: string; name: string }
  ) {
    this.data.campaign = {
      ...this.data.campaign,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveData();

    this.logActivity({
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'CAMPAIGN_UPDATED',
      entityType: 'campaign',
      entityReference: this.data.campaign.id,
      details: `Updated campaign fields: ${Object.keys(updates).join(', ')}`,
    });

    return this.getCampaign();
  }

  // --- Updates Methods ---
  public getPublicUpdates(): CampaignUpdate[] {
    return this.data.updates
      .filter((u) => u.publicationStatus === 'published')
      .sort((a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime());
  }

  public getAllUpdates(): CampaignUpdate[] {
    return [...this.data.updates].sort(
      (a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime()
    );
  }

  public createUpdate(
    updateData: Omit<CampaignUpdate, 'id' | 'createdAt' | 'updatedAt'>,
    adminUser: { id: string; name: string }
  ): CampaignUpdate {
    const newUpdate: CampaignUpdate = {
      ...updateData,
      id: `upd-${crypto.randomBytes(4).toString('hex')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.updates.unshift(newUpdate);
    this.saveData();

    this.logActivity({
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'UPDATE_CREATED',
      entityType: 'update',
      entityReference: newUpdate.id,
      details: `Created campaign update "${newUpdate.title}" (${newUpdate.publicationStatus})`,
    });

    return newUpdate;
  }

  public updateUpdate(
    id: string,
    updateData: Partial<CampaignUpdate>,
    adminUser: { id: string; name: string }
  ): CampaignUpdate | null {
    const index = this.data.updates.findIndex((u) => u.id === id);
    if (index === -1) return null;

    this.data.updates[index] = {
      ...this.data.updates[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    this.saveData();

    this.logActivity({
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'UPDATE_MODIFIED',
      entityType: 'update',
      entityReference: id,
      details: `Modified campaign update "${this.data.updates[index].title}"`,
    });

    return this.data.updates[index];
  }

  public deleteUpdate(id: string, adminUser: { id: string; name: string }): boolean {
    const target = this.data.updates.find((u) => u.id === id);
    if (!target) return false;

    this.data.updates = this.data.updates.filter((u) => u.id !== id);
    this.saveData();

    this.logActivity({
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'UPDATE_DELETED',
      entityType: 'update',
      entityReference: id,
      details: `Deleted campaign update "${target.title}"`,
    });

    return true;
  }

  // --- Donations Methods ---
  public createDonation(data: {
    donorName: string;
    donorEmail: string;
    amountSen: number;
    attributionPreference: AttributionPreference;
    message?: string;
    billplzBillId: string;
    billplzUrl?: string;
  }): Donation {
    const internalReference = `SOL-${new Date().toISOString().slice(0, 7).replace('-', '')}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const newDonation: Donation = {
      id: `don-${crypto.randomBytes(6).toString('hex')}`,
      internalReference,
      campaignId: this.data.campaign.id,
      donorName: data.donorName || 'Generous Supporter',
      donorEmail: data.donorEmail,
      amountSen: Math.round(data.amountSen),
      currency: 'MYR',
      attributionPreference: data.attributionPreference,
      message: data.message || '',
      billplzBillId: data.billplzBillId,
      billplzUrl: data.billplzUrl,
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.donations.unshift(newDonation);
    this.saveData();
    return newDonation;
  }

  public getDonationByReference(reference: string): Donation | null {
    return this.data.donations.find((d) => d.internalReference === reference) || null;
  }

  public getDonationByBillId(billId: string): Donation | null {
    return this.data.donations.find((d) => d.billplzBillId === billId) || null;
  }

  /**
   * Idempotent status update:
   * Prevents repeated callbacks from falsely duplicating or altering completed transactions.
   */
  public updateDonationPaymentStatus(
    referenceOrBillId: string,
    status: PaymentStatus,
    paidAt?: string
  ): { donation: Donation | null; isStateChanged: boolean } {
    const donation = this.data.donations.find(
      (d) => d.internalReference === referenceOrBillId || d.billplzBillId === referenceOrBillId
    );

    if (!donation) {
      return { donation: null, isStateChanged: false };
    }

    // Check idempotency: if already in target state, do not overwrite or double-count
    if (donation.paymentStatus === status) {
      return { donation, isStateChanged: false };
    }

    donation.paymentStatus = status;
    donation.updatedAt = new Date().toISOString();
    donation.callbackReceivedAt = new Date().toISOString();
    if (status === 'paid') {
      donation.paidAt = paidAt || new Date().toISOString();
    }

    this.saveData();
    return { donation, isStateChanged: true };
  }

  public getDonations(filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let list = [...this.data.donations];

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

    // Sort descending by created date
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCount = list.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    const items = list.slice(offset, offset + limit);

    return {
      items,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  }

  public getPublicRecentDonations(limit: number = 8) {
    return this.data.donations
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

  // --- Admin Users ---
  public getAdminByEmail(email: string): AdminUser | null {
    return this.data.admins.find((a) => a.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public getAdminById(id: string): AdminUser | null {
    return this.data.admins.find((a) => a.id === id) || null;
  }

  // --- Activity Logging ---
  public logActivity(activity: Omit<AdminActivity, 'id' | 'timestamp'>) {
    const entry: AdminActivity = {
      ...activity,
      id: `act-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };
    this.data.activities.unshift(entry);
    // Keep max 200 activity logs
    if (this.data.activities.length > 200) {
      this.data.activities = this.data.activities.slice(0, 200);
    }
    this.saveData();
  }

  public getActivities(limit: number = 50): AdminActivity[] {
    return this.data.activities.slice(0, limit);
  }

  // --- Webhook Logs ---
  public logWebhook(entry: Omit<WebhookLog, 'id' | 'timestamp'>) {
    const log: WebhookLog = {
      ...entry,
      id: `whk-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };
    this.data.webhookLogs.unshift(log);
    if (this.data.webhookLogs.length > 100) {
      this.data.webhookLogs = this.data.webhookLogs.slice(0, 100);
    }
    this.saveData();
  }

  public getWebhookLogs(limit: number = 20): WebhookLog[] {
    return this.data.webhookLogs.slice(0, limit);
  }
}

export const db = new Database();
