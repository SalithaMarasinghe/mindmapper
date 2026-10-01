import type { EmailMessage, ParsedMeeting } from '../types';

// Regular expressions to detect video conference URLs
const GOOGLE_MEET_REGEX = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i;
const ZOOM_REGEX = /https:\/\/[a-z0-9\-_.]*zoom\.us\/[j|my]\/[a-z0-9?=._\-]+/i;
const TEAMS_REGEX = /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i;

/**
 * Clean and format dates relative to today
 */
function getTodayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getTomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Intelligent parser that extracts meeting details from an email subject and body
 */
export function extractMeetingFromEmail(
  subject: string,
  body: string,
  sender: string,
  dateHeader?: string
): ParsedMeeting | null {
  const fullText = `${subject}\n${body}`;

  // Check if this looks like a meeting invitation
  const isMeetingInvite =
    /invitation|calendar|meeting|standup|sync|catchup|discussion|1-on-1|review|demo|grooming/i.test(
      subject
    ) ||
    GOOGLE_MEET_REGEX.test(fullText) ||
    ZOOM_REGEX.test(fullText) ||
    TEAMS_REGEX.test(fullText) ||
    /scheduled a meeting|invited you to|meeting link|join meeting/i.test(body);

  if (!isMeetingInvite) {
    return null;
  }

  // 1. Detect video conference link & platform
  let meetingUrl: string | undefined;
  let platform: 'google_meet' | 'zoom' | 'teams' | 'other' = 'other';

  const meetMatch = fullText.match(GOOGLE_MEET_REGEX);
  const zoomMatch = fullText.match(ZOOM_REGEX);
  const teamsMatch = fullText.match(TEAMS_REGEX);

  if (meetMatch) {
    meetingUrl = meetMatch[0];
    platform = 'google_meet';
  } else if (zoomMatch) {
    meetingUrl = zoomMatch[0];
    platform = 'zoom';
  } else if (teamsMatch) {
    meetingUrl = teamsMatch[0];
    platform = 'teams';
  }

  // 2. Extract Title
  let title = subject
    .replace(/^(invitation:|re:|fwd:|calendar invite:|invite:)\s*/i, '')
    .replace(/@\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*/i, '')
    .trim();

  if (!title || title.length < 3) {
    title = 'Team Sync Meeting';
  }

  // 3. Extract Date
  let targetDate = getTodayString();
  const lowerBody = fullText.toLowerCase();

  if (lowerBody.includes('tomorrow')) {
    targetDate = getTomorrowString();
  } else {
    // Check for explicit dates e.g. 2026-10-02 or Oct 2 or 10/02
    const isoDateMatch = fullText.match(/\b(202\d-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      targetDate = isoDateMatch[1];
    } else {
      const monthMatch = fullText.match(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.,]?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i
      );
      if (monthMatch) {
        const monthName = monthMatch[1];
        const day = parseInt(monthMatch[2], 10);
        const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : new Date().getFullYear();
        const dateObj = new Date(`${monthName} ${day}, ${year}`);
        if (!isNaN(dateObj.getTime())) {
          targetDate = dateObj.toISOString().slice(0, 10);
        }
      }
    }
  }

  // 4. Extract Times (e.g. 10:00 AM - 11:00 AM or 14:00)
  let startTime = '10:00 AM';
  let endTime: string | undefined = '11:00 AM';

  const timeRangeMatch = fullText.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i
  );

  if (timeRangeMatch) {
    startTime = normalizeTimeString(timeRangeMatch[1]);
    endTime = normalizeTimeString(timeRangeMatch[2]);
  } else {
    const singleTimeMatch = fullText.match(/\b(?:at|starts at|time:)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
    if (singleTimeMatch) {
      startTime = normalizeTimeString(singleTimeMatch[1]);
    }
  }

  // Recurrence & Future Filter: ignore past expired meetings unless recurring
  const todayStr = getTodayString();
  const isPast = targetDate < todayStr;
  const isRecurring =
    /recurring|weekly|every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|bi-weekly|daily/i.test(
      fullText
    );

  if (isPast) {
    if (isRecurring) {
      // Calculate next upcoming recurrence
      const dayMatch = fullText.match(
        /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
      );
      if (dayMatch) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDayIndex = dayNames.indexOf(dayMatch[1].toLowerCase());
        if (targetDayIndex !== -1) {
          const nextDate = new Date();
          const currentDay = nextDate.getDay();
          let daysUntil = (targetDayIndex - currentDay + 7) % 7;
          if (daysUntil === 0) daysUntil = 7;
          nextDate.setDate(nextDate.getDate() + daysUntil);
          targetDate = nextDate.toISOString().slice(0, 10);
        }
      } else {
        const d = new Date(targetDate);
        while (d.toISOString().slice(0, 10) < todayStr) {
          d.setDate(d.getDate() + 7);
        }
        targetDate = d.toISOString().slice(0, 10);
      }
    } else {
      // Past non-recurring meeting -> skip
      return null;
    }
  }

  // 5. Extract Attendees / Organizer
  const attendees: string[] = ['Salitha Marasinghe'];
  if (sender && !sender.toLowerCase().includes('salitha')) {
    attendees.unshift(sender.replace(/<.*?>/, '').trim());
  }

  return {
    title,
    date: targetDate,
    startTime,
    endTime,
    meetingUrl,
    platform,
    organizer: sender.replace(/<.*?>/, '').trim(),
    attendees,
    summary: '', // Empty placeholder awaiting actual meeting discussion!
    isConfirmed: false,
  };
}

