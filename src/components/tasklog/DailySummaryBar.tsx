import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, ListTodo } from 'lucide-react';
import type { WorkTask } from '../../types';
import { calculateLiveTrackedSeconds, formatDuration } from '../../utils/taskTime';

interface DailySummaryBarProps {
  tasks: WorkTask[];
}

export function DailySummaryBar({ tasks }: DailySummaryBarProps) {
  const [, setTick] = useState(0);

  // If any task is actively running with activeSegmentStartedAt, tick live
  useEffect(() => {
    const hasRunning = tasks.some(
      (t) => t.status === 'in_progress' && !t.isPaused && Boolean(t.activeSegmentStartedAt)
    );
    if (!hasRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  const completedTasks = tasks.filter((t) => t.status === 'done');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const todoTasks = tasks.filter((t) => t.status === 'todo');

  const totalCount = tasks.length;
  const completedCount = completedTasks.length;
  const openCount = todoTasks.length + inProgressTasks.length;

  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Calculate total tracked time across all tasks (completed + in progress)
  const totalTrackedSeconds = tasks.reduce((acc, t) => {
    return acc + calculateLiveTrackedSeconds(t.trackedSeconds, t.activeSegmentStartedAt);
  }, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-2.5 bg-[#131722] border-b border-[#2d3748]">
      {/* 1. Completed Progress */}
      <div className="flex items-center gap-3 bg-[#1e2433] px-3.5 py-2 rounded-xl border border-[#2d3748]/60">
        <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Completed</span>
            <span className="text-slate-200">
              {completedCount} / {totalCount}{' '}
              <span className="text-slate-500 font-normal">({percentCompleted}%)</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#0f1117] rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${percentCompleted}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Total Tracked Time */}
      <div className="flex items-center gap-3 bg-[#1e2433] px-3.5 py-2 rounded-xl border border-[#2d3748]/60">
        <div className="p-2 rounded-lg bg-teal-950/60 text-teal-400 border border-teal-800/60">
          <Clock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-400 block">Total Tracked Time</span>
          <p className="text-sm font-bold text-teal-300 font-mono mt-0.5">
            {formatDuration(totalTrackedSeconds)}
          </p>
        </div>
      </div>

      {/* 3. Open Tasks */}
      <div className="flex items-center gap-3 bg-[#1e2433] px-3.5 py-2 rounded-xl border border-[#2d3748]/60">
        <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/60">
          <ListTodo className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-400 block">Open Tasks</span>
          <p className="text-sm font-bold text-amber-300 mt-0.5">
            {openCount}{' '}
            <span className="text-xs text-slate-500 font-normal">
              ({todoTasks.length} to do, {inProgressTasks.length} in progress)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
