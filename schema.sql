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
  5000000, 15000, 7420, 56, 'active',
  'Pulau Lang Tengah & Terengganu Marine Sanctuary, Malaysia',
  '[{"id":"ms-coralku-1","title":"Phase 1: Shallow Reef Nursery Foundation (Summer Bay, Pulau Lang Tengah)","targetSen":1500000,"coralCount":3500,"description":"Deployed initial 50 modular nursery spider tables and citizen restoration plots, establishing baseline thermal monitoring.","achieved":true},{"id":"ms-coralku-2","title":"Phase 2: Coral Clips Substrate Deployment (7,000+ Corals Secured)","targetSen":2500000,"coralCount":7000,"description":"Introduced eco-friendly spring-steel Coral Clips in collaboration with Australian marine biologists, achieving an 80% 6-month survival rate.","achieved":true},{"id":"ms-coralku-3","title":"Phase 3: Landmark Multi-Species Coral Spawning Documented","targetSen":3500000,"coralCount":9500,"description":"Documented 8 distinct restored coral species reaching sexual maturity and spawning simultaneously in the wild, enabling natural larval replenishment.","achieved":true},{"id":"ms-coralku-4","title":"Phase 4: Project ASSIST — \"Super Corals\" & Deep Nursery Expansion","targetSen":5000000,"coralCount":15000,"description":"Pioneered Malaysia’s largest deep-water nursery (12m depth) to cultivate heat-tolerant super-corals, shielding colonies from severe marine bleaching.","achieved":false},{"id":"ms-coralku-5","title":"Phase 5: 20,000+ Outplants & Marine Sanctuary Ranger Training","targetSen":7500000,"coralCount":20000,"description":"Scale outplanting to exceed 20,000 verified colonies with >72% long-term survival, funding local island youth conservation rangers.","achieved":false}]',
  '2026-08-01T08:00:00.000Z', '2026-10-19T08:30:00.000Z'
);

INSERT OR IGNORE INTO campaign_updates (
  id, title, slug, description, image_url, category, publication_status, publication_date, created_at, updated_at
) VALUES 
(
  'upd-coralku-1',
  'Historic Milestone: 8 Restored Coral Species Spawn in Lang Tengah Garden',
  'historic-coral-spawning-lang-tengah',
  'During our seasonal night dive survey at Summer Bay, marine biologists documented a historic triumph: 8 transplanted coral species spawned simultaneously, releasing viable egg-and-sperm bundles into the ocean currents. This proves outplanted corals have reached reproductive maturity, triggering self-sustaining larval recruitment across Terengganu waters.',
  '/src/assets/images/coral_spawning_night_1792398688907.jpg',
  'milestone',
  'published',
  '2026-09-24T21:40:00.000Z',
  '2026-09-24T21:40:00.000Z',
  '2026-09-24T21:40:00.000Z'
),
(
  'upd-coralku-2',
  'Project ASSIST: Deep-Water Nurseries Shield "Super Corals" from Bleaching Spike',
  'project-assist-deep-water-nurseries',
  'Coralku’s pioneering Project ASSIST cultivates heat-resilient "super corals" in Malaysia’s largest deep-water nursery at 12m depth. Positioning nursery frames below shallow surface thermal layers shielded our colonies from light and heat stress, achieving an outstanding >80% survival rate throughout the recent severe El Niño bleaching event.',
  '/src/assets/images/coral_fragment_nursery_1792397670199.jpg',
  'biodiversity',
  'published',
  '2026-10-06T11:15:00.000Z',
  '2026-10-06T11:15:00.000Z',
  '2026-10-06T11:15:00.000Z'
),
(
  'upd-coralku-3',
  'Coral Clips Innovation: Over 7,000 Fragments Secured to Natural Substrate',
  'coral-clips-innovation-deployment',
  'In collaboration with Australian marine researchers, Coralku introduced spring-steel Coral Clips to anchor loose coral fragments directly to solid limestone substrate without toxic chemical adhesives or single-use plastic zip ties. Over 7,000 corals have benefited to date, exhibiting rapid skeletal encrustation.',
  '/src/assets/images/coral_clips_substrate_1792398689267.jpg',
  'volunteer',
  'published',
  '2026-10-14T14:30:00.000Z',
  '2026-10-14T14:30:00.000Z',
  '2026-10-14T14:30:00.000Z'
),
(
  'upd-coralku-4',
  'Citizen Restoration: 331 Corals Planted onto 20 Frames with Youth Divers',
  'citizen-restoration-youth-divers-expedition',
  'Leo-Lion Club of KL Solaris youth divers joined Coralku marine scientists for a two-day hands-on field workshop. 331 healthy fragments were tagged and attached onto 20 spider frames. Subsequent 6-month benthic photogrammetry confirms rapid tissue fusion and healthy damselfish repopulation.',
  '/src/assets/images/volunteer_divers_restoration_1792397671746.jpg',
  'volunteer',
  'published',
  '2026-10-18T16:00:00.000Z',
  '2026-10-18T16:00:00.000Z',
  '2026-10-18T16:00:00.000Z'
);

