-- ============================================================
-- Migration: Kanban Work Task Log Feature
-- Tables: tasks, task_status_history
-- ============================================================

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  status       text        NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority     text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  planned_date date        NOT NULL DEFAULT CURRENT_DATE,
  started_at   timestamptz,
  completed_at timestamptz,
  order_index  integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_completed_after_started CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_planned_date ON tasks (user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created_at ON tasks (user_id, created_at);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- TABLE: task_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS task_status_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_status    text        NOT NULL,
  to_status      text        NOT NULL,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  is_manual_edit boolean     NOT NULL DEFAULT false,
  notes          text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_status_history (task_id, changed_at ASC);
CREATE INDEX IF NOT EXISTS idx_task_history_user_id ON task_status_history (user_id);

-- RLS
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_history_select_own"
  ON task_status_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "task_history_insert_own"
  ON task_status_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_history_update_own"
  ON task_status_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "task_history_delete_own"
  ON task_status_history FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- TRIGGER: auto-update tasks.updated_at on row change
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
