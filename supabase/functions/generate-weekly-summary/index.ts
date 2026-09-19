// Supabase Edge Function: generate-weekly-summary
// Runtime: Deno (Supabase Edge Runtime)
// Secrets required (set via `supabase secrets set`):
//   GROQ_API_KEY        — Groq API key
//   SUPABASE_URL        — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types (mirrored from the DB schema) ─────────────────────────────────────

interface EventRow {
  id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: 'work' | 'meeting';
  title: string;
  project_tag: string | null;
  chain_id: string | null;
  previous_event_id: string | null;
  work_details: WorkDetailsRow | null;
  meeting_details: MeetingDetailsRow | null;
}

interface WorkDetailsRow {
  description: string;
  implementation_notes: string;
  status: 'done' | 'in_progress' | 'blocked';
  links: { label: string; url: string }[];
}

interface MeetingDetailsRow {
  is_optional: boolean;
  discussion_summary: string;
  tasks_assigned: { text: string; done: boolean }[];
  decisions: string;
  links: { label: string; url: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMin(end) - toMin(start);
}

/** Convert a list of events into a human-readable markdown block for the prompt */
function renderChainBlock(events: EventRow[], chainLabel: string): string {
  const lines: string[] = [`### ${chainLabel}`];

  for (const ev of events) {
    const timeStr = ev.start_time
      ? ` (${formatTime(ev.start_time)}${ev.end_time ? `–${formatTime(ev.end_time)}` : ''})`
      : '';
    const dur = durationMinutes(ev.start_time, ev.end_time);
    const durStr = dur ? ` [${dur} min]` : '';
    const tag = ev.project_tag ? ` [${ev.project_tag}]` : '';

    lines.push(`**${ev.date}${timeStr}${durStr}${tag} — ${ev.title}** (${ev.type})`);

    if (ev.type === 'work' && ev.work_details) {
      const wd = ev.work_details;
      lines.push(`- Status: ${wd.status}`);
      if (wd.description)           lines.push(`- What: ${wd.description}`);
      if (wd.implementation_notes)  lines.push(`- Notes: ${wd.implementation_notes}`);
      if (wd.links.length)          lines.push(`- Links: ${wd.links.map(l => l.label || l.url).join(', ')}`);
    }

    if (ev.type === 'meeting' && ev.meeting_details) {
      const md = ev.meeting_details;
      if (md.is_optional)           lines.push(`- (Optional attendance)`);
      if (md.discussion_summary)    lines.push(`- Discussion: ${md.discussion_summary}`);
      if (md.decisions)             lines.push(`- Decisions: ${md.decisions}`);
      const openTasks = md.tasks_assigned.filter(t => !t.done);
      if (openTasks.length)         lines.push(`- Open tasks: ${openTasks.map(t => t.text).join('; ')}`);
      const doneTasks = md.tasks_assigned.filter(t => t.done);
      if (doneTasks.length)         lines.push(`- Completed tasks: ${doneTasks.map(t => t.text).join('; ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function buildPrompt(
  weekStartDate: string,
  chains: EventRow[][],
  standaloneEvents: EventRow[],
): { systemPrompt: string; userPrompt: string } {
  const sections: string[] = [];

  if (chains.length > 0) {
    sections.push('## Chained Work Threads (multi-day tasks treated as one unit)\n');
    chains.forEach((chain, i) => {
      const projectTags = [...new Set(chain.map(e => e.project_tag).filter(Boolean))];
      const label = projectTags.length
        ? `Thread ${i + 1} — ${projectTags.join(' / ')}`
        : `Thread ${i + 1} — ${chain[0].title}`;
      sections.push(renderChainBlock(chain, label));
    });
  }

  if (standaloneEvents.length > 0) {
    sections.push('## Standalone Events\n');
    sections.push(renderChainBlock(standaloneEvents, 'Individual events'));
  }

  const eventData = sections.join('\n');

  const systemPrompt = `You are a professional engineering productivity assistant writing a structured weekly summary for a software engineer.

Write a structured weekly summary with these exact sections:

**1. Work Completed**
- Group chained events (multi-day threads) into a single narrative item — describe what was accomplished across the chain as a whole, not each day separately.
- List standalone work events individually.
- For each item, note the project tag and estimated total time if available.
- Note the final status (Done / In Progress / Blocked).

**2. Meetings Attended**
- List each meeting with a 1–2 sentence summary of what was discussed and any decisions made.
- Mark optional meetings as "(optional)".
- List any open action items assigned.

**3. Time by Project/Tag**
- A simple table: Project | Estimated Hours | Notes
- Sum time across all events per project tag. If time data is missing, estimate based on typical durations.

**4. Weekly Highlights**
- 2–4 bullet points: the most significant things accomplished or decided this week.

**5. Blockers & Risks**
- Any blocked work items and why they are blocked.
- Leave this section blank (write "None identified.") if no blocked events exist.

Write in a clear, professional, first-person style. Be specific — use the actual event titles and project names from the data. Do not add fictional information.`;

  const userPrompt = `Week of: ${weekStartDate}\n\nHere is the raw event data for this week:\n\n${eventData}`;

  return { systemPrompt, userPrompt };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS — allow calls from the Vite dev server and Vercel production
  const origin = req.headers.get('origin') ?? '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // ── Auth: extract JWT from Authorization header ──────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwt = authHeader.slice(7);

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { week_start_date } = body as { week_start_date: string };

    if (!week_start_date || !/^\d{4}-\d{2}-\d{2}$/.test(week_start_date)) {
      return new Response(JSON.stringify({ error: 'week_start_date (YYYY-MM-DD) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Derive week end (Sunday if starting Monday, or +6 days)
    const weekStart = new Date(week_start_date + 'T00:00:00Z');
    const weekEnd   = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const weekEndDate = weekEnd.toISOString().slice(0, 10);

    // ── Supabase client with user's JWT (respects RLS) ────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );

    // Resolve the user_id from the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired JWT' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    // ── Fetch events for the week ─────────────────────────────────────────
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*, work_details(*), meeting_details(*)')
      .eq('user_id', userId)
      .gte('date', week_start_date)
      .lte('date', weekEndDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true });

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ error: 'No events found for this week.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Group: chains vs standalone ───────────────────────────────────────
    const chainMap = new Map<string, EventRow[]>();
    const standaloneEvents: EventRow[] = [];

    for (const ev of events as EventRow[]) {
      if (ev.chain_id) {
        if (!chainMap.has(ev.chain_id)) chainMap.set(ev.chain_id, []);
        chainMap.get(ev.chain_id)!.push(ev);
      } else {
        standaloneEvents.push(ev);
      }
    }

    // Only treat as a chain if ≥2 events share a chain_id
    const chains: EventRow[][] = [];
    for (const [, chainEvents] of chainMap) {
      if (chainEvents.length >= 2) {
        chains.push(chainEvents);
      } else {
        standaloneEvents.push(...chainEvents);
      }
    }

    // ── Build prompt + call Groq ──────────────────────────────────────────
    const { systemPrompt, userPrompt } = buildPrompt(week_start_date, chains, standaloneEvents);

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) throw new Error('GROQ_API_KEY secret is not set');

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[generate-weekly-summary] Groq API error response:', errText);
      throw new Error(`Groq API error ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const generatedText: string = groqData.choices?.[0]?.message?.content ?? '';
    if (!generatedText) throw new Error('Groq returned an empty response');

    // ── Collect source event IDs ───────────────────────────────────────────
    const sourceEventIds = (events as EventRow[]).map(e => e.id);

    // ── Upsert into weekly_summaries ──────────────────────────────────────
    // Use service role client for the upsert so it bypasses the anon key limit
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: existing } = await supabaseAdmin
      .from('weekly_summaries')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start_date', week_start_date)
      .maybeSingle();

    let summary, upsertError;
    if (existing) {
      const res = await supabaseAdmin
        .from('weekly_summaries')
        .update({
          generated_text: generatedText,
          source_event_ids: sourceEventIds,
        })
        .eq('id', existing.id)
        .select()
        .single();
      summary = res.data;
      upsertError = res.error;
    } else {
      const res = await supabaseAdmin
        .from('weekly_summaries')
        .insert({
          user_id: userId,
          week_start_date: week_start_date,
          generated_text: generatedText,
          source_event_ids: sourceEventIds,
        })
        .select()
        .single();
      summary = res.data;
      upsertError = res.error;
    }

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[generate-weekly-summary]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
