-- Migration 002: Add verification_token, gift donation attributes, and receipt tracking to donations table
-- For Cloudflare D1: npx wrangler d1 execute solaris-reef-db --file=./scripts/002_security_and_gift_schema.sql

ALTER TABLE donations ADD COLUMN verification_token TEXT;
ALTER TABLE donations ADD COLUMN coral_name TEXT;
ALTER TABLE donations ADD COLUMN is_gift INTEGER NOT NULL DEFAULT 0;
ALTER TABLE donations ADD COLUMN recipient_name TEXT;
ALTER TABLE donations ADD COLUMN recipient_email TEXT;
ALTER TABLE donations ADD COLUMN receipt_sent_at TEXT;
ALTER TABLE donations ADD COLUMN receipt_count INTEGER NOT NULL DEFAULT 0;

-- Backfill verification_token with unique values for any pre-existing rows
UPDATE donations 
SET verification_token = lower(hex(randomblob(16)))
WHERE verification_token IS NULL OR verification_token = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_token ON donations(verification_token);
