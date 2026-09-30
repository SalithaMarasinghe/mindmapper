-- 20261006120000_normalize_project_tags.sql
-- Standardize and normalize all project tags across historical events into 3 clean project initiatives.

BEGIN;

-- 1. Chain 1: Apollo Books Prototype (8 events)
UPDATE events
SET project_tag = 'Apollo Books Prototype'
WHERE chain_id = 'e1a10001-0000-4000-8000-000000000001';

-- 2. Chain 2: Spec-Driven Development (6 events)
UPDATE events
SET project_tag = 'Spec-Driven Development'
WHERE chain_id = 'e1a10002-0000-4000-8000-000000000002';

-- 3. Chain 3: Reusable AI Prototype (2 events)
UPDATE events
SET project_tag = 'Reusable AI Prototype'
WHERE chain_id = 'e1a10003-0000-4000-8000-000000000003';

COMMIT;