-- Seed verified initial donor records for campaign impact display
INSERT OR IGNORE INTO donations (
  id, internal_reference, campaign_id, donor_name, donor_email,
  amount_sen, currency, attribution_preference, message,
  billplz_bill_id, billplz_url, payment_status, paid_at, created_at, updated_at
) VALUES 
('don-1', 'SOL-202609-8472', 'solaris-reef-2026', 'Tan Sri Jeffrey Lim', 'jeffrey.lim@example.com', 500000, 'MYR', 'public', 'Proud to support KL Solaris youth on this vital marine mission!', 'bpz_seed_101', NULL, 'paid', '2026-09-12T10:14:22.000Z', '2026-09-12T10:12:00.000Z', '2026-09-12T10:14:22.000Z'),
('don-2', 'SOL-202609-9134', 'solaris-reef-2026', 'Nurul Aisyah & Family', 'aisyah.m@example.my', 100000, 'MYR', 'public', 'For future generations of Malaysian divers and children.', 'bpz_seed_102', NULL, 'paid', '2026-09-20T16:45:00.000Z', '2026-09-20T16:43:00.000Z', '2026-09-20T16:45:00.000Z'),
('don-3', 'SOL-202610-1082', 'solaris-reef-2026', 'Anonymous Supporter', 'supporter@secret.my', 25000, 'MYR', 'anonymous', 'Every fragment matters.', 'bpz_seed_103', NULL, 'paid', '2026-10-04T08:22:15.000Z', '2026-10-04T08:20:00.000Z', '2026-10-04T08:22:15.000Z'),
('don-4', 'SOL-202610-2391', 'solaris-reef-2026', 'Dr. Ramesh Kumar', 'ramesh.kumar@example.com', 50000, 'MYR', 'public', 'Keep planting corals! Great work team.', 'bpz_seed_104', NULL, 'paid', '2026-10-08T19:05:40.000Z', '2026-10-08T19:02:00.000Z', '2026-10-08T19:05:40.000Z'),
('don-5', 'SOL-202610-3945', 'solaris-reef-2026', 'Chloe Wong', 'chloe.wong@example.com', 10000, 'MYR', 'public', 'Planted 10 fragments with love 🪸', 'bpz_seed_105', NULL, 'paid', '2026-10-14T12:30:10.000Z', '2026-10-14T12:28:00.000Z', '2026-10-14T12:30:10.000Z'),
('don-6', 'SOL-202610-4109', 'solaris-reef-2026', 'Leo Club Solaris Alumni', 'alumni@leolion-solaris.org', 1500000, 'MYR', 'public', 'Youth leadership in conservation!', 'bpz_seed_106', NULL, 'paid', '2026-10-16T15:20:00.000Z', '2026-10-16T15:18:00.000Z', '2026-10-16T15:20:00.000Z');
