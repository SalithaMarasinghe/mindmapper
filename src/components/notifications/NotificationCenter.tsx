import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  Trash2,
  RefreshCw,
  Video,
  ExternalLink,
  Calendar,
  Clock,
  Mail,
  X,
  PlusCircle,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { useEmailStore } from '../../store/emailStore';
import { useTimelineStore } from '../../store/timelineStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } =
    useNotificationStore();
  const { isSyncing, syncEmails, lastSyncedAt } = useEmailStore();
  const { createMeetingEvent } = useTimelineStore();

  const [filter, setFilter] = useState<'all' | 'meetings'>('all');

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSync = async () => {
    toast.loading('Checking emails for meeting invites...', { id: 'email-sync' });
    const emails = await syncEmails();
    const meetingsFound = emails.filter((e) => e.hasMeetingInvite).length;
    toast.success(
      meetingsFound > 0
        ? `Found ${meetingsFound} meeting invitation(s)!`
        : 'Checked emails. Inbox up to date.',
      { id: 'email-sync' }
    );
  };

  const handleScheduleFromNotification = async (notif: (typeof notifications)[0]) => {
    if (!notif.meetingDate || !notif.meetingTime) {
      toast.error('Meeting date or time is missing');
      return;
    }

    try {
      const evId = await createMeetingEvent({
        date: notif.meetingDate,
        startTime: notif.meetingTime,
        endTime: null,
        title: notif.title.replace(/^Meeting Invite:\s*/i, ''),
        projectTag: 'Meeting',
        isOptional: false,
        discussionSummary: notif.message,
        decisions: '',
        tasksAssigned: [],
        links: notif.meetingLink
          ? [
              {
                label:
                  notif.platform === 'google_meet'
                    ? 'Google Meet'
                    : notif.platform === 'zoom'
                    ? 'Zoom Meeting'
                    : 'Meeting Link',
                url: notif.meetingLink,
              },
            ]
          : [],
      });

      if (evId) {
        markAsRead(notif.id);
        toast.success('Meeting scheduled in Work Journal! 📅');
      }
    } catch (e: any) {
      toast.error('Failed to schedule meeting: ' + e.message);
    }
  };

  if (!isOpen) return null;

  const filteredNotifications =
    filter === 'meetings'
      ? notifications.filter((n) => n.type.includes('meeting') || n.meetingLink)
      : notifications;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-12 w-[380px] sm:w-[440px] max-h-[85vh] bg-[#0a0a0a] border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/5"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-bg border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-surface-2 text-text">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-500 text-black font-bold text-[10px]">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {lastSyncedAt && (
              <p className="text-[10px] text-text-muted">
                Synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition disabled:opacity-50"
            title="Check emails for meetings now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-text' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition text-xs"
              title="Mark all as read"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-2 transition"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-border text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-surface-2 text-text border border-border-strong'
              : 'text-text-muted hover:text-text'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('meetings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition ${
            filter === 'meetings'
              ? 'bg-surface-2 text-text border border-border-strong'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Video className="w-3 h-3 text-text" />
          Meetings Only
        </button>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto max-h-[60vh] p-3 flex flex-col gap-2.5 divide-y divide-border">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-2">
              <Mail className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-secondary">All caught up!</p>
            <p className="text-xs text-text-muted max-w-[220px] mt-1">
              No pending notifications. Click sync above to scan your inbox for new team meetings.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const hasLink = !!notif.meetingLink;
            const isGoogleMeet = notif.platform === 'google_meet' || notif.meetingLink?.includes('meet.google');
            const isZoom = notif.platform === 'zoom' || notif.meetingLink?.includes('zoom.us');

            return (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={`pt-2.5 first:pt-0 group relative flex flex-col gap-2 p-3 rounded-xl transition border ${
                  !notif.read
                    ? 'bg-surface border-border-strong hover:border-border-strong'
                    : 'bg-bg border-border opacity-85 hover:opacity-100 hover:border-border-strong'
                }`}
              >
                {/* Unread indicator dot */}
                {!notif.read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}

                <div className="flex items-start gap-2.5 pr-4">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      hasLink
                        ? isGoogleMeet
                          ? 'bg-surface-2 text-text border border-border'
                          : isZoom
                          ? 'bg-surface-2 text-text border border-border'
                          : 'bg-surface-2 text-text border border-border'
                        : 'bg-surface text-text-muted'
                    }`}
                  >
                    {hasLink ? <Video className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-text leading-snug truncate">
                      {notif.title}
                    </h4>

                    {/* Date / Time badges */}
                    {(notif.meetingDate || notif.meetingTime) && (
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted font-mono">
                        {notif.meetingDate && (
                          <span className="flex items-center gap-1 text-text-secondary">
                            <Calendar className="w-3 h-3 text-text-muted" />
                            {notif.meetingDate}
                          </span>
                        )}
                        {notif.meetingTime && (
                          <span className="flex items-center gap-1 text-text-secondary font-medium">
                            <Clock className="w-3 h-3 text-text" />
                            {notif.meetingTime}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>

                {/* Direct Action Buttons: 1-Click Attend & Schedule */}
                <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-border">
                  {hasLink ? (
                    <a
                      href={notif.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-text text-bg hover:bg-text/90  text-bg font-semibold text-xs shadow-md shadow-none transition duration-150 group/btn"
                    >
                      <Video className="w-3.5 h-3.5 text-bg animate-pulse" />
                      <span>Click to Join ({isGoogleMeet ? 'Meet' : isZoom ? 'Zoom' : 'Meeting'})</span>
                      <ExternalLink className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-text-muted">No meeting URL found</span>
                  )}

                  {notif.type === 'meeting_invite' && !notif.eventId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScheduleFromNotification(notif);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-2 text-text-secondary hover:text-text text-xs font-medium border border-border transition"
                      title="Add to Work Journal"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-text" />
                      <span>Log Event</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                    className="p-1 text-text-muted hover:text-text-secondary hover:bg-surface-2 rounded transition"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-bg border-t border-border flex items-center justify-between text-xs">
        <span className="text-[11px] text-text-muted">
          Tip: You can ask Jarvis "Check my email for meetings"
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/dashboard');
          }}
          className="text-xs text-text hover:text-text font-semibold"
        >
          Ask Jarvis →
        </button>
      </div>
    </div>
  );
}
