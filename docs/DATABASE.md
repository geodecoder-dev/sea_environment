# Database Schema & Migrations — Cloudflare D1

## 1. Cloudflare D1 Architecture

The primary database is **Cloudflare D1**, an edge-distributed relational SQL database powered by SQLite.

### Database Tables

### 1. `campaigns`
Stores campaign milestones, target funding, planting goals, and narrative.
- `id` (TEXT PRIMARY KEY)
- `title` (TEXT NOT NULL)
- `slug` (TEXT NOT NULL)
- `description` (TEXT NOT NULL)
- `fundraising_target_sen` (INTEGER NOT NULL)
- `coral_planting_target` (INTEGER NOT NULL)
- `verified_coral_planting_count` (INTEGER NOT NULL)
- `volunteer_count` (INTEGER NOT NULL)
- `campaign_status` (TEXT NOT NULL DEFAULT 'active')
- `location` (TEXT NOT NULL)
- `milestones_json` (TEXT NOT NULL DEFAULT '[]')
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### 2. `donations`
Main transactions and donor attribution ledger.
- `id` (TEXT PRIMARY KEY)
- `internal_reference` (TEXT UNIQUE NOT NULL) — e.g. `SOL-202610-A1B2`
- `verification_token` (TEXT UNIQUE NOT NULL) — 128-bit cryptographically secure lookup token
- `campaign_id` (TEXT NOT NULL)
- `donor_name` (TEXT NOT NULL)
- `donor_email` (TEXT NOT NULL)
- `amount_sen` (INTEGER NOT NULL) — Smallest currency unit (sen)
- `currency` (TEXT NOT NULL DEFAULT 'MYR')
- `attribution_preference` (TEXT NOT NULL DEFAULT 'public') — `public` or `anonymous`
- `message` (TEXT)
- `referral` (TEXT) — Referral code or affiliate attribution
- `coral_name` (TEXT) — Custom name for adopted coral
- `is_gift` (INTEGER NOT NULL DEFAULT 0) — 1 if dedicated as a gift, 0 otherwise
- `recipient_name` (TEXT) — Name of gift recipient
- `recipient_email` (TEXT) — Email of gift recipient
- `billplz_bill_id` (TEXT NOT NULL) — Gateway reference
- `billplz_url` (TEXT)
- `payment_status` (TEXT NOT NULL DEFAULT 'pending') — `pending`, `paid`, `failed`, `cancelled`
- `paid_at` (TEXT)
- `callback_received_at` (TEXT)
- `receipt_sent_at` (TEXT)
- `receipt_count` (INTEGER NOT NULL DEFAULT 0)
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### 3. `campaign_updates`
Field reports, dive logs, and photogrammetric growth milestones.
- `id` (TEXT PRIMARY KEY)
- `title` (TEXT NOT NULL)
- `slug` (TEXT NOT NULL)
- `description` (TEXT NOT NULL)
- `image_url` (TEXT)
- `category` (TEXT NOT NULL)
- `publication_status` (TEXT NOT NULL DEFAULT 'published')
- `publication_date` (TEXT NOT NULL)
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### 4. `admin_users`
Administrator account hashes.
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `email` (TEXT UNIQUE NOT NULL)
- `password_hash` (TEXT NOT NULL) — PBKDF2 SHA-256
- `salt` (TEXT NOT NULL) — 128-bit hex salt
- `role` (TEXT NOT NULL DEFAULT 'admin')
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### 5. `admin_activities`
Immutable operational audit trail.
- `id` (TEXT PRIMARY KEY)
- `admin_id` (TEXT NOT NULL)
- `admin_name` (TEXT NOT NULL)
- `action` (TEXT NOT NULL)
- `entity_type` (TEXT NOT NULL)
- `entity_reference` (TEXT)
- `details` (TEXT NOT NULL)
- `timestamp` (TEXT NOT NULL)

### 6. `webhook_logs`
Cryptographic payment callback audit trail.
- `id` (TEXT PRIMARY KEY)
- `bill_id` (TEXT NOT NULL)
- `internal_ref` (TEXT NOT NULL)
- `status` (TEXT NOT NULL)
- `signature_verified` (INTEGER NOT NULL)
- `payload_summary` (TEXT NOT NULL)
- `timestamp` (TEXT NOT NULL)

---

## 2. Running Migrations

### Initializing Database Schema (Fresh Setup)
```bash
# Cloudflare Production D1
npx wrangler d1 execute solaris-reef-db --file=./schema.sql

# Local Wrangler D1
npx wrangler d1 execute solaris-reef-db --local --file=./schema.sql
```

### Applying Migration 002 (Security, Verification Tokens & Gift Attributes)
```bash
# Production
npx wrangler d1 execute solaris-reef-db --file=./scripts/002_security_and_gift_schema.sql

# Local
npx wrangler d1 execute solaris-reef-db --local --file=./scripts/002_security_and_gift_schema.sql
```
