-- =============================================================================
-- Cloudflare D1 Database Schema: Solaris Reef Campaign Hub
-- Apply with: npx wrangler d1 execute solaris-reef-db --file=./schema.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  fundraising_target_sen INTEGER NOT NULL,
  coral_planting_target INTEGER NOT NULL,
  verified_coral_planting_count INTEGER NOT NULL,
  volunteer_count INTEGER NOT NULL,
  campaign_status TEXT NOT NULL DEFAULT 'active',
  location TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  internal_reference TEXT UNIQUE NOT NULL,
  campaign_id TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  amount_sen INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  attribution_preference TEXT NOT NULL DEFAULT 'public',
  message TEXT,
  billplz_bill_id TEXT NOT NULL,
  billplz_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX IF NOT EXISTS idx_donations_ref ON donations(internal_reference);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_bill_id ON donations(billplz_bill_id);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_activities (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_reference TEXT,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  internal_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  signature_verified INTEGER NOT NULL,
  payload_summary TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- Seed Initial Campaign
INSERT OR IGNORE INTO campaigns (
  id, title, slug, description,
  fundraising_target_sen, coral_planting_target, verified_coral_planting_count,
  volunteer_count, campaign_status, location, created_at, updated_at
) VALUES (
  'solaris-reef-2026',
  'Solaris Reef: Coralku Community Restoration Initiative',
  'solaris-reef',
  'In scientific partnership with Coralku and local marine researchers, Leo-Lion Club of KL Solaris accelerates resilience-based reef restoration at Pulau Lang Tengah and Peninsular marine parks.',
  5000000, 15000, 7420, 56, 'active',
  'Pulau Lang Tengah & Terengganu Marine Sanctuary, Malaysia',
  '2026-08-01T08:00:00.000Z', '2026-10-19T08:30:00.000Z'
);

-- Seed Initial Admin User (admin@leolion-solaris.org / SolarisReef2026!)
INSERT OR IGNORE INTO admin_users (
  id, name, email, password_hash, salt, role, created_at, updated_at
) VALUES (
  'admin-1',
  'KL Solaris Club Administrator',
  'admin@leolion-solaris.org',
  'a6a16ca40131102ef1e6878b2d184ee49ef70f5e1f07daeb0a0fead3fce7be5e5257a3e8783e789ec3b5e40733d062828b6d80ff3d5e2195f039a06653dfbcf3',
  '79c1cb9d029519cebe7a875880dae480',
  'superadmin',
  '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z'
);
