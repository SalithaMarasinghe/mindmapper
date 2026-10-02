-- ============================================================================
-- Migration: 20261012000000_add_project_category.sql
-- Description: Add category column to projects to distinguish between
--              'work' (professional client deliverables) and
--              'study' (personal upskilling, certifications, and drills).
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'category'
    ) THEN
        ALTER TABLE projects ADD COLUMN category TEXT DEFAULT 'work' CHECK (category IN ('work', 'study'));
    END IF;
END $$;

-- Backfill any existing projects as 'work'
UPDATE projects SET category = 'work' WHERE category IS NULL;
