import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useHabitStore, getTodayString } from '../../store/habitStore';
import { formatMinutes } from './HabitUtils';

export function HabitCalendarGrid() {
  const {
    habits,
    logs,
    selectedDate,
    currentMonthDate,
    setSelectedDate,
    nextMonth,
    prevMonth,
    goToToday,
  } = useHabitStore();

  const currentMonth = useMemo(() => new Date(currentMonthDate), [currentMonthDate]);
  const todayStr = getTodayString();

  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of this month
    const firstDay = new Date(year, month, 1);
    // 0 is Sunday, 1 is Monday... convert so Monday is index 0
    let dayOfWeek = firstDay.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    // Total days in this month
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Leading blanks (from previous month)
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const prevDay = prevMonthTotalDays - i;
      const prevDate = new Date(year, month - 1, prevDay);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(prevDay).padStart(2, '0');
      days.push({
        dateStr: `${prevDate.getFullYear()}-${mStr}-${dStr}`,
        dayNum: prevDay,
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing blanks to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dateStr: `${nextDate.getFullYear()}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  // Map habit ids to habit object for easy lookup
  const habitMap = useMemo(() => {
    const map = new Map<string, (typeof habits)[0]>();
    for (const h of habits) {
      map.set(h.id, h);
    }
    return map;
  }, [habits]);

  // Overall statistics for the current month
  const monthlyStats = useMemo(() => {
    let daysWithHabits = 0;
    let totalMinutes = 0;

    for (const day of calendarDays) {
      if (!day.isCurrentMonth) continue;
      const dayLogs = logs[day.dateStr];
      if (dayLogs && Object.keys(dayLogs).length > 0) {
        let hasLogged = false;
        for (const mins of Object.values(dayLogs)) {
          if (mins > 0) {
            hasLogged = true;
            totalMinutes += mins;
          }
        }
        if (hasLogged) daysWithHabits++;
      }
    }

    return { daysWithHabits, totalMinutes };
  }, [calendarDays, logs]);

  const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface/30 overflow-hidden">
      
      {/* Top Header of Calendar Area */}
      <div className="px-5 py-3 border-b border-border bg-surface/60 backdrop-blur-xs flex items-center justify-between flex-wrap gap-3 shrink-0">
        
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface-2 border border-border rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={prevMonth}
              title="Previous Month"
              className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs sm:text-sm font-bold text-text min-w-[130px] text-center">
              {monthName}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              title="Next Month"
              className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={goToToday}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-text-secondary font-medium transition-colors cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Habits Color Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-text-muted text-[11px] font-medium hidden sm:inline">Active Habits:</span>
          {habits.slice(0, 5).map((h) => (
            <div key={h.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0 shadow-2xs"
                style={{ backgroundColor: h.color }}
              />
              <span className="truncate max-w-[100px]">{h.name}</span>
            </div>
          ))}
          {habits.length > 5 && (
            <span className="text-[11px] text-text-muted">+{habits.length - 5} more</span>
          )}
        </div>

        {/* Quick Month Metrics */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-text-muted border-l border-border pl-4">
          <span>
            Active Days: <b className="text-text">{monthlyStats.daysWithHabits}</b>
          </span>
          <span>•</span>
          <span>
            Total Time: <b className="text-accent">{formatMinutes(monthlyStats.totalMinutes)}</b>
          </span>
        </div>
      </div>

      {/* Weekday Row */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/40 text-[11px] font-bold text-text-muted text-center py-2 shrink-0">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      {/* The 35 or 42 Day Boxes Matrix */}
      <div className="flex-1 grid grid-cols-7 gap-1.5 p-3 overflow-y-auto min-h-0">
        {calendarDays.map((day) => {
          const isSelected = day.dateStr === selectedDate;
          const isToday = day.dateStr === todayStr;
          const dayLogMap = logs[day.dateStr] || {};

          // Filter logged habits for this box
          const loggedItems = Object.entries(dayLogMap)
            .filter(([_, minutes]) => minutes > 0)
            .map(([habitId, minutes]) => {
              const habit = habitMap.get(habitId);
              return {
                habitId,
                minutes,
                name: habit?.name || 'Habit',
                color: habit?.color || '#8b5cf6',
                icon: habit?.icon || '⚡',
                target: habit?.targetMinutes || 60,
              };
            });

          const hasLogs = loggedItems.length > 0;
          const allTargetMet =
            hasLogs && loggedItems.every((item) => item.minutes >= item.target);

          return (
            <div
              key={day.dateStr}
              onClick={() => setSelectedDate(day.dateStr)}
              className={`group cursor-pointer relative border rounded-xl p-2 transition-all flex flex-col justify-between min-h-[90px] sm:min-h-[105px] select-none ${
                !day.isCurrentMonth
                  ? 'opacity-35 bg-surface-2/20 border-border/40'
                  : isSelected
                  ? 'border-accent ring-2 ring-accent/60 bg-accent/10 shadow-lg scale-[1.01] z-10'
                  : hasLogs
                  ? 'border-border bg-surface hover:border-text-muted/60 hover:shadow-xs'
                  : 'border-border/60 bg-surface/60 hover:bg-surface hover:border-border'
              }`}
            >
              {/* Box Header: Day Number & Status Badges */}
              <div className="flex items-center justify-between shrink-0">
                <span
                  className={`text-xs font-bold ${
                    isSelected
                      ? 'text-accent'
                      : isToday
                      ? 'text-text font-black underline decoration-accent decoration-2'
                      : day.isCurrentMonth
                      ? 'text-text'
                      : 'text-text-muted'
                  }`}
                >
                  {day.dayNum}
                </span>

                <div className="flex items-center gap-1">
                  {isToday && (
                    <span className="text-[8px] bg-accent text-white font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
                      TODAY
                    </span>
                  )}
                  {allTargetMet && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </div>
              </div>

              {/* Box Body: Color Badges & Habit Bars */}
              <div className="flex-1 flex flex-col justify-end gap-1 mt-1.5 overflow-hidden">
                {hasLogs ? (
                  loggedItems.slice(0, 3).map((item) => (
                    <div
                      key={item.habitId}
                      className="w-full rounded-md px-1.5 py-0.5 flex items-center justify-between text-[10px] font-semibold text-white shadow-2xs truncate"
                      style={{ backgroundColor: item.color }}
                      title={`${item.name}: ${formatMinutes(item.minutes)} (Goal: ${formatMinutes(
                        item.target
                      )})`}
                    >
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-[9px]">{item.icon}</span>
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="ml-1 opacity-90 shrink-0 text-[9px]">
                        {formatMinutes(item.minutes)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-text-muted">Click to log</span>
                  </div>
                )}

                {/* More count pill if > 3 habits on this day */}
                {loggedItems.length > 3 && (
                  <div className="text-[9px] text-text-muted font-bold text-center">
                    +{loggedItems.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Bottom Info / Status Bar */}
      <div className="px-4 py-2 border-t border-border bg-surface/50 flex items-center justify-between text-xs text-text-muted shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          <span>Click any day box on the calendar to log or edit your habits</span>
        </div>
        <span className="text-[11px] hidden sm:inline">
          Selected Day: <b className="text-text">{selectedDate}</b>
        </span>
      </div>

    </div>
  );
}
