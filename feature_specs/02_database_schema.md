# SPEC-02: Database Schema & Row Level Security

> **Status:** DONE
> **Session:** 1–2
> **Tracker ref:** SPEC-02

---

## Goal

Design and deploy the complete PostgreSQL schema to Supabase, including all five tables, all foreign key relationships, and all RLS policies needed to enforce per-user data ownership and public token-based read access. After this spec is complete, the backend is fully configured and no further schema changes should be needed for MVP.

---

## Design / Technical Constraints

- **Platform:** Supabase (PostgreSQL + RLS). No Prisma. No ORM. All queries use `@supabase/supabase-js` directly.
- **Node types:** Enforce `NodeType` as a TypeScript union in `src/types/index.ts` only — do NOT create a Postgres `ENUM` type. This allows adding types without a migration.
- **`edge_waypoints`:** Store as a `jsonb` column on the `mindmaps` table — NOT as a separate table. Rationale: waypoints are always loaded and saved as a unit with their map. A join adds latency with no query benefit.
- **`node_content`:** Separate table from `nodes`. Content rows are created lazily on first node edit — do not create them on node insertion.
- **`share_token`:** `TEXT UNIQUE` column on `mindmaps`. Null when map is not shared. Non-null enables public RLS access without a join to a separate shares table.
- **`direction` column:** Add to `nodes` table. It will be handled with backward-compatibility logic in `mapStore` (SPEC-05). Do not add a NOT NULL constraint — allow null for legacy rows.
- **RLS:** Every table must have RLS enabled with at minimum an owner-only policy. The `mindmaps`, `nodes`, and `node_content` tables must also have a public SELECT policy keyed on `share_token IS NOT NULL`.

---

## Implementation Steps

### Table: `mindmaps`
Create with columns: `id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid REFERENCES auth.users NOT NULL`, `title text NOT NULL`, `description text`, `emoji text`, `color text`, `tags text[]`, `is_public boolean DEFAULT false`, `share_token text UNIQUE`, `edge_waypoints jsonb DEFAULT '{}'`, `node_count int DEFAULT 0`, `completed_count int DEFAULT 0`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`.
- Enable RLS
- Policy: `SELECT` WHERE `user_id = auth.uid()` (owner)
- Policy: `INSERT` WHERE `user_id = auth.uid()`
- Policy: `UPDATE` WHERE `user_id = auth.uid()`
- Policy: `DELETE` WHERE `user_id = auth.uid()`
- Public policy: `SELECT` WHERE `share_token IS NOT NULL` — no `auth.uid()` check (allows unauthenticated access)

### Table: `nodes`
Create with columns: `id uuid PK DEFAULT gen_random_uuid()`, `map_id uuid REFERENCES mindmaps(id) ON DELETE CASCADE NOT NULL`, `user_id uuid REFERENCES auth.users NOT NULL`, `label text NOT NULL`, `type text NOT NULL`, `parent_id uuid REFERENCES nodes(id) ON DELETE CASCADE`, `order_index int DEFAULT 0`, `color text`, `bg_color text`, `emoji text`, `direction text`, `position_x float8`, `position_y float8`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`.
- Enable RLS
- Owner CRUD policies (same pattern as `mindmaps`)
- Public SELECT policy: `SELECT` WHERE `map_id IN (SELECT id FROM mindmaps WHERE share_token IS NOT NULL)`

### Table: `node_content`
Create with columns: `node_id uuid PK REFERENCES nodes(id) ON DELETE CASCADE`, `map_id uuid REFERENCES mindmaps(id) ON DELETE CASCADE NOT NULL`, `user_id uuid REFERENCES auth.users NOT NULL`, `rich_content jsonb DEFAULT '[]'`, `definition text`, `key_points jsonb DEFAULT '[]'`, `mental_model text`, `good_example text`, `bad_example text`, `notes text`, `resources jsonb DEFAULT '[]'`, `is_completed boolean DEFAULT false`, `completed_at timestamptz`, `last_edited timestamptz`, `created_at timestamptz DEFAULT now()`.
- Enable RLS
- Owner CRUD policies
- Public SELECT policy: `SELECT` WHERE `map_id IN (SELECT id FROM mindmaps WHERE share_token IS NOT NULL)`

### Table: `profiles`
Create with columns: `id uuid PK REFERENCES auth.users ON DELETE CASCADE`, `display_name text`, `avatar_url text`, `created_at timestamptz DEFAULT now()`.
- Enable RLS
- Policy: `SELECT` WHERE `id = auth.uid()`
- Policy: `UPDATE` WHERE `id = auth.uid()`

### Table: `map_shares`
Create with columns: `id uuid PK DEFAULT gen_random_uuid()`, `map_id uuid REFERENCES mindmaps(id) ON DELETE CASCADE NOT NULL`, `shared_by_user_id uuid REFERENCES auth.users NOT NULL`, `shared_with_email text NOT NULL`, `permission text NOT NULL DEFAULT 'view'`, `accepted boolean DEFAULT false`, `created_at timestamptz DEFAULT now()`.
- Enable RLS
- Policy: `SELECT` and `INSERT` WHERE `shared_by_user_id = auth.uid()`

### `share_link_setup.sql` (project root)
- Write a standalone SQL file containing the three public share RLS policies (for `mindmaps`, `nodes`, `node_content`)
- This file serves as the source of truth for the public access setup and must be re-applied if the database is reset

### `src/types/index.ts` (update)
- Verify all type definitions reflect the exact column names and shapes in the schema above
- `MindmapNode.direction` should be typed as `NodeDirection | null | undefined`
- `NodeContent.richContent` should be typed as `unknown[]` (BlockNote block array — opaque at the type level)
- `MindmapMeta.shareToken` maps to DB column `share_token` (camelCase in TypeScript, snake_case in DB)

---

## Verification Checklist

- [ ] All five tables visible in Supabase Table Editor
- [ ] RLS is enabled on all five tables (green lock icon in Supabase dashboard)
- [ ] Running `SELECT * FROM mindmaps` as the `anon` role with no auth returns 0 rows (owner policy working)
- [ ] Running `SELECT * FROM mindmaps WHERE share_token IS NOT NULL` as the `anon` role returns rows for maps with a non-null token (public policy working)
