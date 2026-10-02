-- 20261010120000_link_tasks_to_projects.sql
-- Add project_id and project_tag to tasks table for project-level storyline integration

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_tag TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
