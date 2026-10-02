// ═══════════════════════════════════════════════════════════════════════════════
// Jarvis Cloud MCP Server (Supabase Edge Function) - Full Headless OS Suite
// ═══════════════════════════════════════════════════════════════════════════════
// Fully online, serverless Model Context Protocol (MCP) server running on Supabase.
// Dual protocol support:
// 1. Standard MCP JSON-RPC 2.0 (for Antigravity, Claude Code, Cursor, Claude Desktop)
// 2. Direct REST / OpenAPI format (for ChatGPT Custom GPT Actions, curl, scripts)
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-session-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Default fallback user ID for API-Key authorized requests (Salitha Marasinghe - marasinghe3u@gmail.com)
const DEFAULT_USER_ID = Deno.env.get('JARVIS_USER_ID') || '3e9e3dd3-a59b-4b02-968a-ee95e7317583';

// ─── HELPER: FORMAT POINT-WISE BULLETS ───────────────────────────────────────

function toBulletPoints(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  // If already formatted with markdown bullets, return as-is
  if (/^[-*•]\s+/m.test(trimmed)) {
    return trimmed;
  }
  // Split by newlines or semicolons if multiple statements
  const lines = trimmed
    .split(/(?:\r?\n|;\s*)/)
    .map((l) => l.trim().replace(/^[-*•\d.)]\s*/, ''))
    .filter(Boolean);

  if (lines.length > 1) {
    return lines.map((l) => `- ${l}`).join('\n');
  }
  return `- ${trimmed}`;
}

// ─── TOOL DEFINITIONS (MCP Standard Schema) ──────────────────────────────────

