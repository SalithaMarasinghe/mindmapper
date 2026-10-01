import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppNotification } from '../types';
import { useTimelineStore } from './timelineStore';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;

  // Actions
  addNotification: (
    item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  checkUpcomingMeetings: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [
        {
          id: 'initial-welcome-meeting-notify',
          type: 'meeting_upcoming',
          title: 'Upcoming Meeting: Sprint Planning & Backlog Grooming',
          message: 'Tomorrow at 10:00 AM on Google Meet. Click below to join directly.',
          meetingLink: 'https://meet.google.com/qrs-tuvw-xyz',
          meetingDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          meetingTime: '10:00 AM',
          platform: 'google_meet',
          read: false,
          createdAt: new Date().toISOString(),
          actionLabel: 'Join Google Meet',
          actionUrl: 'https://meet.google.com/qrs-tuvw-xyz',
        },
      ],
      unreadCount: 1,

      addNotification: (item) => {
        const current = get().notifications;

        // Deduplicate: avoid duplicate notifications for the same title & date
        const isDuplicate = current.some(
          (n) =>
            n.title === item.title &&
            n.meetingDate === item.meetingDate &&
            n.meetingTime === item.meetingTime
        );

        if (isDuplicate) return;

        const newNotification: AppNotification = {
          ...item,
          id: item.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          read: false,
          createdAt: new Date().toISOString(),
        };

        const updated = [newNotification, ...current].slice(0, 50); // Keep last 50
        set({
          notifications: updated,
          unreadCount: updated.filter((n) => !n.read).length,
        });
      },

      markAsRead: (id) => {
        const updated = get().notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        set({
          notifications: updated,
          unreadCount: updated.filter((n) => !n.read).length,
        });
      },

      markAllAsRead: () => {
        const updated = get().notifications.map((n) => ({ ...n, read: true }));
        set({
          notifications: updated,
          unreadCount: 0,
        });
      },

      removeNotification: (id) => {
        const updated = get().notifications.filter((n) => n.id !== id);
        set({
          notifications: updated,
          unreadCount: updated.filter((n) => !n.read).length,
        });
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },

      checkUpcomingMeetings: () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const eventsByDate = useTimelineStore.getState().eventsByDate;
        const todayEvents = eventsByDate[todayStr] || [];

        for (const ev of todayEvents) {
          if (ev.type === 'meeting') {
            const meetingDetails = (ev as any).meeting_details || (ev as any);
            const links = meetingDetails.links || [];
            const meetUrl = links[0]?.url;

            if (meetUrl) {
              const platform = meetUrl.includes('meet.google')
                ? 'google_meet'
                : meetUrl.includes('zoom.us')
                ? 'zoom'
                : meetUrl.includes('teams.microsoft')
                ? 'teams'
                : 'other';

              get().addNotification({
                type: 'meeting_upcoming',
                title: `Today's Meeting: ${ev.title}`,
                message: `Scheduled for ${ev.startTime || 'today'}. Direct join link is ready.`,
                meetingLink: meetUrl,
                meetingDate: ev.date,
                meetingTime: ev.startTime || undefined,
                platform,
                eventId: ev.id,
                actionLabel: 'Join Meeting',
                actionUrl: meetUrl,
              });
            }
          }
        }
      },
    }),
    {
      name: 'mindmapper-notifications-storage',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);
