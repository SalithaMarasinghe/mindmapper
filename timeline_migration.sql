-- ============================================================
-- Migration: Timeline Feature
-- Created:   2026-09-18
-- Tables:    events, work_details, meeting_details, weekly_summaries
-- ============================================================


-- ============================================================
-- TABLE: events
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date              date        NOT NULL,
  start_time        time,
  end_time          time,
  type              text        NOT NULL CHECK (type IN ('work', 'meeting')),
  title             text        NOT NULL,
  project_tag       text,
  chain_id          uuid,
  previous_event_id uuid        REFERENCES events(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS events_user_id_date_idx ON events (user_id, date);
CREATE INDEX IF NOT EXISTS events_chain_id_idx     ON events (chain_id);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_own"
  ON events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "events_insert_own"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_update_own"
  ON events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "events_delete_own"
  ON events FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- TABLE: work_details
-- One-to-one with events where type = 'work'
-- ============================================================

CREATE TABLE IF NOT EXISTS work_details (
  event_id              uuid    PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  description           text    NOT NULL DEFAULT '',
  implementation_notes  text    NOT NULL DEFAULT '',
  status                text    NOT NULL DEFAULT 'in_progress' CHECK (status IN ('done', 'in_progress', 'blocked')),
  links                 jsonb   NOT NULL DEFAULT '[]'
);

-- RLS
ALTER TABLE work_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_details_select_own"
  ON work_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = work_details.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "work_details_insert_own"
  ON work_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = work_details.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "work_details_update_own"
  ON work_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = work_details.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "work_details_delete_own"
  ON work_details FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = work_details.event_id
        AND events.user_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE: meeting_details
-- One-to-one with events where type = 'meeting'
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_details (
  event_id            uuid    PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  is_optional         boolean NOT NULL DEFAULT false,
  discussion_summary  text    NOT NULL DEFAULT '',
  tasks_assigned      jsonb   NOT NULL DEFAULT '[]',
  decisions           text    NOT NULL DEFAULT '',
  links               jsonb   NOT NULL DEFAULT '[]'
);

-- RLS
ALTER TABLE meeting_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_details_select_own"
  ON meeting_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = meeting_details.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "meeting_details_insert_own"
  ON meeting_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = meeting_details.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "meeting_details_update_own"
  ON meeting_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = meeting_details.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "meeting_details_delete_own"
  ON meeting_details FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = meeting_details.event_id
        AND events.user_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE: weekly_summaries
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  week_start_date  date        NOT NULL,
  generated_text   text        NOT NULL DEFAULT '',
  source_event_ids jsonb       NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_summaries_select_own"
  ON weekly_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "weekly_summaries_insert_own"
  ON weekly_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weekly_summaries_update_own"
  ON weekly_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "weekly_summaries_delete_own"
  ON weekly_summaries FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- TRIGGER: auto-update events.updated_at on row change
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();