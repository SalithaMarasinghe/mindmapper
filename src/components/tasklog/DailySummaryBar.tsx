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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-2.5 bg-surface-2 border-b border-border">
      {/* 1. Completed Progress */}
      <div className="flex items-center gap-3 bg-surface px-3.5 py-2 rounded-xl border border-border">
        <div className="p-2 rounded-lg bg-accent/20 text-accent border border-accent">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-text-secondary">Completed</span>
            <span className="text-text">
              {completedCount} / {totalCount}{' '}
              <span className="text-text-muted font-normal">({percentCompleted}%)</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-accent/20 rounded-full transition-all duration-300"
              style={{ width: `${percentCompleted}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Total Tracked Time */}
      <div className="flex items-center gap-3 bg-surface px-3.5 py-2 rounded-xl border border-border">
        <div className="p-2 rounded-lg bg-accent/20 text-accent border border-accent">
          <Clock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-text-secondary block">Total Tracked Time</span>
          <p className="text-sm font-bold text-accent font-mono mt-0.5">
            {formatDuration(totalTrackedSeconds)}
          </p>
        </div>
      </div>

      {/* 3. Open Tasks */}
      <div className="flex items-center gap-3 bg-surface px-3.5 py-2 rounded-xl border border-border">
        <div className="p-2 rounded-lg bg-surface-2 text-text-secondary border border-border-strong">
          <ListTodo className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-text-secondary block">Open Tasks</span>
          <p className="text-sm font-bold text-text-secondary mt-0.5">
            {openCount}{' '}
            <span className="text-xs text-text-muted font-normal">
              ({todoTasks.length} to do, {inProgressTasks.length} in progress)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