function normalizeTimeString(timeStr: string): string {
  const clean = timeStr.trim();
  if (/(am|pm)$/i.test(clean)) {
    return clean.toUpperCase();
  }
  return clean;
}

/**
 * Pre-loaded realistic team sample emails for testing out-of-the-box
 */
export const SAMPLE_TEAM_EMAILS: EmailMessage[] = [
  {
    id: 'email-sample-1',
    sender: 'Sarah Chen (Tech Lead)',
    senderEmail: 'sarah.chen@techteam.internal',
    subject: 'Invitation: Sprint Planning & Backlog Grooming @ Fri Oct 2, 2026 10am - 11am',
    date: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 mins ago
    snippet:
      'Hey team, let’s sync up on the sprint deliverables, RAG embeddings pipeline, and frontend dark mode refactor.',
    body: `Hi Salitha and team,

We have scheduled our bi-weekly Sprint Planning and Backlog Grooming session.

Date: Tomorrow (${getTomorrowString()})
Time: 10:00 AM - 11:00 AM
Location: Google Meet

Meeting link: https://meet.google.com/qrs-tuvw-xyz

Agenda:
1. Review sprint commitments and blockers
2. Technical deep-dive on vector cache architecture
3. Task assignments for associates and trainee engineers

Please review the ticket backlog before joining.

Best,
Sarah Chen
Principal Architect & Tech Lead`,
    hasMeetingInvite: true,
    meetingDetails: {
      title: 'Sprint Planning & Backlog Grooming',
      date: getTomorrowString(),
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      meetingUrl: 'https://meet.google.com/qrs-tuvw-xyz',
      platform: 'google_meet',
      organizer: 'Sarah Chen (Tech Lead)',
      organizerEmail: 'sarah.chen@techteam.internal',
      attendees: ['Sarah Chen', 'Salitha Marasinghe', 'Dave Miller'],
      summary: '', // Strictly empty placeholder awaiting post-meeting recap
    },
  },
  {
    id: 'email-sample-2',
    sender: 'Alex Mercer (Product Manager)',
    senderEmail: 'alex.mercer@techteam.internal',
    subject: 'Emergency Architecture Sync: API Gateway & Latency',
    date: new Date(Date.now() - 1000 * 60 * 65).toISOString(), // 1 hour ago
    snippet:
      'Quick 30 min sync today at 3:30 PM regarding our AI assistant response time and Edge Function latency.',
    body: `Hey Salitha,

Can we jump on a quick 30-minute sync today to discuss the edge function response streaming and the Groq 120b latency optimizations?

When: Today (${getTodayString()}) from 3:30 PM - 4:00 PM
Zoom Meeting Link: https://zoom.us/j/94827103942?pwd=MindMapSecretZoomKey

Attendees:
- Alex Mercer
- Salitha Marasinghe

Let me know if this time works or join directly via the Zoom link.

Cheers,
Alex`,
    hasMeetingInvite: true,
    meetingDetails: {
      title: 'Emergency Architecture Sync: API Gateway & Latency',
      date: getTodayString(),
      startTime: '3:30 PM',
      endTime: '4:00 PM',
      meetingUrl: 'https://zoom.us/j/94827103942?pwd=MindMapSecretZoomKey',
      platform: 'zoom',
      organizer: 'Alex Mercer (Product Manager)',
      organizerEmail: 'alex.mercer@techteam.internal',
      attendees: ['Alex Mercer', 'Salitha Marasinghe'],
      summary: '', // Strictly empty placeholder awaiting post-meeting recap
    },
  },
  {
    id: 'email-sample-3',
    sender: 'Client Solutions Director',
    senderEmail: 'solutions@clientportal.com',
    subject: 'Quarterly Knowledge Base Review',
    date: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    snippet: 'Monthly newsletter and quarterly system update announcement.',
    body: `Dear Partner,

Here is our summary of the latest platform release notes. No action is required. We hope you enjoy the new updates!

Regards,
Client Solutions Team`,
    hasMeetingInvite: false,
  },
];

/**
 * Fetch messages from Gmail API using an OAuth Access Token
 */
