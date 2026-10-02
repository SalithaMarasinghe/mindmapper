// ═══════════════════════════════════════════════════════════════════════════════
// Jarvis Cloud MCP Server (Supabase Edge Function)
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

// ─── TOOL DEFINITIONS (MCP Standard Schema) ──────────────────────────────────

const JARVIS_TOOLS = [
  {
    name: 'jarvis_create_work_journal',
    description: 'Logs an engineering work session into Salitha\'s Work Journal / Career Ledger using Google XYZ format. Automatically attaches to the active focus project storyline and updates any linked Kanban task.',
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
    name: 'jarvis_list_tasks',
    description: 'Lists tasks on Salitha\'s Kanban task board with status, priority, and tracked duration.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Filter by status: "todo", "in_progress", or "done". Leave empty to list all open tasks.',
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
          description: 'Planned date in YYYY-MM-DD format, or "tomorrow" to automatically schedule for tomorrow.',
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
    description: 'Updates task status, timer state (pause/resume), or marks a task as complete.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'UUID or exact title of the task.',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'New status.',
        },
        isPaused: {
          type: 'boolean',
          description: 'True to pause the running timer, false to resume.',
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
    name: 'jarvis_log_meeting',
    description: 'Logs an architectural sync, supervisor meeting, or standup with decisions and action items.',
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
        projectName: {
          type: 'string',
          description: 'Project storyline name.',
        },
      },
      required: ['title', 'startTime', 'endTime', 'discussionSummary'],
    },
  },
];

// ─── DATABASE ACTIONS ────────────────────────────────────────────────────────

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

async function resolveTaskId(supabase: any, userId: string, identifier: string): Promise<{ id: string; title: string } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUUID) {
    const { data } = await supabase.from('tasks').select('id, title').eq('id', identifier).eq('user_id', userId).maybeSingle();
    return data || null;
  }
  const clean = identifier.replace(/\b(the|task|my)\b/gi, '').trim();
  const { data } = await supabase.from('tasks').select('id, title').eq('user_id', userId).ilike('title', `%${clean || identifier}%`).limit(1);
  return data?.[0] || null;
}

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

async function executeTool(name: string, args: Record<string, any>, supabase: any, userId: string) {
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const tomorrowISO = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  switch (name) {
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
        await supabase.from('projects').update({ status: 'active' }).eq('id', match.id);
        return { success: true, message: `Switched active focus project to "${match.name}".` };
      }
      // Create new project if not exists
      const { data: created, error } = await supabase
        .from('projects')
        .insert({ user_id: userId, name: projectName, status: 'active' })
        .select()
        .single();
      if (error) throw error;
      return { success: true, message: `Created and set active project to "${created.name}".` };
    }

    case 'jarvis_list_tasks': {
      let query = supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (args.status) query = query.eq('status', args.status);
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

      const updates: Record<string, any> = { updated_at: now.toISOString() };
      if (args.status) updates.status = args.status;
      if (args.isPaused !== undefined) updates.is_paused = args.isPaused;
      if (args.trackedSeconds !== undefined) updates.tracked_seconds = args.trackedSeconds;

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', target.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, message: `Updated task "${updated.title}" (Status: ${updated.status}).`, task: updated };
    }

    case 'jarvis_create_work_journal': {
      const active = await getActiveProject(supabase, userId);
      const projectId = args.projectId || active?.id || null;
      const projectTag = args.projectName || active?.name || null;
      const eventDate = args.date || todayISO;
      const rawStatus = args.status || 'done';

      // Assemble strict 4-badge Google XYZ narrative
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
          await supabase
            .from('tasks')
            .update({
              status: rawStatus === 'done' ? 'done' : 'in_progress',
              is_paused: true,
              updated_at: now.toISOString(),
            })
            .eq('id', target.id);
        }
      }

      return {
        success: true,
        eventId,
        message: `Work Journal created for "${args.title}" (${args.startTime} - ${args.endTime}) under project "${projectTag || 'General'}".`,
        linkedTaskUpdated: linkedTaskTitle,
      };
    }

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

      return {
        success: true,
        eventId,
        message: `Meeting Journal created for "${args.title}" with ${actionItems.length} action items.`,
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

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

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
            message: 'Unauthorized. Please provide a valid Bearer token in the Authorization header.',
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
                version: '1.0.0',
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
        service: 'Jarvis Cloud MCP Server',
        protocol: 'Model Context Protocol (MCP) 2024-11-05',
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
