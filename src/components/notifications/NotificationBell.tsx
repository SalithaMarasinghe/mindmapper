import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationCenter } from './NotificationCenter';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, checkUpcomingMeetings } = useNotificationStore();

  // Check for upcoming meetings every 60 seconds
  useEffect(() => {
    checkUpcomingMeetings();
    const interval = setInterval(() => {
      checkUpcomingMeetings();
    }, 60000);
    return () => clearInterval(interval);
  }, [checkUpcomingMeetings]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-text-muted hover:text-text hover:bg-surface-2 rounded-full transition duration-150"
        title="Meeting & Email Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-black bg-accent rounded-full shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
