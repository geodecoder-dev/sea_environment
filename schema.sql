-- =============================================================================
-- Cloudflare D1 Database Schema: Solaris Reef Campaign Hub
-- Apply with: npx wrangler d1 execute solaris-reef-db --file=./schema.sql
-- For local dev: npx wrangler d1 execute solaris-reef-db --local --file=./schema.sql
-- =============================================================================

-- 1. Campaigns Table
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
  milestones_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Campaign Updates Feed
CREATE TABLE IF NOT EXISTS campaign_updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'milestone',
  publication_status TEXT NOT NULL DEFAULT 'published',
  publication_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaign_updates_status ON campaign_updates(publication_status);
CREATE INDEX IF NOT EXISTS idx_campaign_updates_pubdate ON campaign_updates(publication_date DESC);

-- 3. Donations Table
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
  callback_received_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX IF NOT EXISTS idx_donations_ref ON donations(internal_reference);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_bill_id ON donations(billplz_bill_id);
CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);

-- 4. Admin Users Table (Dynamic provisioning via environment secrets, no hardcoded production passwords)
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

CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(email);

-- 5. Audit Trail & Activity Logs
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

CREATE INDEX IF NOT EXISTS idx_admin_activities_time ON admin_activities(timestamp DESC);

-- 6. Webhook Logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  internal_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  signature_verified INTEGER NOT NULL,
  payload_summary TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_time ON webhook_logs(timestamp DESC);

-- =============================================================================
-- SEED DATA (Campaign & Editorial Updates)
-- Note: Admin accounts are bootstrapped safely at runtime using Cloudflare
-- Worker environment secrets (ADMIN_EMAIL / ADMIN_PASSWORD), preventing secret leaks.
-- =============================================================================

INSERT OR IGNORE INTO campaigns (
  id, title, slug, description,
  fundraising_target_sen, coral_planting_target, verified_coral_planting_count,
  volunteer_count, campaign_status, location, milestones_json, created_at, updated_at
) VALUES (
  'solaris-reef-2026',
  'Solaris Reef: Coralku Community Restoration Initiative',
  'solaris-reef',
  'In scientific partnership with Coralku and local marine researchers, Leo-Lion Club of KL Solaris accelerates resilience-based reef restoration at Pulau Lang Tengah and Peninsular marine parks. Utilizing Coral Clips technology, deep-water nurseries, and Project ASSIST super-corals, we restore depleted reefs into self-sustaining, naturally spawning ecosystems.',
  5000, 250, 0, 0, 'active',
  'Pulau Lang Tengah & Terengganu Marine Sanctuary, Malaysia',
  '[]',
  '2026-08-01T08:00:00.000Z', '2026-10-19T08:30:00.000Z'
);