const JARVIS_TOOLS = [
  // ─── SUITE 1: TASKS & REAL-TIME TIMERS (KANBAN) ───────────────────────────
  {
    name: 'jarvis_start_timer',
    description: 'Starts the live timer on a Kanban task, moves it to "in_progress", and creates an active time tracking segment in Supabase. Automatically pauses any other running task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'UUID or exact/fuzzy title of the task to start.',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'jarvis_pause_timer',
    description: 'Pauses the currently running task timer when stepping away or taking a break. Closes the time segment and records pause reason (e.g. "break", "lunch", "meeting").',
    inputSchema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['break', 'lunch', 'meeting', 'manual'],
          description: 'Reason for the break/pause (default: "break").',
        },
        taskId: {
          type: 'string',
          description: 'Optional task UUID or title. If omitted, automatically pauses whatever task is currently running.',
        },
      },
    },
  },
  {
    name: 'jarvis_resume_timer',
    description: 'Resumes tracking time on the most recently paused task or a specified task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task UUID or title. If omitted, automatically resumes the last paused task.',
        },
      },
    },
  },
  {
    name: 'jarvis_pause_all',
    description: 'Emergency stop / stepping away: immediately pauses all running task timers across the board.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jarvis_list_tasks',
    description: 'Lists tasks on Salitha\'s Kanban task board with status, priority, tracked seconds, and storyline tag.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Filter by status: "todo", "in_progress", or "done". Leave empty to list all open tasks.',
        },
        date: {
          type: 'string',
          description: 'Optional date in YYYY-MM-DD format (or "today") to filter planned tasks.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default 25).',
        },
      },
    },
  },
  {
    name: 'jarvis_create_task',
    description: 'Creates a new task on Salitha\'s Kanban board. Automatically sets planned date to tomorrow if requested.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the task.',
        },
        description: {
          type: 'string',
          description: 'Optional detailed description or sub-tasks.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level (default "medium").',
        },
        plannedDate: {
          type: 'string',
          description: 'Planned date in YYYY-MM-DD format, or "today" / "tomorrow".',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Initial status (default "todo").',
        },
        projectName: {
          type: 'string',
          description: 'Optional project name. Defaults to current active focus project.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'jarvis_update_task',
    description: 'Updates task title, status (todo/in_progress/done), priority, or planned date.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'UUID or exact title of the task.',
        },
        title: {
          type: 'string',
          description: 'Updated title.',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'New status.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Updated priority.',
        },
        plannedDate: {
          type: 'string',
          description: 'Updated planned date (YYYY-MM-DD, "today", or "tomorrow").',
        },
        trackedSeconds: {
          type: 'number',
          description: 'Total tracked seconds worked on this task.',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'jarvis_delete_task',
    description: 'Deletes a task from the Kanban board.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'UUID or exact title of the task to delete.',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'jarvis_carryover_tasks',
    description: 'Carries over unfinished tasks from past dates/yesterday into today (or a specified target date).',
    inputSchema: {
      type: 'object',
      properties: {
        targetDate: {
          type: 'string',
          description: 'Target date in YYYY-MM-DD format (defaults to today).',
        },
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of specific task UUIDs/titles to carryover. If omitted, carries over all incomplete past tasks.',
        },
      },
    },
  },
  {
    name: 'jarvis_get_daily_summary',
    description: 'Generates a daily standup / evening wrap-up briefing with total focus time, break time, completed tasks, and active storyline.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
      },
    },
  },

  // ─── SUITE 2: CAREER LEDGER & WORK JOURNALS ───────────────────────────────
  {
    name: 'jarvis_create_work_journal',
    description: 'Logs an engineering work session into Salitha\'s Work Journal / Career Ledger using Google XYZ format with automated point-wise bullet formatting. Automatically attaches to the active focus project storyline and updates any linked Kanban task.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the engineering work session (e.g. "RAG Architecture Codebase Investigation").',
        },
        startTime: {
          type: 'string',
          description: 'Start time in 24h format HH:MM (e.g. "17:30").',
        },
        endTime: {
          type: 'string',
          description: 'End time in 24h format HH:MM (e.g. "19:15").',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today if omitted.',
        },
        objective: {
          type: 'string',
          description: '🎯 Objective & Context: Executive summary of why this work was done and the component involved.',
        },
        technicalExecution: {
          type: 'string',
          description: '🛠️ Technical Execution [Doing Z]: Specific technical steps as point-wise bullet items (e.g. "- Step 1\\n- Step 2").',
        },
        keyAccomplishments: {
          type: 'string',
          description: '🏆 Key Accomplishments [Accomplished X]: Concrete deliverables and milestones as point-wise bullet items (e.g. "- Deliverable 1\\n- Deliverable 2").',
        },
        measuredImpact: {
          type: 'string',
          description: '📊 Measured Impact & Metrics [Measured by Y]: Empirical numbers, benchmarks as point-wise bullet items (e.g. "- 38ms latency\\n- 100% tests passing").',
        },
        nextMilestone: {
          type: 'string',
          description: 'Planned next milestone or tomorrow\'s deliverable (e.g. "implement cache eviction").',
        },
        implementationNotes: {
          type: 'string',
          description: 'Additional technical notes, terminal logs, or architectural decisions.',
        },
        status: {
          type: 'string',
          enum: ['done', 'in_progress'],
          description: 'Work status: "done" if task is completed, "in_progress" if halfway or done for the day.',
        },
        linkedTaskId: {
          type: 'string',
          description: 'Optional UUID or exact title of a Kanban task to link and complete.',
        },
        projectName: {
          type: 'string',
          description: 'Project storyline name. Defaults to current active focus project.',
        },
      },
      required: ['title', 'startTime', 'endTime', 'objective', 'technicalExecution', 'keyAccomplishments', 'measuredImpact'],
    },
  },
  {
    name: 'jarvis_update_work_journal',
    description: 'Updates an existing work journal entry\'s title, timing, or narrative.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'UUID or exact title of the work journal event.',
        },
        title: { type: 'string' },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
        objective: { type: 'string' },
        technicalExecution: { type: 'string' },
        keyAccomplishments: { type: 'string' },
        measuredImpact: { type: 'string' },
        implementationNotes: { type: 'string' },
        status: { type: 'string', enum: ['done', 'in_progress'] },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'jarvis_delete_work_journal',
    description: 'Deletes a work journal entry and its associated details.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'UUID or exact title of the work journal event to delete.',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'jarvis_search_journals',
    description: 'Searches past work journals and meeting logs by keyword, topic, or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query keyword (e.g. "latency", "Qdrant", "refactor").',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10).',
        },
      },
      required: ['query'],
    },
  },

  // ─── SUITE 3: PROJECT STORYLINES ──────────────────────────────────────────
  {
    name: 'jarvis_get_active_project',
    description: 'Retrieves Salitha\'s currently active focus project (the narrative storyline spine of the Career Ledger).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jarvis_switch_active_project',
    description: 'Switches the active focus project storyline so all subsequent tasks and journals attach to it.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Name of the project to focus on (e.g. "Reusable AI Prototype").',
        },
      },
      required: ['projectName'],
    },
  },
  {
    name: 'jarvis_list_projects',
    description: 'Lists all project storylines (active, planned, completed) with task counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jarvis_create_project',
    description: 'Creates a new project storyline with description and initial status.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the project storyline.',
        },
        description: {
          type: 'string',
          description: 'Description or target milestone.',
        },
        status: {
          type: 'string',
          enum: ['active', 'planned', 'completed'],
          description: 'Status of the project (default "planned"). If "active", it becomes the current focus project.',
        },
      },
      required: ['name'],
    },
  },

  // ─── SUITE 4: MEETINGS & ARCHITECTURAL SYNCS ──────────────────────────────
  {
    name: 'jarvis_log_meeting',
    description: 'Logs an architectural sync, supervisor meeting, or standup with decisions and action items. Optionally auto-creates Kanban tasks for tomorrow for each action item.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Meeting topic or title (e.g. "RAG Implementation Sync").',
        },
        startTime: {
          type: 'string',
          description: 'Start time in 24h format HH:MM (e.g. "10:00").',
        },
        endTime: {
          type: 'string',
          description: 'End time in 24h format HH:MM (e.g. "10:45").',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendees (e.g. ["Salitha Marasinghe", "Principal Engineer"]).',
        },
        discussionSummary: {
          type: 'string',
          description: 'Summary of discussion and topics reviewed.',
        },
        decisions: {
          type: 'string',
          description: 'Agreed direction, trade-offs, and deferred items.',
        },
        actionItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              assignee: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['text'],
          },
          description: 'Deliverables assigned from the meeting.',
        },
        createTasksFromActionItems: {
          type: 'boolean',
          description: 'If true, automatically creates Kanban tasks for tomorrow for each action item (default: true).',
        },
        projectName: {
          type: 'string',
          description: 'Project storyline name.',
        },
      },
      required: ['title', 'startTime', 'endTime', 'discussionSummary'],
    },
  },

  // ─── SUITE 5: MIND MAPS & KNOWLEDGE GRAPH ─────────────────────────────────
  {
    name: 'jarvis_list_mindmaps',
    description: 'Lists Salitha\'s Mind Maps with node counts, tags, and topics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jarvis_add_mindmap_node',
    description: 'Adds a concept node to a Mind Map directly from an IDE discussion or research session.',
    inputSchema: {
      type: 'object',
      properties: {
        mapId: {
          type: 'string',
          description: 'UUID or title of the mind map.',
        },
        label: {
          type: 'string',
          description: 'Text or concept name for the node.',
        },
        parentNodeId: {
          type: 'string',
          description: 'Optional parent node UUID.',
        },
        emoji: {
          type: 'string',
          description: 'Optional emoji for the node (e.g. "🧠", "⚡").',
        },
      },
      required: ['mapId', 'label'],
    },
  },
];

