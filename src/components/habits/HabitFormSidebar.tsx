import { useState, useEffect } from 'react';
import { Calendar, RotateCcw, Check, Sparkles, Plus, Trash2, Edit2, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHabitStore, getTodayString } from '../../store/habitStore';
import { getSmartSuggestionChips, formatMinutes } from './HabitUtils';
import type { Habit } from '../../types';

interface HabitFormSidebarProps {
  onOpenCreateModal: () => void;
  onEditHabit: (habit: Habit) => void;
}

export function HabitFormSidebar({ onOpenCreateModal, onEditHabit }: HabitFormSidebarProps) {
  const {
    habits,
    logs,
    selectedDate,
    saveDayLogs,
    clearDayLogs,
    deleteHabit,
    goToToday,
  } = useHabitStore();

  // Local state for the selected day's draft values: { [habitId]: minutes }
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null);

  // When selectedDate or logs change, sync local draft
  useEffect(() => {
    const existing = logs[selectedDate] || {};
    const initialDraft: Record<string, number> = {};
    for (const h of habits) {
      initialDraft[h.id] = existing[h.id] || 0;
    }
    setDraftValues(initialDraft);
  }, [selectedDate, logs, habits]);

  const todayStr = getTodayString();
  const isToday = selectedDate === todayStr;

  const handleSelectMinutes = (habitId: string, minutes: number) => {
    setDraftValues((prev) => ({
      ...prev,
      [habitId]: Math.max(0, minutes),
    }));
    if (activeCustomId === habitId) {
      setActiveCustomId(null);
    }
  };

  const handleCustomApply = (habitId: string) => {
    const val = parseInt(customInputs[habitId] || '0', 10);
    if (!isNaN(val) && val >= 0) {
      handleSelectMinutes(habitId, val);
    }
    setActiveCustomId(null);
  };

  const handleApplyToCalendar = async () => {
    await saveDayLogs(selectedDate, draftValues);
    toast.success(`Updated habit logs for ${formatDisplayDate(selectedDate)}!`, {
      icon: '✨',
      style: {
        borderRadius: '10px',
        background: '#18181b',
        color: '#fff',
        border: '1px solid #27272a',
      },
    });
  };

  const handleClear = async () => {
    await clearDayLogs(selectedDate);
    const cleared: Record<string, number> = {};
    for (const h of habits) cleared[h.id] = 0;
    setDraftValues(cleared);
    toast('Cleared logs for this day', { icon: '🧹' });
  };

  const handleDelete = async (e: React.MouseEvent, habit: Habit) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the habit "${habit.name}"?`)) {
      await deleteHabit(habit.id);
      toast.success('Habit deleted');
    }
  };

  function formatDisplayDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  // Calculate day completion summary
  const totalHabits = habits.length;
  const completedHabits = habits.filter(
    (h) => (draftValues[h.id] || 0) >= h.targetMinutes
  ).length;
  const loggedHabits = habits.filter((h) => (draftValues[h.id] || 0) > 0).length;

  return (
    <aside className="w-80 sm:w-96 shrink-0 border-r border-border bg-bg/40 flex flex-col h-full min-h-0">
      
      {/* Sidebar Header: Selected Date & Fast Controls */}
      <div className="p-3.5 border-b border-border bg-surface/50 backdrop-blur-xs flex items-center justify-between shrink-0">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
            Daily Log Entry
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs sm:text-sm font-bold text-text">
              {formatDisplayDate(selectedDate)}
            </span>
            {isToday ? (
              <span className="text-[9px] bg-accent/20 text-accent font-semibold px-1.5 py-0.5 rounded border border-accent/30">
                TODAY
              </span>
            ) : (
              <button
                type="button"
                onClick={goToToday}
                className="text-[9px] text-text-muted hover:text-accent underline font-medium cursor-pointer"
              >
                Jump to today
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            title="Reset all habit entries to 0 for this day"
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-rose-400 p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Daily Progress Micro-Pill */}
      {totalHabits > 0 && (
        <div className="px-3.5 py-2 border-b border-border bg-surface-2/20 flex items-center justify-between text-[11px] shrink-0">
          <span className="text-text-muted flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Day Progress:</span>
          </span>
          <span className="font-semibold text-text">
            {completedHabits} / {totalHabits} habits hit goal ({loggedHabits} active)
          </span>
        </div>
      )}

      {/* Habit Cards List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0">
        {habits.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-border rounded-xl">
            <p className="text-xs text-text-muted mb-3">No habits created yet.</p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent/90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Habit</span>
            </button>
          </div>
        ) : (
          habits.map((habit) => {
            const currentMins = draftValues[habit.id] || 0;
            const targetMins = habit.targetMinutes || 60;
            const percentage = Math.min(100, Math.round((currentMins / targetMins) * 100));
            const isGoalMet = currentMins >= targetMins;
            const chips = getSmartSuggestionChips(targetMins);

            return (
              <div
                key={habit.id}
                className="group relative bg-surface border border-border rounded-xl p-3 space-y-2.5 shadow-2xs hover:border-border/80 transition-all"
              >
                {/* Top: Habit Name, Color, Edit & Delete */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-md shrink-0 shadow-xs"
                      style={{ backgroundColor: habit.color }}
                    />
                    <span className="text-sm shrink-0">{habit.icon || '⚡'}</span>
                    <span className="font-semibold text-xs text-text truncate" title={habit.name}>
                      {habit.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${habit.color}15`,
                        color: habit.color,
                        border: `1px solid ${habit.color}30`,
                      }}
                    >
                      Goal: {formatMinutes(targetMins)}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center ml-1">
                      <button
                        type="button"
                        onClick={() => onEditHabit(habit)}
                        title="Edit habit target or color"
                        className="p-1 text-text-muted hover:text-text rounded hover:bg-surface-2"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, habit)}
                        title="Delete habit"
                        className="p-1 text-text-muted hover:text-rose-400 rounded hover:bg-surface-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Project Tag (if any) */}
                {habit.projectTag && (
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60"></span>
                    <span className="truncate">{habit.projectTag}</span>
                  </div>
                )}

                {/* Smart Suggestion Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-text-muted font-medium">
                    <span>Quick Select:</span>
                    {activeCustomId !== habit.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCustomId(habit.id);
                          setCustomInputs((prev) => ({
                            ...prev,
                            [habit.id]: currentMins > 0 ? String(currentMins) : '',
                          }));
                        }}
                        className="text-[10px] text-accent hover:underline cursor-pointer"
                      >
                        + Custom
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {chips.map((chipMinutes) => {
                      const isSelected = currentMins === chipMinutes;
                      const isExactGoal = chipMinutes === targetMins;

                      return (
                        <button
                          key={chipMinutes}
                          type="button"
                          onClick={() => handleSelectMinutes(habit.id, chipMinutes)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'text-white shadow-xs font-semibold'
                              : 'bg-surface-2 text-text-secondary border-border hover:border-text-muted/60'
                          }`}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: habit.color,
                                  borderColor: habit.color,
                                }
                              : undefined
                          }
                        >
                          {chipMinutes === 0
                            ? '0m'
                            : isExactGoal
                            ? `${formatMinutes(chipMinutes)} (Goal)`
                            : formatMinutes(chipMinutes)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inline Custom Input */}
                  {activeCustomId === habit.id && (
                    <div className="flex items-center gap-1.5 pt-1 animate-in fade-in duration-150">
                      <input
                        type="number"
                        min="0"
                        max="1440"
                        placeholder="Minutes"
                        value={customInputs[habit.id] || ''}
                        onChange={(e) =>
                          setCustomInputs((prev) => ({ ...prev, [habit.id]: e.target.value }))
                        }
                        className="w-24 bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleCustomApply(habit.id)}
                        className="px-2.5 py-1 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCustomId(null)}
                        className="text-[11px] text-text-muted hover:text-text px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Current Logged Value & Percentage Goal */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-text-muted">
                    Logged: <b className="text-text font-bold">{formatMinutes(currentMins)}</b>
                  </span>
                  {currentMins > 0 ? (
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        isGoalMet ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isGoalMet && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{percentage}% of target</span>
                    </span>
                  ) : (
                    <span className="text-text-muted/70">Unlogged (0m)</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom: Apply to Calendar Button */}
      <div className="p-3.5 border-t border-border bg-surface/90 backdrop-blur-xs shrink-0">
        <button
          type="button"
          onClick={handleApplyToCalendar}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-bold py-2.5 rounded-xl shadow-md active:scale-98 transition-all text-xs sm:text-sm cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Apply to Calendar</span>
          <span className="opacity-80 font-normal text-xs">({formatDisplayDate(selectedDate)})</span>
        </button>
      </div>

    </aside>
  );
}
