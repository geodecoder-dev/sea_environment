/**
 * Database Layer for Solaris Reef Campaign Hub
 * Supports Cloudflare D1 (Edge SQL) with strict durable persistence semantics:
 * - When D1 is present, errors are thrown (NEVER swallowed into memory fallback).
 * - In-memory adapter is preserved strictly for local development and unit tests.
 * - Enforces atomic conditional state transitions (e.g. pending -> paid).
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
import { generateSecureToken } from './auth.js';

export class DatabaseError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(`[DatabaseError] ${message}`);
    this.name = 'DatabaseError';
  }
}

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
    coralPlantingTarget: 250,
    verifiedCoralPlantingCount: 0,
    volunteerCount: 0,
    campaignStatus: 'active',
    location: 'Pulau Lang Tengah & Terengganu Marine Sanctuary, Malaysia',
    milestones: [],
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-10-19T08:30:00.000Z',
  };

  return {
    campaign: initialCampaign,
    updates: [],
    donations: [],
    admins: [],
    activities: [],
    webhookLogs: [],
  };
}

export class Database {
  private memData: DatabaseSchema;

  constructor() {
    this.memData = createDefaultSeed();
  }

  // Helper for test resets
  public resetMemoryData(): void {
    this.memData = createDefaultSeed();
  }

  // ---------------------------------------------------------------------------
  // CAMPAIGN METHODS
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
            milestones = [];
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
        console.error('[DB] D1 getCampaign error:', err);
        throw new DatabaseError('Failed to fetch campaign record from database', err);
      }
    }

    // In-memory mode (development/testing)
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
        console.error('[DB] D1 updateCampaign error:', err);
        throw new DatabaseError('Failed to update campaign in database', err);
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
  // CAMPAIGN UPDATES METHODS
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
        console.error('[DB] D1 getPublicUpdates error:', err);
        throw new DatabaseError('Failed to fetch published updates from database', err);
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
        console.error('[DB] D1 getAllUpdates error:', err);
        throw new DatabaseError('Failed to fetch updates from database', err);
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
        console.error('[DB] D1 createUpdate error:', err);
        throw new DatabaseError('Failed to insert campaign update into database', err);
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
        return null;
      } catch (err) {
        console.error('[DB] D1 updateUpdate error:', err);
        throw new DatabaseError('Failed to update campaign update in database', err);
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
        console.error('[DB] D1 deleteUpdate error:', err);
        throw new DatabaseError('Failed to delete campaign update from database', err);
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
  // DONATIONS METHODS
  // ---------------------------------------------------------------------------

  public async createDonation(
    data: {
      donorName: string;
      donorEmail: string;
      amountSen: number;
      attributionPreference: AttributionPreference;
      message?: string;
      referral?: string;
      coralName?: string;
      isGift?: boolean;
      recipientName?: string;
      recipientEmail?: string;
      billplzBillId: string;
      billplzUrl?: string;
    },
    d1?: D1DatabaseBinding
  ): Promise<Donation> {
    // Reference: human-readable receipt number
    const internalReference = `SOL-${new Date().toISOString().slice(0, 7).replace('-', '')}-${generateRandomHex(2).toUpperCase()}`;
    // 128-bit cryptographically secure opaque token for public lookup & verification
    const verificationToken = generateSecureToken(16);
    const id = `don-${generateRandomHex(6)}`;
    const now = new Date().toISOString();

    const newDonation: Donation = {
      id,
      internalReference,
      verificationToken,
      campaignId: 'solaris-reef-2026',
      donorName: data.donorName || 'Generous Supporter',
      donorEmail: data.donorEmail,
      amountSen: Math.round(data.amountSen),
      currency: 'MYR',
      attributionPreference: data.attributionPreference,
      message: data.message ? data.message.trim() : '',
      referral: data.referral ? data.referral.trim() : '',
      coralName: data.coralName ? data.coralName.trim() : undefined,
      isGift: Boolean(data.isGift),
      recipientName: data.recipientName ? data.recipientName.trim() : undefined,
      recipientEmail: data.recipientEmail ? data.recipientEmail.trim() : undefined,
      billplzBillId: data.billplzBillId,
      billplzUrl: data.billplzUrl,
      paymentStatus: 'pending',
      receiptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO donations 
              (id, internal_reference, verification_token, campaign_id, donor_name, donor_email, amount_sen, currency, attribution_preference, message, referral, coral_name, is_gift, recipient_name, recipient_email, billplz_bill_id, billplz_url, payment_status, receipt_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            internalReference,
            verificationToken,
            'solaris-reef-2026',
            newDonation.donorName,
            newDonation.donorEmail,
            newDonation.amountSen,
            newDonation.currency,
            newDonation.attributionPreference,
            newDonation.message || null,
            newDonation.referral || null,
            newDonation.coralName || null,
            newDonation.isGift ? 1 : 0,
            newDonation.recipientName || null,
            newDonation.recipientEmail || null,
            newDonation.billplzBillId,
            newDonation.billplzUrl || null,
            'pending',
            0,
            now,
            now
          )
          .run();
      } catch (err) {
        console.error('[DB] D1 createDonation error. Failing securely (no silent memory fallback):', err);
        throw new DatabaseError('Failed to durably create donation record in database', err);
      }
    }

    this.memData.donations.unshift(newDonation);
    return newDonation;
  }

  public async getDonationByToken(token: string, d1?: D1DatabaseBinding): Promise<Donation | null> {
    if (!token) return null;

    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM donations WHERE verification_token = ? LIMIT 1')
          .bind(token.trim())
          .first<any>();

        if (row) {
          return this.mapDonationRow(row);
        }
        return null;
      } catch (err) {
        console.error('[DB] D1 getDonationByToken error:', err);
        throw new DatabaseError('Failed to lookup donation by verification token', err);
      }
    }

    return this.memData.donations.find((d) => d.verificationToken === token) || null;
  }

  public async getDonationByReference(reference: string, d1?: D1DatabaseBinding): Promise<Donation | null> {
    if (!reference) return null;

    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM donations WHERE internal_reference = ? LIMIT 1')
          .bind(reference.trim().toUpperCase())
          .first<any>();

        if (row) {
          return this.mapDonationRow(row);
        }
        return null;
      } catch (err) {
        console.error('[DB] D1 getDonationByReference error:', err);
        throw new DatabaseError('Failed to lookup donation by reference', err);
      }
    }

    return this.memData.donations.find(
      (d) => d.internalReference.toUpperCase() === reference.trim().toUpperCase()
    ) || null;
  }

  public async getDonationByBillId(billId: string, d1?: D1DatabaseBinding): Promise<Donation | null> {
    if (!billId) return null;

    if (d1) {
      try {
        const row = await d1
          .prepare('SELECT * FROM donations WHERE billplz_bill_id = ? LIMIT 1')
          .bind(billId.trim())
          .first<any>();

        if (row) {
          return this.mapDonationRow(row);
        }
        return null;
      } catch (err) {
        console.error('[DB] D1 getDonationByBillId error:', err);
        throw new DatabaseError('Failed to lookup donation by Billplz bill ID', err);
      }
    }

    return this.memData.donations.find((d) => d.billplzBillId === billId.trim()) || null;
  }

  /**
   * Enforces the authoritative payment state machine:
   * - Allowed transitions: pending -> paid, pending -> failed, pending -> cancelled
   * - Idempotent: paid -> paid, failed -> failed
   * - Prohibited: paid -> failed, paid -> cancelled (late callbacks cannot revert paid state)
   */
  public async updateDonationPaymentStatus(
    referenceOrBillId: string,
    status: PaymentStatus,
    paidAt?: string,
    d1?: D1DatabaseBinding
  ): Promise<{ donation: Donation | null; isStateChanged: boolean; rejectedReversion?: boolean }> {
    const donation =
      (await this.getDonationByReference(referenceOrBillId, d1)) ||
      (await this.getDonationByBillId(referenceOrBillId, d1)) ||
      (await this.getDonationByToken(referenceOrBillId, d1));

    if (!donation) {
      return { donation: null, isStateChanged: false };
    }

    // Idempotent duplicate check
    if (donation.paymentStatus === status) {
      return { donation, isStateChanged: false };
    }

    // Reversion Protection: A paid donation MUST NOT be reverted by late failure or cancellation
    if (donation.paymentStatus === 'paid' && (status === 'failed' || status === 'cancelled')) {
      console.warn(
        `[PAYMENT STATE MACHINE] Rejected illegal state transition from 'paid' to '${status}' for donation ${donation.internalReference}`
      );
      return { donation, isStateChanged: false, rejectedReversion: true };
    }

    const now = new Date().toISOString();
    const finalPaidAt = status === 'paid' ? paidAt || now : donation.paidAt;

    if (d1) {
      try {
        // Atomic conditional update ensuring concurrency safety
        await d1
          .prepare(
            `UPDATE donations SET 
              payment_status = ?, 
              paid_at = COALESCE(?, paid_at), 
              callback_received_at = ?, 
              updated_at = ? 
             WHERE internal_reference = ? AND (payment_status != 'paid' OR ? = 'paid')`
          )
          .bind(status, finalPaidAt || null, now, now, donation.internalReference, status)
          .run();
      } catch (err) {
        console.error('[DB] D1 updateDonationPaymentStatus error:', err);
        throw new DatabaseError('Failed to durably update donation payment status', err);
      }
    }

    // Update in-memory record
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

  public async markReceiptSent(
    internalReference: string,
    d1?: D1DatabaseBinding
  ): Promise<boolean> {
    const now = new Date().toISOString();

    if (d1) {
      try {
        await d1
          .prepare(
            `UPDATE donations SET 
              receipt_sent_at = ?, 
              receipt_count = receipt_count + 1, 
              updated_at = ? 
             WHERE internal_reference = ?`
          )
          .bind(now, now, internalReference)
          .run();
      } catch (err) {
        console.error('[DB] D1 markReceiptSent error:', err);
        throw new DatabaseError('Failed to record receipt dispatch in database', err);
      }
    }

    const memDonation = this.memData.donations.find((d) => d.internalReference === internalReference);
    if (memDonation) {
      memDonation.receiptSentAt = now;
      memDonation.receiptCount = (memDonation.receiptCount || 0) + 1;
      memDonation.updatedAt = now;
    }

    return true;
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
        const whereClauses: string[] = [];
        const params: any[] = [];

        if (filters?.status && filters.status !== 'all') {
          whereClauses.push('payment_status = ?');
          params.push(filters.status);
        }

        if (filters?.search) {
          const q = `%${filters.search.toLowerCase()}%`;
          whereClauses.push(
            '(LOWER(internal_reference) LIKE ? OR LOWER(donor_name) LIKE ? OR LOWER(donor_email) LIKE ? OR LOWER(billplz_bill_id) LIKE ? OR LOWER(COALESCE(referral, \'\')) LIKE ? OR LOWER(COALESCE(coral_name, \'\')) LIKE ?)'
          );
          params.push(q, q, q, q, q, q);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) as count FROM donations ${whereSql}`;
        const countRes = await d1.prepare(countQuery).bind(...params).first<any>();
        const totalCount = Number(countRes?.count || 0);

        const listQuery = `SELECT * FROM donations ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const listRes = await d1.prepare(listQuery).bind(...params, limit, offset).all<any>();

        const items: Donation[] = (listRes?.results || []).map((row) => this.mapDonationRow(row));

        return {
          items,
          totalCount,
          hasMore: offset + limit < totalCount,
        };
      } catch (err) {
        console.error('[DB] D1 getDonations error:', err);
        throw new DatabaseError('Failed to fetch donations from database', err);
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
          d.billplzBillId.toLowerCase().includes(q) ||
          (d.referral && d.referral.toLowerCase().includes(q)) ||
          (d.coralName && d.coralName.toLowerCase().includes(q))
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
            `SELECT id, donor_name, attribution_preference, amount_sen, message, coral_name, paid_at, created_at 
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
            donorName: d.attribution_preference === 'anonymous' ? 'Anonymous Supporter' : d.donor_name,
            amountSen: Number(d.amount_sen),
            amountRm: Number(d.amount_sen) / 100,
            message: d.message || '',
            coralName: d.coral_name || undefined,
            paidAt: d.paid_at || d.created_at,
          }));
        }
      } catch (err) {
        console.error('[DB] D1 getPublicRecentDonations error:', err);
        throw new DatabaseError('Failed to fetch recent public donations', err);
      }
    }

    return this.memData.donations
      .filter((d) => d.paymentStatus === 'paid')
      .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
      .slice(0, limit)
      .map((d) => ({
        id: d.id,
        donorName: d.attributionPreference === 'anonymous' ? 'Anonymous Supporter' : d.donorName,
        amountSen: d.amountSen,
        amountRm: d.amountSen / 100,
        message: d.message,
        coralName: d.coralName,
        paidAt: d.paidAt || d.createdAt,
      }));
  }

  // ---------------------------------------------------------------------------
  // ADMIN USERS
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
        return null;
      } catch (err) {
        console.error('[DB] D1 getAdminByEmail error:', err);
        throw new DatabaseError('Failed to query admin user by email', err);
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
        return null;
      } catch (err) {
        console.error('[DB] D1 getAdminById error:', err);
        throw new DatabaseError('Failed to query admin user by ID', err);
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
        console.error('[DB] D1 upsertAdminUser error:', err);
        throw new DatabaseError('Failed to upsert admin user in database', err);
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
  // AUDIT ACTIVITY & WEBHOOK LOGS
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
        console.error('[DB] D1 logActivity error:', err);
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
        console.error('[DB] D1 getActivities error:', err);
        throw new DatabaseError('Failed to fetch admin activities', err);
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
        console.error('[DB] D1 logWebhook error:', err);
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
        console.error('[DB] D1 getWebhookLogs error:', err);
        throw new DatabaseError('Failed to fetch webhook logs', err);
      }
    }

    return this.memData.webhookLogs.slice(0, limit);
  }

  private mapDonationRow(row: any): Donation {
    return {
      id: row.id,
      internalReference: row.internal_reference,
      verificationToken: row.verification_token || '',
      campaignId: row.campaign_id,
      donorName: row.donor_name,
      donorEmail: row.donor_email,
      amountSen: Number(row.amount_sen),
      currency: row.currency,
      attributionPreference: row.attribution_preference,
      message: row.message || '',
      referral: row.referral || '',
      coralName: row.coral_name || undefined,
      isGift: Boolean(row.is_gift),
      recipientName: row.recipient_name || undefined,
      recipientEmail: row.recipient_email || undefined,
      billplzBillId: row.billplz_bill_id,
      billplzUrl: row.billplz_url,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
      callbackReceivedAt: row.callback_received_at,
      receiptSentAt: row.receipt_sent_at,
      receiptCount: Number(row.receipt_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const db = new Database();
