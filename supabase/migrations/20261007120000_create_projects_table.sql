-- 20261007120000_create_projects_table.sql
-- Create first-class projects table and link events to projects for deterministic chronological storyline ordering.

BEGIN;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'planning')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add project_id foreign key to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at);

-- Seed historical projects and link existing events
DO $$
DECLARE
  v_user_id UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_p3 UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM events LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- 1. Apollo Books Prototype (Sprint 1: Created Sep 21, 2026)
    INSERT INTO projects (user_id, name, description, status, created_at, updated_at)
    VALUES (
      v_user_id,
      'Apollo Books Prototype',
      'Sprint 1: End-to-end prototyping for AI accounting platform (Scaffolding, Home & Desk sections, UX walkthroughs, chat agent polish, and handover).',
      'completed',
      '2026-09-21 10:00:00+00',
      '2026-09-23 18:00:00+00'
    )
    ON CONFLICT (user_id, name) DO UPDATE SET 
      created_at = EXCLUDED.created_at,
      status = EXCLUDED.status,
      description = EXCLUDED.description
    RETURNING id INTO v_p1;

    -- 2. Spec-Driven Development (Sprint 2: Created Sep 28, 2026)
    INSERT INTO projects (user_id, name, description, status, created_at, updated_at)
    VALUES (
      v_user_id,
      'Spec-Driven Development',
      'Sprint 2: Spec-Driven Development 3-phase evaluation benchmark (BMAD vs OpenSpec vs GitHub Spec Kit), FastAPI migration, showcase review, and Netlify comparison portal deployment.',
      'completed',
      '2026-09-28 10:00:00+00',
      '2026-09-30 17:00:00+00'
    )
    ON CONFLICT (user_id, name) DO UPDATE SET 
      created_at = EXCLUDED.created_at,
      status = EXCLUDED.status,
      description = EXCLUDED.description
    RETURNING id INTO v_p2;

    -- 3. Reusable AI Prototype (Sprint 3: Created Sep 30, 2026)
    INSERT INTO projects (user_id, name, description, status, created_at, updated_at)
    VALUES (
      v_user_id,
      'Reusable AI Prototype',
      'Sprint 3: Strategy exploration of existing GitHub repository, RAG architecture planning, and agent orchestration prototype.',
      'active',
      '2026-09-30 09:00:00+00',
      '2026-09-30 09:00:00+00'
    )
    ON CONFLICT (user_id, name) DO UPDATE SET 
      created_at = EXCLUDED.created_at,
      status = EXCLUDED.status,
      description = EXCLUDED.description
    RETURNING id INTO v_p3;

    -- Link all 16 existing events to their respective project_id
    UPDATE events SET project_id = v_p1 WHERE project_tag = 'Apollo Books Prototype';
    UPDATE events SET project_id = v_p2 WHERE project_tag = 'Spec-Driven Development';
    UPDATE events SET project_id = v_p3 WHERE project_tag = 'Reusable AI Prototype';
  END IF;
END $$;

COMMIT;