export async function fetchLiveGmailMessages(accessToken: string): Promise<EmailMessage[]> {
  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=meeting+OR+zoom.us+OR+meet.google.com+OR+teams.microsoft.com&maxResults=10',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!listRes.ok) {
      throw new Error(`Gmail API returned status ${listRes.status}: ${await listRes.text()}`);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    const detailedEmails: EmailMessage[] = [];

    for (const msg of messages.slice(0, 5)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!msgRes.ok) continue;

      const data = await msgRes.json();
      const headers = data.payload?.headers || [];

      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
      const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();

      let bodyText = data.snippet || '';
      if (data.payload?.parts) {
        for (const part of data.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            break;
          }
        }
      }

      const meeting = extractMeetingFromEmail(subject, bodyText, from, date);

      detailedEmails.push({
        id: msg.id,
        sender: from,
        senderEmail: from.match(/<([^>]+)>/)?.[1] || from,
        subject,
        date: new Date(date).toISOString(),
        snippet: data.snippet || '',
        body: bodyText,
        hasMeetingInvite: !!meeting,
        meetingDetails: meeting || undefined,
      });
    }

    return detailedEmails;
  } catch (err) {
    console.error('Failed to fetch from Gmail API:', err);
    throw err;
  }
}

/**
 * Fetch upcoming calendar events from Google Calendar API
 */
export async function fetchLiveGoogleCalendarEvents(accessToken: string): Promise<EmailMessage[]> {
  try {
    const now = new Date();
    const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // From yesterday
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Up to 7 days ahead

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=15`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!calRes.ok) {
      console.warn(`Google Calendar API returned status ${calRes.status}`);
      return [];
    }

    const data = await calRes.json();
    const items = data.items || [];
    const calendarEmails: EmailMessage[] = [];

    for (const item of items) {
      // Find meeting URL
      let meetingUrl: string | undefined = item.hangoutLink;
      let platform: 'google_meet' | 'zoom' | 'teams' | 'other' = item.hangoutLink
        ? 'google_meet'
        : 'other';

      if (!meetingUrl && item.conferenceData?.entryPoints) {
        const videoEntry = item.conferenceData.entryPoints.find(
          (e: any) => e.entryPointType === 'video'
        );
        if (videoEntry?.uri) {
          meetingUrl = videoEntry.uri;
          platform = meetingUrl.includes('meet.google')
            ? 'google_meet'
            : meetingUrl.includes('zoom.us')
            ? 'zoom'
            : meetingUrl.includes('teams.microsoft')
            ? 'teams'
            : 'other';
        }
      }

      // Fallback search in description or location
      if (!meetingUrl) {
        const descMatch =
          (item.description || '').match(GOOGLE_MEET_REGEX) ||
          (item.location || '').match(GOOGLE_MEET_REGEX);
        const zoomMatch =
          (item.description || '').match(ZOOM_REGEX) ||
          (item.location || '').match(ZOOM_REGEX);
        const teamsMatch =
          (item.description || '').match(TEAMS_REGEX) ||
          (item.location || '').match(TEAMS_REGEX);

        if (descMatch) {
          meetingUrl = descMatch[0];
          platform = 'google_meet';
        } else if (zoomMatch) {
          meetingUrl = zoomMatch[0];
          platform = 'zoom';
        } else if (teamsMatch) {
          meetingUrl = teamsMatch[0];
          platform = 'teams';
        }
      }

      const startDateTimeStr = item.start?.dateTime || item.start?.date || new Date().toISOString();
      const endDateTimeStr = item.end?.dateTime || item.end?.date;
      const startDate = new Date(startDateTimeStr);

      // Only select upcoming events (skip meetings that ended > 30 minutes ago)
      if (startDate.getTime() < Date.now() - 30 * 60 * 1000) {
        continue;
      }

      const dateStr = !isNaN(startDate.getTime())
        ? startDate.toISOString().slice(0, 10)
        : getTodayString();

      const startTimeStr = !isNaN(startDate.getTime())
        ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '10:00 AM';

      const endTimeStr =
        endDateTimeStr && !isNaN(new Date(endDateTimeStr).getTime())
          ? new Date(endDateTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined;

      const attendees = (item.attendees || []).map(
        (a: any) => a.displayName || a.email || 'Participant'
      );
      const organizer = item.organizer?.displayName || item.organizer?.email || 'Google Calendar';

      const parsed: ParsedMeeting = {
        title: item.summary || 'Team Meeting',
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        meetingUrl,
        platform,
        organizer,
        attendees: attendees.length > 0 ? attendees : ['Salitha Marasinghe'],
        summary: '', // Empty placeholder awaiting actual meeting discussion
        isConfirmed: true,
      };

      calendarEmails.push({
        id: `gcal-${item.id}`,
        sender: organizer,
        senderEmail: item.organizer?.email || 'calendar@google.com',
        subject: `Calendar: ${item.summary || 'Team Meeting'}`,
        date: startDateTimeStr,
        snippet:
          item.description?.slice(0, 120) ||
          `Calendar event scheduled for ${dateStr} at ${startTimeStr}`,
        body:
          item.description ||
          `Calendar meeting: ${item.summary}\nTime: ${startTimeStr} - ${endTimeStr || ''}\nLink: ${
            meetingUrl || 'N/A'
          }`,
        hasMeetingInvite: true,
        meetingDetails: parsed,
      });
    }

    return calendarEmails;
  } catch (err) {
    console.error('Failed to fetch Google Calendar events:', err);
    return [];
  }
}