// ─── DATABASE ENTITY RESOLVERS ───────────────────────────────────────────────

async function getActiveProject(supabase: any, userId: string) {
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!projects || projects.length === 0) return null;
  const active = projects.find((p: any) => p.status === 'active') || projects[0];
  return active;
}

async function resolveTaskId(supabase: any, userId: string, identifier: string): Promise<{ id: string; title: string; status: string; is_paused: boolean } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUUID) {
    const { data } = await supabase.from('tasks').select('id, title, status, is_paused').eq('id', identifier).eq('user_id', userId).maybeSingle();
    return data || null;
  }
  const clean = identifier.replace(/\b(the|task|my)\b/gi, '').trim();
  const { data } = await supabase.from('tasks').select('id, title, status, is_paused').eq('user_id', userId).ilike('title', `%${clean || identifier}%`).limit(1);
  return data?.[0] || null;
}

async function resolveEventId(supabase: any, userId: string, identifier: string): Promise<{ id: string; title: string } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUUID) {
    const { data } = await supabase.from('events').select('id, title').eq('id', identifier).eq('user_id', userId).maybeSingle();
    return data || null;
  }
  const clean = identifier.replace(/\b(the|journal|work|event)\b/gi, '').trim();
  const { data } = await supabase.from('events').select('id, title').eq('user_id', userId).ilike('title', `%${clean || identifier}%`).limit(1);
  return data?.[0] || null;
}

async function resolveMindmapId(supabase: any, userId: string, identifier: string): Promise<{ id: string; title: string; node_count: number } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUUID) {
    const { data } = await supabase.from('mindmaps').select('id, title, node_count').eq('id', identifier).eq('user_id', userId).maybeSingle();
    return data || null;
  }
  const clean = identifier.replace(/\b(the|map|mindmap)\b/gi, '').trim();
  const { data } = await supabase.from('mindmaps').select('id, title, node_count').eq('user_id', userId).ilike('title', `%${clean || identifier}%`).limit(1);
  return data?.[0] || null;
}

