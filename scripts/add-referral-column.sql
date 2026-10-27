-- Migration: Add referral column to donations table if not already present
ALTER TABLE donations ADD COLUMN referral TEXT;
