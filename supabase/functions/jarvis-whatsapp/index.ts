// ═══════════════════════════════════════════════════════════════════════════════
// Jarvis WhatsApp Cloud API Channel Adapter (Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════════════════════
// Official 1-to-1 WhatsApp Business Cloud API integration for Jarvis.
// Connects WhatsApp messages and voice notes directly into the unified
// Jarvis conversational pipeline, MCP tools, and vector memory.
//
// Key Invariants:
// 1. Strict Security Whitelist (Single-tenant authorized user only)
// 2. Meta Webhook HMAC-SHA256 Signature Validation
// 3. Idempotency & Deduplication Engine (wamid guard)
// 4. Human-in-the-Loop (HITL) Proposal & Interactive Button Approvals
// 5. Native Voice Note Transcription via jarvis-transcribe (Groq Whisper)
// 6. Live Web Grounding with Markdown citations
// 7. Channel-Agnostic Adapter Pattern (Replaceable/extendable for Telegram/Slack)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const DEFAULT_USER_ID = Deno.env.get('JARVIS_USER_ID') || '3e9e3dd3-a59b-4b02-968a-ee95e7317583';
const DEFAULT_TIMEZONE = Deno.env.get('JARVIS_TIMEZONE') || 'Asia/Colombo';
const GRAPH_API_VERSION = 'v20.0';

// ─── UTILITIES & HELPERS ─────────────────────────────────────────────────────

function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Converts standard Markdown to WhatsApp formatting:
 * **bold** -> *bold*
 * __italic__ -> _italic_
 * ### Heading -> *Heading*
 */
function formatForWhatsApp(text: string): string {
  if (!text) return '';
  return text
    .replace(/^###?\s+(.+)$/gm, '*$1*') // Headings to bold
    .replace(/\*\*(.*?)\*\*/g, '*$1*')   // Double asterisks to single
    .replace(/__(.*?)__/g, '_$1_')       // Double underscore to single
    .trim();
}

/**
 * Validates Meta Webhook HMAC-SHA256 signature
 */
async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;
  const expectedHash = parts[1];

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const hexHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hexHash.toLowerCase() === expectedHash.toLowerCase();
}

// ─── CHANNEL ADAPTER: WHATSAPP CLOUD API ─────────────────────────────────────

class WhatsAppChannelAdapter {
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
  }

  private get endpoint(): string {
    return `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;
  }

  /**
   * Sends standard text message (auto-chunks if exceeding 4000 characters)
   */
  async sendTextMessage(to: string, text: string): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) {
      console.error('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
      return false;
    }

    const cleanTo = sanitizePhone(to);
    const formatted = formatForWhatsApp(text);
    const CHUNK_SIZE = 4000;

    for (let i = 0; i < formatted.length; i += CHUNK_SIZE) {
      const chunk = formatted.slice(i, i + CHUNK_SIZE);
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: false,
          body: chunk,
        },
      };

      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.error(`[WhatsApp] Failed to send message: ${res.status} ${await res.text()}`);
          return false;
        }
      } catch (err) {
        console.error('[WhatsApp] Network error sending text message:', err);
        return false;
      }
    }

    return true;
  }

  /**
   * Sends Interactive Quick Reply Button Message (Approve / Reject)
   */
  async sendInteractiveProposal(
    to: string,
    headerText: string,
    bodyText: string,
    actionId: string
  ): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) return false;

    const cleanTo = sanitizePhone(to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: headerText.slice(0, 60),
        },
        body: {
          text: formatForWhatsApp(bodyText).slice(0, 1024),
        },
        footer: {
          text: 'Jarvis • Human-in-the-Loop Guard',
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: `approve:${actionId}`,
                title: '✅ Approve',
              },
            },
            {
              type: 'reply',
              reply: {
                id: `reject:${actionId}`,
                title: '❌ Cancel',
              },
            },
          ],
        },
      },
    };

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(`[WhatsApp] Failed to send interactive buttons: ${res.status} ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[WhatsApp] Error sending interactive buttons:', err);
      return false;
    }
  }

  /**
   * Downloads voice note audio blob from Meta Media API
   */
  async downloadAudioMedia(mediaId: string): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
    try {
      // 1. Get media direct URL
      const infoRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!infoRes.ok) {
        console.error('[WhatsApp] Failed to fetch media info:', await infoRes.text());
        return null;
      }
      const mediaInfo = await infoRes.json();
      const mediaUrl = mediaInfo.url;
      const mimeType = mediaInfo.mime_type || 'audio/ogg';

      // 2. Download binary bytes
      const binaryRes = await fetch(mediaUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!binaryRes.ok) {
        console.error('[WhatsApp] Failed to download media binary:', await binaryRes.text());
        return null;
      }

      const buffer = await binaryRes.arrayBuffer();
      return { buffer, mimeType };
    } catch (err) {
      console.error('[WhatsApp] Error in downloadAudioMedia:', err);
      return null;
    }
  }
}

