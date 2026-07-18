-- Migration script: Add is_archived to clinics table
-- This adds the necessary columns to track whether a clinic has been archived.

BEGIN;

-- Add is_archived column
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL;

-- Optional: Add an index for faster filtering of archived clinics
CREATE INDEX IF NOT EXISTS idx_clinics_is_archived ON clinics(is_archived);

COMMIT;
