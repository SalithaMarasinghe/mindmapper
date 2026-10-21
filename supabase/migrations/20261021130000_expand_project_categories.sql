-- ============================================================================
-- Migration: 20261021130000_expand_project_categories.sql
-- Description: Expand project categories to include 'freelance' and 'business'
--              alongside 'work' and 'study'.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'projects'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%category%'
    ) LOOP
        EXECUTE 'ALTER TABLE projects DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE projects ADD CONSTRAINT projects_category_check 
  CHECK (category IN ('work', 'study', 'freelance', 'business'));