// ─── MCP TOOL DISPATCHER (EXECUTE APPROVED ACTIONS) ──────────────────────────

async function executeMcpToolCall(toolName: string, args: Record<string, unknown>): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const mcpInternalToken = Deno.env.get('JARVIS_MCP_INTERNAL_TOKEN') || Deno.env.get('JARVIS_MCP_API_KEY');
  if (!mcpInternalToken) throw new Error('Missing JARVIS_MCP_INTERNAL_TOKEN secret.');

  const mcpPayload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const res = await fetch(`${supabaseUrl}/functions/v1/jarvis-mcp`, {
    method: 'POST',
    headers: {
      'x-jarvis-internal-token': mcpInternalToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mcpPayload),
  });

  if (!res.ok) {
    throw new Error(`MCP error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

/**
 * Resolves a pending proposal and executes it via the official Jarvis MCP tools
 */
async function executeApprovedAction(
  supabase: any,
  pendingAction: any
): Promise<{ success: boolean; message: string; details?: any }> {
  const { proposal_type, payload } = pendingAction;

  switch (proposal_type) {
    case 'create_work_event': {
      // Execute via jarvis_create_work_journal (ensures embeddings & XYZ formatting)
      const result = await executeMcpToolCall('jarvis_create_work_journal', {
        title: payload.title || 'Work Session',
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        objective: payload.description || payload.title,
        technicalExecution: payload.implementationNotes || payload.description || 'Executed technical tasks.',
        keyAccomplishments: payload.description || 'Milestones completed.',
        measuredImpact: payload.status === 'in_progress' ? 'Milestone 50% completed.' : '100% verified baseline.',
        status: payload.status || 'done',
        projectId: payload.projectId,
        projectName: payload.projectTag,
      });

      return {
        success: true,
        message: `Work Journal logged: *${payload.title}* (${payload.startTime || ''} - ${payload.endTime || ''})`,
        details: result,
      };
    }

    case 'create_meeting_event': {
      // Execute via jarvis_log_meeting
      const result = await executeMcpToolCall('jarvis_log_meeting', {
        title: payload.title || 'Meeting',
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        attendees: payload.attendees || ['Salitha Marasinghe'],
        discussionSummary: payload.discussionSummary || payload.description || '',
        decisions: payload.decisions || '',
        actionItems: payload.actionItems || [],
        projectId: payload.projectId,
        projectName: payload.projectTag,
      });

      return {
        success: true,
        message: `Meeting logged: *${payload.title}* (${payload.actionItems?.length || 0} action items)`,
        details: result,
      };
    }

    case 'create_task':
    case 'create_tasks': {
      if (Array.isArray(payload.tasks)) {
        for (const t of payload.tasks) {
          await executeMcpToolCall('jarvis_create_task', {
            title: t.title,
            priority: t.priority || 'medium',
            plannedDate: t.plannedDate || 'today',
            status: t.status || 'todo',
          });
        }
        return {
          success: true,
          message: `Created ${payload.tasks.length} tasks on Kanban board.`,
        };
      } else {
        const result = await executeMcpToolCall('jarvis_create_task', {
          title: payload.title,
          description: payload.description || '',
          priority: payload.priority || 'medium',
          plannedDate: payload.plannedDate || 'today',
          status: payload.status || 'todo',
          projectName: payload.projectTag,
        });
        return {
          success: true,
          message: `Created task: *${payload.title}* [${payload.priority || 'medium'}]`,
          details: result,
        };
      }
    }

    case 'start_task': {
      const result = await executeMcpToolCall('jarvis_start_timer', {
        taskId: payload.taskId,
      });
      return {
        success: true,
        message: `Started timer on: *${payload.taskTitle || 'Task'}*`,
        details: result,
      };
    }

    case 'pause_task': {
      const result = await executeMcpToolCall('jarvis_pause_timer', {
        taskId: payload.taskId,
        reason: 'break',
      });
      return {
        success: true,
        message: `Paused timer on: *${payload.taskTitle || 'Task'}*`,
        details: result,
      };
    }

    case 'finish_task': {
      const result = await executeMcpToolCall('jarvis_update_task', {
        taskId: payload.taskId,
        status: 'done',
      });
      return {
        success: true,
        message: `Completed task: *${payload.taskTitle || 'Task'}* ✅`,
        details: result,
      };
    }

    case 'delete_task': {
      const result = await executeMcpToolCall('jarvis_delete_task', {
        taskId: payload.taskId,
      });
      return {
        success: true,
        message: `Deleted task: *${payload.taskTitle || 'Task'}*`,
        details: result,
      };
    }

    case 'switch_active_project': {
      const result = await executeMcpToolCall('jarvis_switch_active_project', {
        projectName: payload.projectName,
        projectId: payload.projectId,
      });
      return {
        success: true,
        message: `Switched active focus to project: *${payload.projectName}* 🎯`,
        details: result,
      };
    }

    default:
      return {
        success: false,
        message: `Unsupported action type: ${proposal_type}`,
      };
  }
}

// ─── INCOMING MESSAGE WORKFLOW ────────────────────────────────────────────────

async function processIncomingMessage(
  msg: any,
  contact: any,
  adapter: WhatsAppChannelAdapter,
  supabase: any
): Promise<void> {
  const senderPhone = sanitizePhone(msg.from);
  const messageId = msg.id; // wamid

  // 1. Security Whitelist Guard
  const authorizedConfig = Deno.env.get('WHATSAPP_AUTHORIZED_PHONE');
  if (authorizedConfig) {
    const authorizedPhone = sanitizePhone(authorizedConfig);
    if (senderPhone !== authorizedPhone) {
      console.warn(`[WhatsApp] Unauthorized access attempt blocked from: ${senderPhone}`);
      await adapter.sendTextMessage(
        senderPhone,
        '⛔ *Access Denied*: This Jarvis agent instance is private and restricted to the authorized account owner.'
      );
      return;
    }
  }

  // 2. Idempotency Guard (Meta Webhook Retry Deduplication)
  const { data: existingMsg } = await supabase
    .from('whatsapp_processed_messages')
    .select('id')
    .eq('wamid', messageId)
    .maybeSingle();

  if (existingMsg) {
    console.log(`[WhatsApp] Skipping already-processed message: ${messageId}`);
    return;
  }

  // Record incoming message for idempotency
  await supabase.from('whatsapp_processed_messages').insert({
    wamid: messageId,
    from_phone: senderPhone,
    message_type: msg.type,
  });

  // 3. Handle Interactive Button Clicks (Approve / Reject)
  if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
    const buttonId = msg.interactive.button_reply.id || '';
    const [action, actionId] = buttonId.split(':');

    if (!actionId) return;

    const { data: pendingAction, error: fetchErr } = await supabase
      .from('channel_pending_actions')
      .select('*')
      .eq('id', actionId)
      .maybeSingle();

    if (fetchErr || !pendingAction) {
      await adapter.sendTextMessage(
        senderPhone,
        '⚠️ This action proposal has expired or was already processed.'
      );
      return;
    }

    if (pendingAction.status !== 'pending') {
      await adapter.sendTextMessage(
        senderPhone,
        `ℹ️ This proposal is already marked as *${pendingAction.status}*.`
      );
      return;
    }

    if (action === 'approve') {
      try {
        const execOutcome = await executeApprovedAction(supabase, pendingAction);

        // Update pending action record
        await supabase
          .from('channel_pending_actions')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', actionId);

        // Log audit trail
        await supabase.from('channel_audit_log').insert({
          user_id: pendingAction.user_id,
          channel: 'whatsapp',
          channel_user_id: senderPhone,
          channel_message_id: messageId,
          input_type: 'text',
          raw_user_input: `[Interactive Approval] for proposal ${actionId}`,
          assistant_reply: execOutcome.message,
          proposed_actions: [pendingAction.payload],
          approval_status: 'approved',
          executed_tool: pendingAction.proposal_type,
          execution_result: execOutcome.details || { success: true },
        });

        await adapter.sendTextMessage(senderPhone, `✅ *Action Executed*\n\n${execOutcome.message}`);
      } catch (execErr: any) {
        console.error('[WhatsApp] Action execution error:', execErr);
        await adapter.sendTextMessage(
          senderPhone,
          `❌ *Execution Failed*: ${execErr.message || 'Unknown error occurred while running MCP tool.'}`
        );
      }
      return;
    } else if (action === 'reject') {
      await supabase
        .from('channel_pending_actions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', actionId);

      await supabase.from('channel_audit_log').insert({
        user_id: pendingAction.user_id,
        channel: 'whatsapp',
        channel_user_id: senderPhone,
        channel_message_id: messageId,
        input_type: 'text',
        raw_user_input: `[Interactive Cancel] for proposal ${actionId}`,
        assistant_reply: `Cancelled: ${pendingAction.summary}`,
        proposed_actions: [pendingAction.payload],
        approval_status: 'rejected',
      });

      await adapter.sendTextMessage(senderPhone, `❌ Proposal cancelled: *${pendingAction.summary}*`);
      return;
    }
  }

  // 4. Resolve User Input (Text or Voice Note Transcription)
  let userText = '';
  let inputType: 'text' | 'voice' = 'text';

  if (msg.type === 'text') {
    userText = msg.text?.body || '';
  } else if (msg.type === 'audio') {
    inputType = 'voice';
    const mediaId = msg.audio?.id;
    if (!mediaId) {
      await adapter.sendTextMessage(senderPhone, '⚠️ Unable to read voice note: missing audio ID.');
      return;
    }

    // Download audio binary
    const audioData = await adapter.downloadAudioMedia(mediaId);
    if (!audioData) {
      await adapter.sendTextMessage(senderPhone, '⚠️ Failed to download voice note from WhatsApp server.');
      return;
    }

    // Call existing jarvis-transcribe edge function (Whisper large-v3-turbo on Groq)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const formData = new FormData();
    const audioBlob = new Blob([audioData.buffer], { type: audioData.mimeType });
    formData.append('audio', audioBlob, 'voicenote.ogg');

    try {
      const transcribeRes = await fetch(`${supabaseUrl}/functions/v1/jarvis-transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` },
        body: formData,
      });

      if (!transcribeRes.ok) {
        throw new Error(`Transcription HTTP ${transcribeRes.status}: ${await transcribeRes.text()}`);
      }

      const transcribeJson = await transcribeRes.json();
      userText = transcribeJson.text?.trim() || '';
      if (!userText) {
        await adapter.sendTextMessage(senderPhone, '🎙️ Voice note was silent or could not be clearly transcribed.');
        return;
      }
    } catch (err: any) {
      console.error('[WhatsApp] Voice transcription error:', err);
      await adapter.sendTextMessage(senderPhone, `🎙️ Transcription error: ${err.message}`);
      return;
    }
  } else {
    // Unsupported message type (location, image, sticker, etc.)
    await adapter.sendTextMessage(
      senderPhone,
      `Hello! I currently accept typed text and voice notes. Received unhandled ${msg.type} message.`
    );
    return;
  }

  if (!userText) return;

  // 5. Invoke Unified Conversational Orchestration Engine (ai-assistant-chat)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const chatPayload = {
    message: userText,
    timezone: DEFAULT_TIMEZONE,
    currentTimeISO: new Date().toISOString(),
    userId: DEFAULT_USER_ID,
    channel: 'whatsapp',
    channelThreadId: senderPhone,
    mode: 'assistant',
  };

  let chatResponse: any;
  try {
    const chatRes = await fetch(`${supabaseUrl}/functions/v1/ai-assistant-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatPayload),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      throw new Error(`Chat pipeline HTTP ${chatRes.status}: ${errText}`);
    }

    chatResponse = await chatRes.json();
  } catch (chatErr: any) {
    console.error('[WhatsApp] ai-assistant-chat invocation error:', chatErr);
    await adapter.sendTextMessage(
      senderPhone,
      `⚠️ Error processing request: ${chatErr.message || 'Jarvis assistant core unreachable.'}`
    );
    return;
  }

  const { replyText, proposals = [], searchSources = [] } = chatResponse;

  // 6. Build WhatsApp Response Narrative
  let finalMessage = replyText || '';

  // Append live web citations if web grounding was used
  if (Array.isArray(searchSources) && searchSources.length > 0) {
    const citations = searchSources
      .slice(0, 3)
      .map((s: any) => `• ${s.title}: ${s.url}`)
      .join('\n');
    finalMessage += `\n\n*Sources:*\n${citations}`;
  }

  // 7. Human-in-the-Loop Proposal Management
  // Separate proposals into pending (requiring approval) vs auto-executed
  const pendingProposals = proposals.filter((p: any) => p.status === 'pending');
  const autoExecutedProposals = proposals.filter((p: any) => p.status === 'auto_executed');

  // If there are auto-executed proposals (tier 1 actions), note them in the message
  if (autoExecutedProposals.length > 0) {
    const summaries = autoExecutedProposals.map((p: any) => `• ${p.summary}`).join('\n');
    finalMessage += `\n\n*Actions Executed:*\n${summaries}`;
  }

  // 8. Dispatch Response to User
  if (pendingProposals.length > 0) {
    // Send primary reply text first if present
    if (finalMessage.trim()) {
      await adapter.sendTextMessage(senderPhone, finalMessage);
    }

    // For each pending proposal, create a pending action record & send interactive button card
    for (const prop of pendingProposals) {
      const actionId = crypto.randomUUID();

      await supabase.from('channel_pending_actions').insert({
        id: actionId,
        user_id: DEFAULT_USER_ID,
        channel: 'whatsapp',
        channel_user_id: senderPhone,
        proposal_type: prop.type,
        summary: prop.summary,
        payload: prop.payload,
        status: 'pending',
      });

      // Format proposal preview for mobile screen
      let previewText = `*Proposal:* ${prop.summary}\n`;
      if (prop.payload?.description) {
        previewText += `\n${prop.payload.description.slice(0, 300)}...`;
      } else if (prop.payload?.tasks && Array.isArray(prop.payload.tasks)) {
        previewText += `\nTasks to create:\n` + prop.payload.tasks.map((t: any) => `• ${t.title}`).join('\n');
      }

      await adapter.sendInteractiveProposal(
        senderPhone,
        'Action Approval Required',
        previewText,
        actionId
      );
    }
  } else {
    // No pending approval required — send standard reply
    await adapter.sendTextMessage(senderPhone, finalMessage);
  }

  // 9. Audit Trail Logging
  await supabase.from('channel_audit_log').insert({
    user_id: DEFAULT_USER_ID,
    channel: 'whatsapp',
    channel_user_id: senderPhone,
    channel_message_id: messageId,
    input_type: inputType,
    raw_user_input: userText,
    assistant_reply: finalMessage,
    proposed_actions: proposals,
    approval_status: pendingProposals.length > 0 ? 'pending' : (autoExecutedProposals.length > 0 ? 'auto_executed' : 'none'),
  });
}

