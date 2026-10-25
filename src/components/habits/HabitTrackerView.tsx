import { useState, useEffect } from 'react';
import { Plus, Flame } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { HabitFormSidebar } from './HabitFormSidebar';
import { HabitCalendarGrid } from './HabitCalendarGrid';
import { CreateHabitModal } from './CreateHabitModal';
import type { Habit } from '../../types';

export function HabitTrackerView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);

  const { habits, logs, fetchFromSupabase } = useHabitStore();

  useEffect(() => {
    void fetchFromSupabase();
  }, [fetchFromSupabase]);

  const handleOpenCreate = () => {
    setHabitToEdit(null);
    setIsCreateModalOpen(true);
  };

  const handleEditHabit = (habit: Habit) => {
    setHabitToEdit(habit);
    setIsCreateModalOpen(true);
  };

  // Calculate high-level consistency stats
  const totalDaysLogged = Object.keys(logs).length;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-bg overflow-hidden">
      
      {/* Top Action Bar */}
      <div className="px-5 py-3 border-b border-border bg-surface/40 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-base shadow-2xs">
            ⚡
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-text tracking-tight leading-tight">
              Habit Tracker
            </h1>
            <p className="text-xs text-text-muted">
              Master daily routines, log time, and build streaks
            </p>
          </div>
        </div>

        {/* Right side stats & action button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted px-3 py-1.5 bg-surface rounded-xl border border-border">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <b className="text-text">{habits.length}</b> habits active
            </span>
            <span>•</span>
            <span>
              <b className="text-text">{totalDaysLogged}</b> days recorded
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 active:scale-95 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Habit</span>
          </button>
        </div>
      </div>

      {/* Main Split: Form on Left, Calendar on Right */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
        <HabitFormSidebar
          onOpenCreateModal={handleOpenCreate}
          onEditHabit={handleEditHabit}
        />
        <HabitCalendarGrid />
      </div>

      {/* Habit Create / Edit Modal */}
      {isCreateModalOpen && (
        <CreateHabitModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setHabitToEdit(null);
          }}
          habitToEdit={habitToEdit}
        />
      )}
    </div>
  );
}
