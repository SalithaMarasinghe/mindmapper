-- ============================================================
-- Migration: Add source segment and task tracking to events for idempotency
-- ============================================================

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS source_segment_id uuid REFERENCES task_time_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_source_segment
  ON events (source_segment_id);

CREATE INDEX IF NOT EXISTS idx_events_source_task
  ON events (source_task_id);
