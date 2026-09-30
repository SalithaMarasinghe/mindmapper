# Database Backup Report

**Backup Date / Time:** 2026-09-30T17:32:52.027Z
**Supabase Project Ref:** `ixmvqmfesibpnrjmvzuj`

## Table Summary

| Table Name | Row Count | JSON File | Status |
| :--- | :--- | :--- | :--- |
| `profiles` | **3** | [`profiles.json`](./profiles.json) | ✅ Backed up |
| `mindmaps` | **5** | [`mindmaps.json`](./mindmaps.json) | ✅ Backed up |
| `nodes` | **171** | [`nodes.json`](./nodes.json) | ✅ Backed up |
| `node_content` | **164** | [`node_content.json`](./node_content.json) | ✅ Backed up |
| `map_shares` | **0** | [`map_shares.json`](./map_shares.json) | ✅ Backed up |
| `tasks` | **3** | [`tasks.json`](./tasks.json) | ✅ Backed up |
| `events` | **16** | [`events.json`](./events.json) | ✅ Backed up |
| `task_time_entries` | **6** | [`task_time_entries.json`](./task_time_entries.json) | ✅ Backed up |
| `task_status_history` | **18** | [`task_status_history.json`](./task_status_history.json) | ✅ Backed up |
| `work_details` | **7** | [`work_details.json`](./work_details.json) | ✅ Backed up |
| `meeting_details` | **9** | [`meeting_details.json`](./meeting_details.json) | ✅ Backed up |
| `weekly_summaries` | **2** | [`weekly_summaries.json`](./weekly_summaries.json) | ✅ Backed up |
| `assistant_conversations` | **2** | [`assistant_conversations.json`](./assistant_conversations.json) | ✅ Backed up |
| `assistant_messages` | **33** | [`assistant_messages.json`](./assistant_messages.json) | ✅ Backed up |

## Restoration Instructions

### Option A: Via SQL File
Run the included `restore_database.sql` against the database using the Supabase SQL Editor or Supabase CLI:
```bash
npx supabase db query --linked -f backups/backup_2026-09-30/restore_database.sql
```

### Option B: Programmatic Restore via Node.js
Run `node scripts/restore_backup.cjs` to restore specific tables or the entire backup.
