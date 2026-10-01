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
      className="absolute right-0 top-12 w-[380px] sm:w-[440px] max-h-[85vh] bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/5"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-[#000000] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-500 text-black font-bold text-[10px]">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {lastSyncedAt && (
              <p className="text-[10px] text-slate-500">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#141414] transition disabled:opacity-50"
            title="Check emails for meetings now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-400' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-[#141414] transition text-xs"
              title="Mark all as read"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#141414] transition"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#141414] transition ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#080808] border-b border-[#141414] text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-[#141414] text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('meetings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition ${
            filter === 'meetings'
              ? 'bg-[#141414] text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-3 h-3 text-teal-400" />
          Meetings Only
        </button>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto max-h-[60vh] p-3 flex flex-col gap-2.5 divide-y divide-[#141414]">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-full bg-[#141414] flex items-center justify-center text-slate-500 mb-2">
              <Mail className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">All caught up!</p>
            <p className="text-xs text-slate-500 max-w-[220px] mt-1">
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
                    ? 'bg-[#080808] border-teal-900/40 hover:border-teal-700/60'
                    : 'bg-[#000000] border-[#141414] opacity-85 hover:opacity-100 hover:border-slate-800'
                }`}
              >
                {/* Unread indicator dot */}
                {!notif.read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                )}

                <div className="flex items-start gap-2.5 pr-4">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      hasLink
                        ? isGoogleMeet
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isZoom
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {hasLink ? <Video className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-100 leading-snug truncate">
                      {notif.title}
                    </h4>

                    {/* Date / Time badges */}
                    {(notif.meetingDate || notif.meetingTime) && (
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                        {notif.meetingDate && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {notif.meetingDate}
                          </span>
                        )}
                        {notif.meetingTime && (
                          <span className="flex items-center gap-1 text-slate-300 font-medium">
                            <Clock className="w-3 h-3 text-teal-400" />
                            {notif.meetingTime}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>

                {/* Direct Action Buttons: 1-Click Attend & Schedule */}
                <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-[#141414]">
                  {hasLink ? (
                    <a
                      href={notif.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold text-xs shadow-md shadow-teal-950/30 transition duration-150 group/btn"
                    >
                      <Video className="w-3.5 h-3.5 text-white animate-pulse" />
                      <span>Click to Join ({isGoogleMeet ? 'Meet' : isZoom ? 'Zoom' : 'Meeting'})</span>
                      <ExternalLink className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500">No meeting URL found</span>
                  )}

                  {notif.type === 'meeting_invite' && !notif.eventId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScheduleFromNotification(notif);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1a1a1a] text-slate-300 hover:text-white text-xs font-medium border border-[#222222] transition"
                      title="Add to Work Journal"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-teal-400" />
                      <span>Log Event</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-300 hover:bg-[#141414] rounded transition"
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
      <div className="p-3 bg-[#000000] border-t border-[#1a1a1a] flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-500">
          Tip: You can ask Jarvis "Check my email for meetings"
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/dashboard');
          }}
          className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
        >
          Ask Jarvis →
        </button>
      </div>
    </div>
  );
}
