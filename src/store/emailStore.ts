import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EmailMessage, ParsedMeeting } from '../types';
import {
  SAMPLE_TEAM_EMAILS,
  fetchLiveGmailMessages,
  fetchLiveGoogleCalendarEvents,
  extractMeetingFromEmail,
} from '../services/emailService';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useTimelineStore } from './timelineStore';
import { useNotificationStore } from './notificationStore';

async function ensureMeetingPlaceholder(m: ParsedMeeting) {
  const { user } = useAuthStore.getState();
  if (!user || !m.date) return;

  const timelineStore = useTimelineStore.getState();
  const existingEvents = Object.values(timelineStore.eventsByDate).flat();
  const cleanTitle = m.title.trim().toLowerCase();

  const alreadyExistsLocally = existingEvents.some(
    (e) =>
      e.type === 'meeting' &&
      e.date === m.date &&
      (e.startTime === m.startTime || e.title.trim().toLowerCase() === cleanTitle)
  );

  if (alreadyExistsLocally) return;

  try {
    const { data: dbExisting } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', m.date)
      .eq('type', 'meeting')
      .ilike('title', m.title.trim())
      .maybeSingle();

    if (dbExisting) return;

    const meetingLinks = m.meetingUrl
      ? [{ label: m.platform || 'Meeting Link', url: m.meetingUrl }]
      : [];

    await timelineStore.createMeetingEvent({
      title: m.title,
      date: m.date,
      startTime: m.startTime || null,
      endTime: m.endTime || null,
      projectTag: null,
      isOptional: false,
      discussionSummary: '', // Strictly empty placeholder awaiting post-meeting recap
      decisions: '',
      tasksAssigned: [],
      links: meetingLinks,
    });
  } catch (err) {
    console.warn('Could not auto-create meeting placeholder:', err);
  }
}

interface EmailState {
  emails: EmailMessage[];
  isSyncing: boolean;
  lastSyncedAt: string | null;
  gmailAccessToken: string | null;
  useTestInbox: boolean;
  autoCheckIntervalMinutes: number;

  // Actions
  setGmailAccessToken: (token: string | null) => void;
  setUseTestInbox: (use: boolean) => void;
  setAutoCheckInterval: (minutes: number) => void;
  syncEmails: () => Promise<EmailMessage[]>;
  simulateIncomingEmail: (email: {
    sender: string;
    subject: string;
    body: string;
  }) => EmailMessage;
  getMeetingInvites: () => EmailMessage[];
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
      emails: SAMPLE_TEAM_EMAILS,
      isSyncing: false,
      lastSyncedAt: null,
      gmailAccessToken: null,
      useTestInbox: true,
      autoCheckIntervalMinutes: 15,

      setGmailAccessToken: (token) => set({ gmailAccessToken: token }),

      setUseTestInbox: (use) => set({ useTestInbox: use }),

      setAutoCheckInterval: (minutes) => set({ autoCheckIntervalMinutes: minutes }),

      syncEmails: async () => {
        set({ isSyncing: true });
        try {
          const { gmailAccessToken, useTestInbox, emails: currentEmails } = get();
          let fetched: EmailMessage[] = [];

          if (gmailAccessToken && !useTestInbox) {
            // Live fetch via Google Calendar API and Gmail API concurrently
            const [calendarEvents, gmailMessages] = await Promise.all([
              fetchLiveGoogleCalendarEvents(gmailAccessToken).catch((e) => {
                console.warn('Google Calendar fetch error:', e);
                return [];
              }),
              fetchLiveGmailMessages(gmailAccessToken).catch((e) => {
                console.warn('Gmail fetch error:', e);
                return [];
              }),
            ]);
            fetched = [...calendarEvents, ...gmailMessages];
          } else {
            // Simulated delay for realism
            await new Promise((resolve) => setTimeout(resolve, 800));
            fetched = SAMPLE_TEAM_EMAILS;
          }

          // Combine with any manually created custom emails
          const customEmails = currentEmails.filter((e) => e.id.startsWith('custom-'));
          const combined = [...customEmails, ...fetched];

          // Deduplicate by id
          const uniqueEmails = Array.from(new Map(combined.map((m) => [m.id, m])).values());

          set({
            emails: uniqueEmails,
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });

          // Check for meetings, dispatch notifications, and auto-create Work Journal placeholders
          const notificationStore = useNotificationStore.getState();
          for (const email of uniqueEmails) {
            if (email.hasMeetingInvite && email.meetingDetails) {
              const m = email.meetingDetails;
              notificationStore.addNotification({
                type: 'meeting_invite',
                title: `Meeting Invite: ${m.title}`,
                message: `From ${m.organizer || email.sender} for ${m.date} at ${m.startTime}.`,
                meetingLink: m.meetingUrl,
                meetingDate: m.date,
                meetingTime: m.startTime,
                platform: m.platform,
                actionLabel: m.meetingUrl ? 'Join Meeting' : undefined,
                actionUrl: m.meetingUrl,
              });

              // Auto-create empty placeholder in Work Journal (title + time, strictly empty description)
              await ensureMeetingPlaceholder(m);
            }
          }

          return uniqueEmails;
        } catch (err) {
          console.error('Email sync failed:', err);
          set({ isSyncing: false });
          return get().emails;
        }
      },

      simulateIncomingEmail: ({ sender, subject, body }) => {
        const meeting = extractMeetingFromEmail(subject, body, sender);
        const newEmail: EmailMessage = {
          id: `custom-${Date.now()}`,
          sender,
          senderEmail: sender.match(/<([^>]+)>/)?.[1] || 'colleague@company.com',
          subject,
          date: new Date().toISOString(),
          snippet: body.slice(0, 120),
          body,
          hasMeetingInvite: !!meeting,
          meetingDetails: meeting || undefined,
        };

        set((state) => ({
          emails: [newEmail, ...state.emails],
        }));

        if (meeting) {
          useNotificationStore.getState().addNotification({
            type: 'meeting_invite',
            title: `New Invite: ${meeting.title}`,
            message: `From ${sender} for ${meeting.date} at ${meeting.startTime}. Click to view or join.`,
            meetingLink: meeting.meetingUrl,
            meetingDate: meeting.date,
            meetingTime: meeting.startTime,
            platform: meeting.platform,
            actionLabel: meeting.meetingUrl ? 'Join Meeting' : undefined,
            actionUrl: meeting.meetingUrl,
          });

          // Auto-create empty placeholder in Work Journal
          ensureMeetingPlaceholder(meeting);
        }

        return newEmail;
      },

      getMeetingInvites: () => {
        return get().emails.filter((e) => e.hasMeetingInvite && !!e.meetingDetails);
      },
    }),
    {
      name: 'mindmapper-email-storage',
      partialize: (state) => ({
        gmailAccessToken: state.gmailAccessToken,
        useTestInbox: state.useTestInbox,
        autoCheckIntervalMinutes: state.autoCheckIntervalMinutes,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
