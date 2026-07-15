-- Render Database Migration Script
-- Execute this on your Render PostgreSQL database to add missing columns

-- Add clinic suspension and archival fields
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS suspended_by UUID;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS archived_by UUID;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS is_demo_clinic BOOLEAN DEFAULT FALSE;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'clinics_suspended_by_fkey'
    ) THEN
        ALTER TABLE clinics ADD CONSTRAINT clinics_suspended_by_fkey 
        FOREIGN KEY (suspended_by) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'clinics_archived_by_fkey'
    ) THEN
        ALTER TABLE clinics ADD CONSTRAINT clinics_archived_by_fkey 
        FOREIGN KEY (archived_by) REFERENCES users(id);
    END IF;
END $$;

COMMIT;
