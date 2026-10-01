-- Migration: Bulletproof Task Pause, Pause All, Start/Resume, and Complete RPCs v2
-- Date: 2026-10-09

-- 1. Create or replace rpc_pause_task with safe fallback and GREATEST timestamp guard
CREATE OR REPLACE FUNCTION rpc_pause_task(
  p_task_id uuid DEFAULT NULL,
  p_timestamp timestamptz DEFAULT now(),
  p_reason text DEFAULT 'paused'
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_target_task_id uuid := p_task_id;
  v_entry_start timestamptz;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Try to find open segment for p_task_id
  IF p_task_id IS NOT NULL THEN
    SELECT id, started_at INTO v_entry_id, v_entry_start
    FROM task_time_entries
    WHERE task_id = p_task_id AND user_id = v_user_id AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1;
  END IF;

  -- 2. If no segment found for p_task_id, find ANY open segment for this user
  IF v_entry_id IS NULL THEN
    SELECT id, task_id, started_at INTO v_entry_id, v_target_task_id, v_entry_start
    FROM task_time_entries
    WHERE user_id = v_user_id AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1;
  END IF;

  -- 2b. If still no task found, check if there is an in_progress task for this user
  IF v_target_task_id IS NULL THEN
    SELECT id INTO v_target_task_id
    FROM tasks
    WHERE user_id = v_user_id AND status = 'in_progress' AND is_paused = false
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  -- 3. Close the open segment safely ensuring ended_at >= started_at
  IF v_entry_id IS NOT NULL THEN
    UPDATE task_time_entries
    SET 
      ended_at = GREATEST(COALESCE(p_timestamp, now()), v_entry_start),
      end_reason = COALESCE(p_reason, 'paused')
    WHERE id = v_entry_id;
  END IF;

  -- 4. If we have a target task, update its state and recalc
  IF v_target_task_id IS NOT NULL THEN
    PERFORM recalc_task_tracked_seconds(v_target_task_id);

    UPDATE tasks
    SET is_paused = true
    WHERE id = v_target_task_id AND user_id = v_user_id
    RETURNING * INTO v_task;

    INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
    VALUES (v_target_task_id, v_user_id, 'in_progress', 'paused', COALESCE(p_timestamp, now()), 'Paused task');
  END IF;

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create rpc_pause_all to pause all active timers for this user
CREATE OR REPLACE FUNCTION rpc_pause_all(
  p_timestamp timestamptz DEFAULT now(),
  p_reason text DEFAULT 'paused'
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rec RECORD;
  v_last_task tasks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR v_rec IN
    SELECT id, task_id, started_at
    FROM task_time_entries
    WHERE user_id = v_user_id AND ended_at IS NULL
  LOOP
    UPDATE task_time_entries
    SET 
      ended_at = GREATEST(COALESCE(p_timestamp, now()), v_rec.started_at),
      end_reason = COALESCE(p_reason, 'paused')
    WHERE id = v_rec.id;

    PERFORM recalc_task_tracked_seconds(v_rec.task_id);

    UPDATE tasks
    SET is_paused = true
    WHERE id = v_rec.task_id AND user_id = v_user_id
    RETURNING * INTO v_last_task;

    INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
    VALUES (v_rec.task_id, v_user_id, 'in_progress', 'paused', COALESCE(p_timestamp, now()), 'Paused on break');
  END LOOP;

  -- Ensure any in_progress task with no open segment is also marked is_paused = true
  UPDATE tasks
  SET is_paused = true
  WHERE user_id = v_user_id AND status = 'in_progress' AND is_paused = false;

  RETURN to_jsonb(v_last_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enhance rpc_start_or_resume_task with GREATEST timestamp guard and displaced task update
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
  v_running_entry_start timestamptz;
  v_task tasks%ROWTYPE;
  v_safe_timestamp timestamptz := COALESCE(p_timestamp, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. If another task has an open segment for this user, close it safely as 'paused'
  SELECT task_id, id, started_at INTO v_running_task_id, v_running_entry_id, v_running_entry_start
  FROM task_time_entries
  WHERE user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_running_task_id IS NOT NULL AND v_running_task_id <> p_task_id THEN
    UPDATE task_time_entries
    SET ended_at = GREATEST(v_safe_timestamp, v_running_entry_start), end_reason = 'paused'
    WHERE id = v_running_entry_id;

    PERFORM recalc_task_tracked_seconds(v_running_task_id);

    UPDATE tasks
    SET is_paused = true
    WHERE id = v_running_task_id AND user_id = v_user_id;

    INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
    VALUES (v_running_task_id, v_user_id, 'in_progress', 'paused', v_safe_timestamp, 'Auto-paused to start another task');
  END IF;

  -- 2. Open new segment for the target task
  INSERT INTO task_time_entries (task_id, user_id, started_at)
  VALUES (p_task_id, v_user_id, v_safe_timestamp);

  -- 3. Update task row
  UPDATE tasks
  SET 
    status = 'in_progress',
    is_paused = false,
    started_at = COALESCE(started_at, v_safe_timestamp)
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  -- 4. Audit log
  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
  VALUES (
    p_task_id,
    v_user_id,
    CASE WHEN p_is_resume THEN 'paused' ELSE 'todo' END,
    'in_progress',
    v_safe_timestamp,
    CASE WHEN p_is_resume THEN 'Resumed task' ELSE 'Started task' END
  );

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enhance rpc_complete_task with GREATEST timestamp guard
CREATE OR REPLACE FUNCTION rpc_complete_task(
  p_task_id uuid,
  p_timestamp timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_entry_start timestamptz;
  v_task tasks%ROWTYPE;
  v_safe_timestamp timestamptz := COALESCE(p_timestamp, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If currently running, close segment as 'done'
  SELECT id, started_at INTO v_entry_id, v_entry_start
  FROM task_time_entries
  WHERE task_id = p_task_id AND user_id = v_user_id AND ended_at IS NULL
  LIMIT 1;

  IF v_entry_id IS NOT NULL THEN
    v_safe_timestamp := GREATEST(v_safe_timestamp, v_entry_start);
    UPDATE task_time_entries
    SET ended_at = v_safe_timestamp, end_reason = 'done'
    WHERE id = v_entry_id;
  END IF;

  -- Recalculate tracked_seconds
  PERFORM recalc_task_tracked_seconds(p_task_id);

  UPDATE tasks
  SET 
    status = 'done',
    is_paused = false,
    completed_at = v_safe_timestamp
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  INSERT INTO task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
  VALUES (p_task_id, v_user_id, 'in_progress', 'done', v_safe_timestamp, 'Completed task');

  RETURN to_jsonb(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
