/**
 * Database Layer for Solaris Reef Campaign Hub
 * Supports Cloudflare D1 (Edge SQL) with strict durable persistence semantics:
 * - When D1 is present, errors are thrown (NEVER swallowed into memory fallback).
 * - In-memory adapter is preserved strictly for local development and unit tests.
 * - Enforces atomic conditional state transitions (e.g. pending -> paid).
 */

import type {
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
import { calculateEntitlementsFromSen } from './services/pricing.js';

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
    fundraisingTargetSen: 5000000, // RM 50,000.00 (matches the production schema seed)
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