// ─── EXECUTE TOOL IMPLEMENTATION ─────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>, supabase: any, userId: string) {
  const now = new Date();
  const nowISO = now.toISOString();
  const todayISO = nowISO.slice(0, 10);
  const tomorrowISO = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  switch (name) {
    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 1: TASKS & REAL-TIME TIMERS
    // ═════════════════════════════════════════════════════════════════════════

    case 'jarvis_start_timer': {
      const target = await resolveTaskId(supabase, userId, args.taskId);
      if (!target) return { success: false, error: `Task "${args.taskId}" not found.` };

      const { error } = await supabase.rpc('rpc_start_or_resume_task', {
        p_task_id: target.id,
        p_timestamp: nowISO,
        p_is_resume: false,
        p_user_id: userId,
      });

      if (error) throw error;
      return {
        success: true,
        message: `Started timer on task: "${target.title}". Status moved to "in_progress".`,
        taskId: target.id,
      };
    }

    case 'jarvis_pause_timer': {
      let targetId = args.taskId;
      let targetTitle = '';

      if (targetId) {
        const target = await resolveTaskId(supabase, userId, targetId);
        if (!target) return { success: false, error: `Task "${targetId}" not found.` };
        targetId = target.id;
        targetTitle = target.title;
      } else {
        // Auto-find currently running task
        const { data: running } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .eq('is_paused', false)
          .limit(1);

        if (!running || running.length === 0) {
          return { success: false, message: 'No task is currently running to pause.' };
        }
        targetId = running[0].id;
        targetTitle = running[0].title;
      }

      const reason = args.reason || 'break';
      const dbReason = ['paused', 'done', 'auto_closed', 'manual'].includes(reason) ? reason : 'paused';
      const { error } = await supabase.rpc('rpc_pause_task', {
        p_task_id: targetId,
        p_timestamp: nowISO,
        p_reason: dbReason,
        p_user_id: userId,
      });

      if (error) throw error;
      return {
        success: true,
        message: `Paused timer on "${targetTitle}" (Reason: ${reason}). You're on break!`,
        taskId: targetId,
        reason,
      };
    }

    case 'jarvis_resume_timer': {
      let targetId = args.taskId;
      let targetTitle = '';

      if (targetId) {
        const target = await resolveTaskId(supabase, userId, targetId);
        if (!target) return { success: false, error: `Task "${targetId}" not found.` };
        targetId = target.id;
        targetTitle = target.title;
      } else {
        // Auto-find most recently paused task
        const { data: paused } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .eq('is_paused', true)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!paused || paused.length === 0) {
          // If no paused task, find top todo task
          const { data: todo } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('user_id', userId)
            .eq('status', 'todo')
            .order('created_at', { ascending: false })
            .limit(1);

          if (!todo || todo.length === 0) {
            return { success: false, message: 'No paused or todo task found to resume.' };
          }
          targetId = todo[0].id;
          targetTitle = todo[0].title;
        } else {
          targetId = paused[0].id;
          targetTitle = paused[0].title;
        }
      }

      const { error } = await supabase.rpc('rpc_start_or_resume_task', {
        p_task_id: targetId,
        p_timestamp: nowISO,
        p_is_resume: true,
        p_user_id: userId,
      });

      if (error) throw error;
      return {
        success: true,
        message: `Resumed timer on "${targetTitle}". Welcome back!`,
        taskId: targetId,
      };
    }

    case 'jarvis_pause_all': {
      const { error } = await supabase.rpc('rpc_pause_all', {
        p_timestamp: nowISO,
        p_reason: 'paused',
        p_user_id: userId,
      });

      if (error) throw error;
      return {
        success: true,
        message: 'Paused all active task timers. Stepped away.',
      };
    }

    case 'jarvis_list_tasks': {
      let query = supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (args.status) query = query.eq('status', args.status);
      if (args.date) {
        const dateVal = args.date === 'today' ? todayISO : args.date;
        query = query.eq('planned_date', dateVal);
      }
      const limit = Number(args.limit) || 25;
      query = query.limit(limit);
      const { data: tasks, error } = await query;
      if (error) throw error;
      return {
        count: tasks.length,
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          plannedDate: t.planned_date,
          trackedSeconds: t.tracked_seconds,
          isPaused: t.is_paused,
          projectTag: t.project_tag,
        })),
      };
    }

    case 'jarvis_create_task': {
      const title = String(args.title || '').trim();
      let plannedDate = args.plannedDate;
      if (!plannedDate || plannedDate === 'today') plannedDate = todayISO;
      else if (plannedDate === 'tomorrow') plannedDate = tomorrowISO;

      let projectId = null;
      let projectTag = null;
      if (args.projectName) {
        const { data: proj } = await supabase.from('projects').select('id, name').eq('user_id', userId).ilike('name', args.projectName).maybeSingle();
        if (proj) {
          projectId = proj.id;
          projectTag = proj.name;
        } else {
          projectTag = args.projectName;
        }
      } else {
        const active = await getActiveProject(supabase, userId);
        if (active) {
          projectId = active.id;
          projectTag = active.name;
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title,
          description: args.description || '',
          status: args.status || 'todo',
          priority: args.priority || 'medium',
          planned_date: plannedDate,
          tracked_seconds: 0,
          is_paused: false,
          project_id: projectId,
          project_tag: projectTag,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        success: true,
        message: `Created task "${task.title}" for ${task.planned_date} under storyline "${projectTag || 'General'}".`,
        task,
      };
    }

    case 'jarvis_update_task': {
      const target = await resolveTaskId(supabase, userId, args.taskId);
      if (!target) return { success: false, error: `Task "${args.taskId}" not found.` };

      const updates: Record<string, any> = { updated_at: nowISO };
      if (args.title) updates.title = args.title;
      if (args.status) updates.status = args.status;
      if (args.priority) updates.priority = args.priority;
      if (args.plannedDate) {
        updates.planned_date = args.plannedDate === 'today' ? todayISO : args.plannedDate === 'tomorrow' ? tomorrowISO : args.plannedDate;
      }
      if (args.trackedSeconds !== undefined) updates.tracked_seconds = args.trackedSeconds;

      // If status is being marked done, call rpc_complete_task to close time segment
      if (args.status === 'done') {
        await supabase.rpc('rpc_complete_task', {
          p_task_id: target.id,
          p_timestamp: nowISO,
          p_user_id: userId,
        });
      }

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', target.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, message: `Updated task "${updated.title}" (Status: ${updated.status}).`, task: updated };
    }

    case 'jarvis_delete_task': {
      const target = await resolveTaskId(supabase, userId, args.taskId);
      if (!target) return { success: false, error: `Task "${args.taskId}" not found.` };

      await supabase.from('task_time_entries').delete().eq('task_id', target.id);
      await supabase.from('task_status_history').delete().eq('task_id', target.id);
      const { error } = await supabase.from('tasks').delete().eq('id', target.id);

      if (error) throw error;
      return { success: true, message: `Deleted task "${target.title}".` };
    }

    case 'jarvis_carryover_tasks': {
      const targetDate = args.targetDate || todayISO;

      let taskList: any[] = [];
      if (Array.isArray(args.taskIds) && args.taskIds.length > 0) {
        for (const id of args.taskIds) {
          const t = await resolveTaskId(supabase, userId, id);
          if (t) taskList.push(t);
        }
      } else {
        // Query unfinished tasks from past dates
        const { data: pastUnfinished } = await supabase
          .from('tasks')
          .select('id, title, planned_date, status')
          .eq('user_id', userId)
          .lt('planned_date', todayISO)
          .neq('status', 'done');

        taskList = pastUnfinished || [];
      }

      if (taskList.length === 0) {
        return { success: true, message: 'No past unfinished tasks found to carry over.', carriedOverCount: 0 };
      }

      const ids = taskList.map((t) => t.id);
      const { error } = await supabase
        .from('tasks')
        .update({ planned_date: targetDate, updated_at: nowISO })
        .in('id', ids);

      if (error) throw error;
      return {
        success: true,
        carriedOverCount: taskList.length,
        tasks: taskList.map((t) => t.title),
        message: `Carried over ${taskList.length} unfinished tasks to ${targetDate}.`,
      };
    }

    case 'jarvis_get_daily_summary': {
      const dateVal = args.date === 'today' || !args.date ? todayISO : args.date;

      const activeProject = await getActiveProject(supabase, userId);

      // Tasks for date
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('planned_date', dateVal);

      const doneTasks = tasks?.filter((t: any) => t.status === 'done') || [];
      const inProgressTasks = tasks?.filter((t: any) => t.status === 'in_progress') || [];
      const todoTasks = tasks?.filter((t: any) => t.status === 'todo') || [];

      // Time entries for date
      const { data: timeEntries } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', `${dateVal}T00:00:00.000Z`)
        .lte('started_at', `${dateVal}T23:59:59.999Z`);

      let totalFocusSeconds = 0;
      timeEntries?.forEach((entry: any) => {
        const start = new Date(entry.started_at).getTime();
        const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now.getTime();
        totalFocusSeconds += Math.max(0, Math.floor((end - start) / 1000));
      });

      // Events for date
      const { data: events } = await supabase
        .from('events')
        .select('id, title, type, start_time, end_time')
        .eq('user_id', userId)
        .eq('date', dateVal);

      const focusHours = (totalFocusSeconds / 3600).toFixed(1);

      return {
        date: dateVal,
        activeProject: activeProject?.name || 'None',
        totalFocusHours: `${focusHours}h (${Math.round(totalFocusSeconds / 60)} minutes)`,
        tasksSummary: {
          total: tasks?.length || 0,
          done: doneTasks.length,
          inProgress: inProgressTasks.length,
          todo: todoTasks.length,
        },
        doneTaskTitles: doneTasks.map((t: any) => t.title),
        eventsSummary: events?.map((e: any) => `${e.title} (${e.start_time} - ${e.end_time || 'now'})`) || [],
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 2: CAREER LEDGER & WORK JOURNALS
    // ═════════════════════════════════════════════════════════════════════════

    case 'jarvis_create_work_journal': {
      const active = await getActiveProject(supabase, userId);
      const projectId = args.projectId || active?.id || null;
      const projectTag = args.projectName || active?.name || null;
      const eventDate = args.date || todayISO;
      const rawStatus = args.status || 'done';

      // Assemble strict 4-badge Google XYZ narrative with auto-bulleting
      const descriptionParts = [
        `🎯 Objective & Context\n${args.objective.trim()}`,
        `🛠️ Technical Execution [Doing Z]\n${toBulletPoints(args.technicalExecution)}`,
        `🏆 Key Accomplishments [Accomplished X]\n${toBulletPoints(args.keyAccomplishments)}`,
        `📊 Measured Impact & Metrics [Measured by Y]\n${toBulletPoints(args.measuredImpact)}`,
      ];
      if (args.nextMilestone) {
        const cleanMilestone = args.nextMilestone.trim().replace(/^[-*•]\s*/, '').replace(/^Planned next milestone \(Tomorrow\):\s*/i, '');
        descriptionParts[2] += `\n- Planned next milestone (Tomorrow): ${cleanMilestone}`;
      }
      const fullDescription = descriptionParts.join('\n\n');

      // 1. Create main event record
      const { data: eventRow, error: eventErr } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          date: eventDate,
          start_time: args.startTime,
          end_time: args.endTime,
          type: 'work',
          title: args.title,
          project_id: projectId,
          project_tag: projectTag,
        })
        .select('id')
        .single();

      if (eventErr) throw eventErr;
      const eventId = eventRow.id;

      // 2. Create work_details child record
      const { error: detailErr } = await supabase
        .from('work_details')
        .insert({
          event_id: eventId,
          description: fullDescription,
          implementation_notes: args.implementationNotes || '',
          status: rawStatus,
          links: [],
        });

      if (detailErr) throw detailErr;

      // 3. If linkedTaskId provided, update task to match status
      let linkedTaskTitle = null;
      if (args.linkedTaskId) {
        const target = await resolveTaskId(supabase, userId, args.linkedTaskId);
        if (target) {
          linkedTaskTitle = target.title;
          if (rawStatus === 'done') {
            await supabase.rpc('rpc_complete_task', {
              p_task_id: target.id,
              p_timestamp: nowISO,
              p_user_id: userId,
            });
          } else {
            await supabase
              .from('tasks')
              .update({
                status: 'in_progress',
                is_paused: true,
                updated_at: nowISO,
              })
              .eq('id', target.id);
          }
        }
      }

      return {
        success: true,
        eventId,
        message: `Work Journal created for "${args.title}" (${args.startTime} - ${args.endTime}) under project "${projectTag || 'General'}".`,
        linkedTaskUpdated: linkedTaskTitle,
      };
    }

    case 'jarvis_update_work_journal': {
      const target = await resolveEventId(supabase, userId, args.eventId);
      if (!target) return { success: false, error: `Work Journal "${args.eventId}" not found.` };

      const eventUpdates: Record<string, any> = { updated_at: nowISO };
      if (args.title) eventUpdates.title = args.title;
      if (args.startTime) eventUpdates.start_time = args.startTime;
      if (args.endTime) eventUpdates.end_time = args.endTime;

      if (Object.keys(eventUpdates).length > 1) {
        await supabase.from('events').update(eventUpdates).eq('id', target.id);
      }

      const detailUpdates: Record<string, any> = {};
      if (args.objective || args.technicalExecution || args.keyAccomplishments || args.measuredImpact) {
        const { data: existingDetail } = await supabase.from('work_details').select('*').eq('event_id', target.id).single();
        const descriptionParts = [
          `🎯 Objective & Context\n${(args.objective || '').trim()}`,
          `🛠️ Technical Execution [Doing Z]\n${toBulletPoints(args.technicalExecution || '')}`,
          `🏆 Key Accomplishments [Accomplished X]\n${toBulletPoints(args.keyAccomplishments || '')}`,
          `📊 Measured Impact & Metrics [Measured by Y]\n${toBulletPoints(args.measuredImpact || '')}`,
        ];
        detailUpdates.description = descriptionParts.join('\n\n');
      }
      if (args.implementationNotes !== undefined) detailUpdates.implementation_notes = args.implementationNotes;
      if (args.status) detailUpdates.status = args.status;

      if (Object.keys(detailUpdates).length > 0) {
        await supabase.from('work_details').update(detailUpdates).eq('event_id', target.id);
      }

      return { success: true, message: `Updated work journal for "${target.title}".` };
    }

    case 'jarvis_delete_work_journal': {
      const target = await resolveEventId(supabase, userId, args.eventId);
      if (!target) return { success: false, error: `Work Journal "${args.eventId}" not found.` };

      await supabase.from('work_details').delete().eq('event_id', target.id);
      const { error } = await supabase.from('events').delete().eq('id', target.id);
      if (error) throw error;

      return { success: true, message: `Deleted work journal "${target.title}".` };
    }

    case 'jarvis_search_journals': {
      const query = args.query.trim();
      const limit = Number(args.limit) || 10;

      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, date, start_time, end_time, type, project_tag')
        .eq('user_id', userId)
        .ilike('title', `%${query}%`)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return {
        count: events.length,
        results: events,
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 3: PROJECT STORYLINES
    // ═════════════════════════════════════════════════════════════════════════

    case 'jarvis_get_active_project': {
      const active = await getActiveProject(supabase, userId);
      if (!active) {
        return { activeProject: null, message: 'No active project currently set.' };
      }
      return {
        activeProject: {
          id: active.id,
          name: active.name,
          status: active.status,
          description: active.description,
        },
      };
    }

    case 'jarvis_switch_active_project': {
      const { projectName } = args;
      const { data: projects } = await supabase.from('projects').select('*').eq('user_id', userId);
      const match = projects?.find((p: any) => p.name.toLowerCase() === projectName.toLowerCase());
      if (match) {
        // Demote all others
        await supabase.from('projects').update({ status: 'completed' }).eq('user_id', userId).eq('status', 'active');
        await supabase.from('projects').update({ status: 'active' }).eq('id', match.id);
        return { success: true, message: `Switched active focus project to "${match.name}".` };
      }
      // Create new project if not exists
      await supabase.from('projects').update({ status: 'completed' }).eq('user_id', userId).eq('status', 'active');
      const { data: created, error } = await supabase
        .from('projects')
        .insert({ user_id: userId, name: projectName, status: 'active' })
        .select()
        .single();
      if (error) throw error;
      return { success: true, message: `Created and set active project to "${created.name}".` };
    }

    case 'jarvis_list_projects': {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return {
        count: projects.length,
        projects: projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          description: p.description,
          isActive: p.status === 'active',
        })),
      };
    }

    case 'jarvis_create_project': {
      const name = String(args.name).trim();
      const status = args.status || 'planned';

      if (status === 'active') {
        await supabase.from('projects').update({ status: 'completed' }).eq('user_id', userId).eq('status', 'active');
      }

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name,
          description: args.description || '',
          status,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        success: true,
        message: `Created project storyline "${project.name}" (Status: ${project.status}).`,
        project,
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 4: MEETINGS & ARCHITECTURAL SYNCS
    // ═════════════════════════════════════════════════════════════════════════

    case 'jarvis_log_meeting': {
      const active = await getActiveProject(supabase, userId);
      const projectId = active?.id || null;
      const projectTag = args.projectName || active?.name || null;
      const eventDate = args.date || todayISO;

      const { data: eventRow, error: eventErr } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          date: eventDate,
          start_time: args.startTime,
          end_time: args.endTime,
          type: 'meeting',
          title: args.title,
          project_id: projectId,
          project_tag: projectTag,
        })
        .select('id')
        .single();

      if (eventErr) throw eventErr;
      const eventId = eventRow.id;

      const actionItems = Array.isArray(args.actionItems) ? args.actionItems : [];
      const tasksAssigned = actionItems.map((ai: any) => ({
        text: typeof ai === 'string' ? ai : ai.text,
        done: false,
      }));

      const { error: detailErr } = await supabase
        .from('meeting_details')
        .insert({
          event_id: eventId,
          is_optional: false,
          discussion_summary: args.discussionSummary,
          decisions: args.decisions || '',
          tasks_assigned: tasksAssigned,
          links: [],
        });

      if (detailErr) throw detailErr;

      // Auto-create tasks from action items (default true)
      const createdTasks: string[] = [];
      if (args.createTasksFromActionItems !== false && actionItems.length > 0) {
        for (const item of actionItems) {
          const itemText = typeof item === 'string' ? item : item.text;
          const priority = typeof item === 'object' && item.priority ? item.priority : 'medium';
          const { data: t } = await supabase
            .from('tasks')
            .insert({
              user_id: userId,
              title: itemText,
              priority,
              status: 'todo',
              planned_date: tomorrowISO,
              project_id: projectId,
              project_tag: projectTag,
            })
            .select('title')
            .single();

          if (t) createdTasks.push(t.title);
        }
      }

      return {
        success: true,
        eventId,
        message: `Meeting Journal created for "${args.title}" with ${actionItems.length} action items.`,
        createdTasksForTomorrow: createdTasks,
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITE 5: MIND MAPS & KNOWLEDGE GRAPH
    // ═════════════════════════════════════════════════════════════════════════

    case 'jarvis_list_mindmaps': {
      const { data: maps, error } = await supabase
        .from('mindmaps')
        .select('id, title, emoji, color, node_count, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return {
        count: maps.length,
        mindmaps: maps,
      };
    }

    case 'jarvis_add_mindmap_node': {
      const map = await resolveMindmapId(supabase, userId, args.mapId);
      if (!map) return { success: false, error: `Mind Map "${args.mapId}" not found.` };

      const { data: node, error } = await supabase
        .from('nodes')
        .insert({
          map_id: map.id,
          user_id: userId,
          label: args.label,
          parent_id: args.parentNodeId || null,
          emoji: args.emoji || null,
          type: 'topic',
          order_index: (map.node_count || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment node_count on map
      await supabase
        .from('mindmaps')
        .update({
          node_count: (map.node_count || 0) + 1,
          updated_at: nowISO,
        })
        .eq('id', map.id);

      return {
        success: true,
        message: `Added node "${args.label}" to mindmap "${map.title}".`,
        nodeId: node.id,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── AUTHENTICATION & HANDLER ────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const mcpSecretKey = Deno.env.get('JARVIS_MCP_API_KEY') || 'jarvis_mcp_live_e82f7c19a4b';

    const url = new URL(req.url);
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() ||
                  url.searchParams.get('key') ||
                  url.searchParams.get('token') ||
                  url.searchParams.get('apikey') || '';

    let authenticatedUserId: string | null = null;

    // 1. Direct Secret API Key match
    if (token && (token === mcpSecretKey || token === supabaseServiceKey)) {
      authenticatedUserId = DEFAULT_USER_ID;
    } else if (token) {
      // 2. Validate Supabase JWT token
      const client = createClient(supabaseUrl, supabaseServiceKey);
      const { data: { user }, error: jwtError } = await client.auth.getUser(token);
      if (user && !jwtError) {
        authenticatedUserId = user.id;
      }
    }

    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 401,
            message: 'Unauthorized. Please provide a valid Bearer token in the Authorization header or ?key= param.',
          },
        }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));

    // ─── 1. MCP JSON-RPC 2.0 PROTOCOL ───────────────────────────────────────
    if (body.jsonrpc === '2.0') {
      const { id, method, params } = body;

      // Method: initialize
      if (method === 'initialize') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false },
              },
              serverInfo: {
                name: 'jarvis-cloud-mcp',
                version: '2.0.0',
              },
            },
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // Method: notifications/initialized
      if (method === 'notifications/initialized' || method === 'initialized') {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id, result: {} }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // Method: tools/list
      if (method === 'tools/list') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              tools: JARVIS_TOOLS,
            },
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // Method: tools/call
      if (method === 'tools/call') {
        const { name, arguments: toolArgs } = params || {};
        try {
          const toolResult = await executeTool(name, toolArgs || {}, supabase, authenticatedUserId);
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
                  },
                ],
                isError: false,
              },
            }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }],
                isError: true,
              },
            }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Method: ping
      if (method === 'ping') {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id, result: {} }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 2. DIRECT REST / OPENAPI FALLBACK (for ChatGPT Actions, curl) ───────
    const action = body.action || body.tool || (req.url.split('/').pop() !== 'jarvis-mcp' ? req.url.split('/').pop() : null);
    const args = body.arguments || body.args || body;

    if (action) {
      const toolName = action.startsWith('jarvis_') ? action : `jarvis_${action}`;
      const result = await executeTool(toolName, args, supabase, authenticatedUserId);
      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Default metadata landing
    return new Response(
      JSON.stringify({
        status: 'online',
        service: 'Jarvis Cloud MCP Server (Headless Personal OS)',
        protocol: 'Model Context Protocol (MCP) 2024-11-05',
        totalTools: JARVIS_TOOLS.length,
        availableTools: JARVIS_TOOLS.map((t) => t.name),
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
