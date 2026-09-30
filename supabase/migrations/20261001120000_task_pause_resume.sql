-- ============================================================
-- Migration: Add Pause/Resume Segments to Kanban Task Log
-- Tables modified: tasks, task_status_history
-- Tables created:  task_time_entries
-- ============================================================

-- 1. Alter tasks table to support pause state and cached duration
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracked_seconds integer NOT NULL DEFAULT 0;

-- 2. Create task_time_entries table for continuous work segments
CREATE TABLE IF NOT EXISTS task_time_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz NULL,
  end_reason  text        NULL CHECK (end_reason IS NULL OR end_reason IN ('paused', 'done', 'auto_closed', 'manual')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_time_entries_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- 3. Indexes for task_time_entries
CREATE INDEX IF NOT EXISTS idx_task_time_entries_task_started 
  ON task_time_entries (task_id, started_at ASC);

CREATE INDEX IF NOT EXISTS idx_task_time_entries_user_started 
  ON task_time_entries (user_id, started_at ASC);

-- Enforce at most one running segment per task
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_segment_per_task 
  ON task_time_entries (task_id) WHERE ended_at IS NULL;

-- Enforce at most one running segment per user across all tasks
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_segment_per_user 
  ON task_time_entries (user_id) WHERE ended_at IS NULL;

-- 4. Row Level Security for task_time_entries
ALTER TABLE task_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_time_entries_select_own"
  ON task_time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "task_time_entries_insert_own"
  ON task_time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_time_entries_update_own"
  ON task_time_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "task_time_entries_delete_own"
  ON task_time_entries FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Helper function: recalculates tasks.tracked_seconds, started_at, completed_at
CREATE OR REPLACE FUNCTION recalc_task_tracked_seconds(p_task_id uuid)
RETURNS void AS $$
DECLARE
  v_total_sec integer;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_has_open boolean;
BEGIN
  SELECT 
    COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)))::integer, 0),
    MIN(started_at),
    MAX(ended_at),
    COALESCE(BOOL_OR(ended_at IS NULL), false)
  INTO v_total_sec, v_first_start, v_last_end, v_has_open
  FROM task_time_entries
  WHERE task_id = p_task_id;

  UPDATE tasks
  SET 
    tracked_seconds = COALESCE(v_total_sec, 0),
    started_at = COALESCE(v_first_start, started_at),
    completed_at = CASE WHEN status = 'done' THEN COALESCE(v_last_end, completed_at) ELSE NULL END,
    is_paused = CASE WHEN status = 'in_progress' AND v_has_open IS FALSE THEN true ELSE false END
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Start or Resume task (atomically pausing any other running task for this user)
CREATE OR REPLACE FUNCTION rpc_start_or_resume_task(
  p_task_id uuid,
  p_timestamp timestamptz,
  p_is_resume boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_running_task_id uuid;
  v_running_entry_id uuid;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. If another task has an open segment for this user, close it as 'paused'
  SELECT task_id, id INTO v_running_task_id, v_running_entry_id
  FROM task_time_entries
  WHERE user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_running_task_id IS NOT NULL AND v_running_task_id <> p_task_id THEN
    UPDATE task_time_entries
    SET ended_at = p_timestamp, end_reason = 'paused'
    WHERE id = v_running_entry_id;

    PERFORM recalc_task_tracked_seconds(v_running_task_id);

    INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
    VALUES (v_running_task_id, v_user_id, 'in_progress', 'paused', p_timestamp, 'Auto-paused to start another task');
  END IF;

  -- 2. Open new segment for the target task
  INSERT INTO task_time_entries (task_id, user_id, started_at)
  VALUES (p_task_id, v_user_id, p_timestamp);

  -- 3. Update task row
  UPDATE tasks
  SET 
    status = 'in_progress',
    is_paused = false,
    started_at = COALESCE(started_at, p_timestamp)
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  -- 4. Audit log
  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
  VALUES (
    p_task_id,
    v_user_id,
    CASE WHEN p_is_resume THEN 'paused' ELSE 'todo' END,
    'in_progress',
    p_timestamp,
    CASE WHEN p_is_resume THEN 'Resumed task' ELSE 'Started task' END
  );

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Pause task
CREATE OR REPLACE FUNCTION rpc_pause_task(
  p_task_id uuid,
  p_timestamp timestamptz,
  p_reason text DEFAULT 'paused'
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find and close open segment
  SELECT id INTO v_entry_id
  FROM task_time_entries
  WHERE task_id = p_task_id AND user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_entry_id IS NOT NULL THEN
    UPDATE task_time_entries
    SET ended_at = p_timestamp, end_reason = p_reason
    WHERE id = v_entry_id;
  END IF;

  -- Recalculate tracked_seconds and set is_paused=true
  PERFORM recalc_task_tracked_seconds(p_task_id);

  UPDATE tasks
  SET is_paused = true
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  -- Audit log
  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
  VALUES (p_task_id, v_user_id, 'in_progress', 'paused', p_timestamp, 'Paused task');

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Complete task
CREATE OR REPLACE FUNCTION rpc_complete_task(
  p_task_id uuid,
  p_timestamp timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If currently running, close segment as 'done'
  SELECT id INTO v_entry_id
  FROM task_time_entries
  WHERE task_id = p_task_id AND user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_entry_id IS NOT NULL THEN
    UPDATE task_time_entries
    SET ended_at = p_timestamp, end_reason = 'done'
    WHERE id = v_entry_id;
  END IF;

  -- Recalculate tracked_seconds
  PERFORM recalc_task_tracked_seconds(p_task_id);

  UPDATE tasks
  SET 
    status = 'done',
    is_paused = false,
    completed_at = p_timestamp
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
  VALUES (p_task_id, v_user_id, 'in_progress', 'done', p_timestamp, 'Completed task');

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Revert task to In Progress (backward move from Done)
CREATE OR REPLACE FUNCTION rpc_revert_to_in_progress(
  p_task_id uuid,
  p_timestamp timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_running_task_id uuid;
  v_running_entry_id uuid;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Pause any currently running task for this user
  SELECT task_id, id INTO v_running_task_id, v_running_entry_id
  FROM task_time_entries
  WHERE user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_running_task_id IS NOT NULL AND v_running_task_id <> p_task_id THEN
    UPDATE task_time_entries
    SET ended_at = p_timestamp, end_reason = 'paused'
    WHERE id = v_running_entry_id;

    PERFORM recalc_task_tracked_seconds(v_running_task_id);

    INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
    VALUES (v_running_task_id, v_user_id, 'in_progress', 'paused', p_timestamp, 'Auto-paused to reopen another task');
  END IF;

  -- 2. Open new segment for reopened task
  INSERT INTO task_time_entries (task_id, user_id, started_at)
  VALUES (p_task_id, v_user_id, p_timestamp);

  -- 3. Update task
  UPDATE tasks
  SET 
    status = 'in_progress',
    is_paused = false,
    completed_at = NULL
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, is_manual_edit, notes)
  VALUES (p_task_id, v_user_id, 'done', 'in_progress', p_timestamp, true, 'Reopened to In Progress');

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: Revert task to To Do (backward move from In Progress)
CREATE OR REPLACE FUNCTION rpc_revert_to_todo(
  p_task_id uuid,
  p_timestamp timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Close any open segment with 'manual'
  SELECT id INTO v_entry_id
  FROM task_time_entries
  WHERE task_id = p_task_id AND user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_entry_id IS NOT NULL THEN
    UPDATE task_time_entries
    SET ended_at = p_timestamp, end_reason = 'manual'
    WHERE id = v_entry_id;
  END IF;

  -- Recalculate tracked_seconds
  PERFORM recalc_task_tracked_seconds(p_task_id);

  UPDATE tasks
  SET 
    status = 'todo',
    is_paused = false,
    started_at = NULL
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, is_manual_edit, notes)
  VALUES (p_task_id, v_user_id, 'in_progress', 'todo', p_timestamp, true, 'Moved back to To Do (started_at cleared, segments preserved)');

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Backfill existing tasks into segments
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT id, user_id, status, started_at, completed_at
    FROM tasks
    WHERE started_at IS NOT NULL
  LOOP
    IF rec.status = 'done' AND rec.completed_at IS NOT NULL THEN
      INSERT INTO task_time_entries (task_id, user_id, started_at, ended_at, end_reason)
      VALUES (rec.id, rec.user_id, rec.started_at, rec.completed_at, 'done')
      ON CONFLICT DO NOTHING;

      UPDATE tasks 
      SET 
        tracked_seconds = EXTRACT(EPOCH FROM (rec.completed_at - rec.started_at))::integer,
        is_paused = false
      WHERE id = rec.id;

    ELSIF rec.status = 'in_progress' THEN
      INSERT INTO task_time_entries (task_id, user_id, started_at, ended_at, end_reason)
      VALUES (rec.id, rec.user_id, rec.started_at, NULL, NULL)
      ON CONFLICT DO NOTHING;

      UPDATE tasks 
      SET 
        tracked_seconds = 0,
        is_paused = false
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;
