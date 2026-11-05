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
  verification_token TEXT UNIQUE NOT NULL,
  campaign_id TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  amount_sen INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  attribution_preference TEXT NOT NULL DEFAULT 'public',
  message TEXT,
  referral TEXT,
  coral_name TEXT,
  is_gift INTEGER NOT NULL DEFAULT 0,
  recipient_name TEXT,
  recipient_email TEXT,
  billplz_bill_id TEXT NOT NULL,
  billplz_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  callback_received_at TEXT,
  receipt_sent_at TEXT,
  receipt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX IF NOT EXISTS idx_donations_ref ON donations(internal_reference);
CREATE INDEX IF NOT EXISTS idx_donations_token ON donations(verification_token);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_campaign_status ON donations(campaign_id, payment_status);
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
