-- Migration: 20261020000000_mandatory_event_fields_and_summary_xyz.sql
-- Description:
--   1. Add summary_xyz column to events
--   2. Backfill existing rows (summary_xyz, project_tag, start_time, end_time)
--   3. Enforce NOT NULL and validation checks for compulsory fields:
--      - events: title, date, start_time, end_time, project (project_id or project_tag), summary_xyz
--      - work_details: description
--      - meeting_details: discussion_summary

BEGIN;

-- 1. Add summary_xyz column
ALTER TABLE events ADD COLUMN IF NOT EXISTS summary_xyz TEXT;

-- 2. Backfill null/empty fields on existing rows
-- Ensure EquipRAG exists in projects
DO $$
DECLARE
  v_user_id UUID;
  v_equip_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM events LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO projects (user_id, name, description, status, category, created_at, updated_at)
    VALUES (
      v_user_id,
      'EquipRAG Voice Co-Pilot',
      'Industrial Voice Co-Pilot and RAG manual diagnostic system.',
      'active',
      'work',
      '2026-10-01 00:00:00+00',
      now()
    )
    ON CONFLICT (user_id, name) DO NOTHING
    RETURNING id INTO v_equip_id;

    IF v_equip_id IS NULL THEN
      SELECT id INTO v_equip_id FROM projects WHERE name = 'EquipRAG Voice Co-Pilot' LIMIT 1;
    END IF;

    -- Link events that have project_tag 'EquipRAG Voice Co-Pilot'
    UPDATE events SET project_id = v_equip_id WHERE project_tag = 'EquipRAG Voice Co-Pilot' AND project_id IS NULL;

    -- Fix the 3 unassigned events
    UPDATE events
    SET project_tag = 'EquipRAG Voice Co-Pilot', project_id = v_equip_id
    WHERE id IN ('f9a71e62-ecee-47eb-91ed-44bd14567f69', '37aa660c-7c81-4ee9-a690-ae768e502e86');

    UPDATE events
    SET project_tag = 'Reusable AI Prototype'
    WHERE id = 'b0c98d29-7f41-4e46-83f9-3aa00785d807';
  END IF;
END $$;

-- Fallback for any remaining null project_tags
UPDATE events SET project_tag = 'General' WHERE (project_tag IS NULL OR trim(project_tag) = '') AND project_id IS NULL;

-- Backfill start_time / end_time if null
UPDATE events SET start_time = '09:00:00' WHERE start_time IS NULL;
UPDATE events SET end_time = '10:00:00' WHERE end_time IS NULL;

-- Backfill summary_xyz for existing work events
UPDATE events e
SET summary_xyz = COALESCE(
  NULLIF(trim(substring(wd.description from 1 for 300)), ''),
  e.title
)
FROM work_details wd
WHERE e.id = wd.event_id AND (e.summary_xyz IS NULL OR trim(e.summary_xyz) = '');

-- Backfill summary_xyz for existing meeting events
UPDATE events e
SET summary_xyz = COALESCE(
  NULLIF(trim(substring(md.discussion_summary from 1 for 300)), ''),
  e.title
)
FROM meeting_details md
WHERE e.id = md.event_id AND (e.summary_xyz IS NULL OR trim(e.summary_xyz) = '');

-- Fallback for any remaining events
UPDATE events SET summary_xyz = title WHERE summary_xyz IS NULL OR trim(summary_xyz) = '';

-- Backfill work_details description if empty
UPDATE work_details SET description = 'Engineering work performed.' WHERE description IS NULL OR trim(description) = '';

-- Backfill meeting_details discussion_summary if empty
UPDATE meeting_details SET discussion_summary = 'Meeting discussion held.' WHERE discussion_summary IS NULL OR trim(discussion_summary) = '';

-- 3. Alter columns to NOT NULL
ALTER TABLE events ALTER COLUMN start_time SET NOT NULL;
ALTER TABLE events ALTER COLUMN end_time SET NOT NULL;
ALTER TABLE events ALTER COLUMN summary_xyz SET NOT NULL;

-- 4. Add CHECK constraints to guarantee non-empty strings
ALTER TABLE events DROP CONSTRAINT IF EXISTS check_events_title_non_empty;
ALTER TABLE events ADD CONSTRAINT check_events_title_non_empty CHECK (length(trim(title)) > 0);

ALTER TABLE events DROP CONSTRAINT IF EXISTS check_events_project_assigned;
ALTER TABLE events ADD CONSTRAINT check_events_project_assigned CHECK (
  project_id IS NOT NULL OR (project_tag IS NOT NULL AND length(trim(project_tag)) > 0)
);

ALTER TABLE events DROP CONSTRAINT IF EXISTS check_events_summary_xyz_non_empty;
ALTER TABLE events ADD CONSTRAINT check_events_summary_xyz_non_empty CHECK (length(trim(summary_xyz)) > 0);

ALTER TABLE work_details DROP CONSTRAINT IF EXISTS check_work_description_non_empty;
ALTER TABLE work_details ADD CONSTRAINT check_work_description_non_empty CHECK (length(trim(description)) > 0);

ALTER TABLE meeting_details DROP CONSTRAINT IF EXISTS check_meeting_discussion_non_empty;
ALTER TABLE meeting_details ADD CONSTRAINT check_meeting_discussion_non_empty CHECK (length(trim(discussion_summary)) > 0);

COMMIT;
