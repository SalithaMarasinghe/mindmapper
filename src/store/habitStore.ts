import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Habit, HabitLogMap } from '../types';

export interface HabitState {
  habits: Habit[];
  logs: HabitLogMap;
  selectedDate: string; // YYYY-MM-DD
  currentMonthDate: string; // ISO string representing the first of currently viewed month
  isLoading: boolean;

  // Actions
  setSelectedDate: (date: string) => void;
  setCurrentMonthDate: (date: Date) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  goToToday: () => void;

  createHabit: (data: {
    name: string;
    targetMinutes: number;
    color: string;
    icon?: string;
    projectId?: string | null;
    projectTag?: string | null;
  }) => Promise<Habit>;

  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;

  saveDayLogs: (date: string, habitMinutesMap: Record<string, number>) => Promise<void>;
  clearDayLogs: (date: string) => Promise<void>;

  fetchFromSupabase: () => Promise<void>;
}

// Helpers
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit-yoga',
    name: 'Yoga & Mobility',
    targetMinutes: 60,
    color: '#8b5cf6', // Violet
    icon: '🧘',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'habit-python-sql',
    name: 'Python & SQL Practice',
    targetMinutes: 120,
    color: '#0284c7', // Sky Blue
    icon: '💻',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'habit-meditation',
    name: 'Mindful Meditation',
    targetMinutes: 30,
    color: '#10b981', // Emerald
    icon: '🌿',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: DEFAULT_HABITS,
      logs: {},
      selectedDate: getTodayString(),
      currentMonthDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      isLoading: false,

      setSelectedDate: (date: string) => {
        set({ selectedDate: date });
      },

      setCurrentMonthDate: (date: Date) => {
        const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        set({ currentMonthDate: firstOfMonth.toISOString() });
      },

      nextMonth: () => {
        const current = new Date(get().currentMonthDate);
        current.setMonth(current.getMonth() + 1);
        set({ currentMonthDate: current.toISOString() });
      },

      prevMonth: () => {
        const current = new Date(get().currentMonthDate);
        current.setMonth(current.getMonth() - 1);
        set({ currentMonthDate: current.toISOString() });
      },

      goToToday: () => {
        const today = getTodayString();
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        set({
          selectedDate: today,
          currentMonthDate: firstOfMonth.toISOString(),
        });
      },

      createHabit: async (data) => {
        const id = 'habit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newHabit: Habit = {
          id,
          name: data.name.trim(),
          targetMinutes: Math.max(5, data.targetMinutes || 30),
          color: data.color || '#8b5cf6',
          icon: data.icon,
          projectId: data.projectId ?? null,
          projectTag: data.projectTag ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          habits: [...state.habits, newHabit],
        }));

        // Background sync to Supabase if authenticated and table exists
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('habits').insert({
              id: newHabit.id,
              user_id: user.id,
              name: newHabit.name,
              target_minutes: newHabit.targetMinutes,
              color: newHabit.color,
              icon: newHabit.icon,
              project_id: newHabit.projectId,
              project_tag: newHabit.projectTag,
              created_at: newHabit.createdAt,
              updated_at: newHabit.updatedAt,
            });
          }
        } catch (err) {
          console.debug('Habit saved locally (Supabase optional):', err);
        }

        return newHabit;
      },

      updateHabit: async (id, updates) => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
          ),
        }));

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const dbUpdates: any = { updated_at: new Date().toISOString() };
            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.targetMinutes !== undefined) dbUpdates.target_minutes = updates.targetMinutes;
            if (updates.color !== undefined) dbUpdates.color = updates.color;
            if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
            if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
            if (updates.projectTag !== undefined) dbUpdates.project_tag = updates.projectTag;

            await supabase.from('habits').update(dbUpdates).eq('id', id).eq('user_id', user.id);
          }
        } catch (err) {
          console.debug('Habit updated locally:', err);
        }
      },

      deleteHabit: async (id) => {
        set((state) => {
          // Remove from habits list
          const nextHabits = state.habits.filter((h) => h.id !== id);
          // Clean up this habit from all day logs
          const nextLogs: HabitLogMap = {};
          for (const [date, dayMap] of Object.entries(state.logs)) {
            const copy = { ...dayMap };
            delete copy[id];
            if (Object.keys(copy).length > 0) {
              nextLogs[date] = copy;
            }
          }
          return { habits: nextHabits, logs: nextLogs };
        });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('habits').delete().eq('id', id).eq('user_id', user.id);
            await supabase.from('habit_logs').delete().eq('habit_id', id).eq('user_id', user.id);
          }
        } catch (err) {
          console.debug('Habit deleted locally:', err);
        }
      },

      saveDayLogs: async (date, habitMinutesMap) => {
        set((state) => {
          const nextLogs = { ...state.logs };
          // Filter out 0 minutes or negative values to keep logs clean
          const cleaned: Record<string, number> = {};
          for (const [hId, mins] of Object.entries(habitMinutesMap)) {
            if (mins > 0) {
              cleaned[hId] = mins;
            }
          }

          if (Object.keys(cleaned).length > 0) {
            nextLogs[date] = cleaned;
          } else {
            delete nextLogs[date];
          }

          return { logs: nextLogs };
        });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Delete old logs for this date, then insert updated ones
            await supabase.from('habit_logs').delete().eq('user_id', user.id).eq('date', date);

            const rowsToInsert = Object.entries(habitMinutesMap)
              .filter(([_, mins]) => mins > 0)
              .map(([habitId, mins]) => ({
                user_id: user.id,
                habit_id: habitId,
                date,
                minutes: mins,
                updated_at: new Date().toISOString(),
              }));

            if (rowsToInsert.length > 0) {
              await supabase.from('habit_logs').insert(rowsToInsert);
            }
          }
        } catch (err) {
          console.debug('Day log saved locally:', err);
        }
      },

      clearDayLogs: async (date) => {
        set((state) => {
          const nextLogs = { ...state.logs };
          delete nextLogs[date];
          return { logs: nextLogs };
        });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('habit_logs').delete().eq('user_id', user.id).eq('date', date);
          }
        } catch (err) {
          console.debug('Day log cleared locally:', err);
        }
      },

      fetchFromSupabase: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Fetch habits
          const { data: habitsData, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (!habitsError && habitsData && habitsData.length > 0) {
            const mappedHabits: Habit[] = habitsData.map((row: any) => ({
              id: row.id,
              userId: row.user_id,
              name: row.name,
              targetMinutes: row.target_minutes || 60,
              color: row.color || '#8b5cf6',
              icon: row.icon,
              projectId: row.project_id ?? null,
              projectTag: row.project_tag ?? null,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }));
            set({ habits: mappedHabits });
          }

          // Fetch logs
          const { data: logsData, error: logsError } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('user_id', user.id);

          if (!logsError && logsData) {
            const nextLogs: HabitLogMap = {};
            for (const row of logsData) {
              if (!nextLogs[row.date]) nextLogs[row.date] = {};
              nextLogs[row.date][row.habit_id] = row.minutes;
            }
            set({ logs: nextLogs });
          }
        } catch (err) {
          console.debug('Supabase sync skipped/deferred:', err);
        }
      },
    }),
    {
      name: 'mindmap-habits-storage',
      partialize: (state) => ({
        habits: state.habits,
        logs: state.logs,
        selectedDate: state.selectedDate,
      }),
    }
  )
);