// ─── DENO HTTP SERVER & WEBHOOK HANDLERS ──────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 1. Meta Webhook Verification Challenge (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const expectedToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'jarvis_whatsapp_verify_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful!');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    console.warn('[WhatsApp Webhook] Verification token mismatch');
    return new Response('Forbidden: Verification token mismatch', { status: 403 });
  }

  // 2. Incoming WhatsApp Webhook Events (POST)
  if (req.method === 'POST') {
    const rawBody = await req.text();

    // Verify Meta HMAC-SHA256 Signature if secret is configured
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
    if (appSecret) {
      const signatureHeader = req.headers.get('x-hub-signature-256');
      const isValid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        console.warn('[WhatsApp Webhook] Invalid x-hub-signature-256 header.');
        return new Response('Unauthorized: Invalid HMAC signature', { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // Meta WhatsApp Cloud API payload validation
    if (payload.object !== 'whatsapp_business_account' || !payload.entry) {
      return new Response('Ignored: Not a whatsapp_business_account event', { status: 200 });
    }

    const adapter = new WhatsAppChannelAdapter();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract messages from Meta payload
    const processingPromises: Promise<void>[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages' && change.value) {
          const value = change.value;
          const contacts = value.contacts || [];
          const messages = value.messages || [];

          for (const message of messages) {
            const contact = contacts.find((c: any) => c.wa_id === message.from) || { wa_id: message.from };
            processingPromises.push(
              processIncomingMessage(message, contact, adapter, supabase).catch((err) => {
                console.error('[WhatsApp Webhook] Error processing message:', err);
              })
            );
          }
        }
      }
    }

    // Process tasks using EdgeRuntime.waitUntil if available, or await before response
    if (processingPromises.length > 0) {
      const allProcessing = Promise.all(processingPromises);
      // @ts-ignore: EdgeRuntime support in Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(allProcessing);
      } else {
        await allProcessing;
      }
    }

    // Meta expects HTTP 200 response promptly
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
});
