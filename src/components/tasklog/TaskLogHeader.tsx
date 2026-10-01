import { ChevronLeft, ChevronRight, Calendar, Plus, Sparkles, AlertCircle, Coffee, Play } from 'lucide-react';
import type { WorkTask } from '../../types';
import { toDateStr, getRelativeDateLabel } from '../../utils/taskTime';

interface TaskLogHeaderProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  onNewTask: () => void;
  pastUnfinishedCount: number;
  onOpenCarryover: () => void;
  runningTask?: WorkTask | null;
  lastPausedTask?: WorkTask | null;
  onPauseRunningTask?: () => void;
  onResumeLastTask?: () => void;
}

export function TaskLogHeader({
  selectedDate,
  onDateChange,
  onNewTask,
  pastUnfinishedCount,
  onOpenCarryover,
  runningTask,
  lastPausedTask,
  onPauseRunningTask,
  onResumeLastTask,
}: TaskLogHeaderProps) {
  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() - 1);
    onDateChange(toDateStr(d));
  };

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + 1);
    onDateChange(toDateStr(d));
  };

  const handleToday = () => {
    onDateChange(toDateStr(new Date()));
  };

  const isCurrentToday = selectedDate === toDateStr(new Date());

  return (
    <div className="flex flex-col bg-surface border-b border-border flex-shrink-0">
      {/* Carryover notice banner if past tasks exist */}
      {pastUnfinishedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 border-b border-border-strong text-xs text-text-secondary animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-text-secondary flex-shrink-0" />
            <span>
              You have <strong className="text-text-secondary">{pastUnfinishedCount}</strong> unfinished{' '}
              {pastUnfinishedCount === 1 ? 'task' : 'tasks'} from earlier days.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenCarryover}
            className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-2 border border-border-strong text-text-secondary rounded-lg font-semibold transition active:scale-95 text-xs shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-text-secondary" />
            Review & Carry Over
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Left: Day Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevDay}
            title="Previous Day"
            className="p-1.5 hover:bg-surface-2 rounded-lg transition text-text-secondary hover:text-text"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              isCurrentToday
                ? 'bg-accent/20 text-accent border border-accent'
                : 'text-text-secondary hover:text-text hover:bg-surface-2'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleNextDay}
            title="Next Day"
            className="p-1.5 hover:bg-surface-2 rounded-lg transition text-text-secondary hover:text-text"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-surface-2 mx-1" />

          {/* Date Picker Input */}
          <div className="flex items-center gap-2 relative group">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-text">
              {getRelativeDateLabel(selectedDate)}{' '}
              <span className="text-xs text-text-secondary font-normal">({selectedDate})</span>
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              title="Click to jump to date"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {runningTask && onPauseRunningTask && (
            <button
              type="button"
              onClick={onPauseRunningTask}
              title={`Pause running task "${runningTask.title}"`}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface-2 text-text-secondary border border-border-strong rounded-xl text-xs font-bold transition shadow-sm active:scale-95 animate-in fade-in"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Take a Break</span>
            </button>
          )}

          {!runningTask && lastPausedTask && onResumeLastTask && (
            <button
              type="button"
              onClick={onResumeLastTask}
              title={`Resume "${lastPausedTask.title}"`}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent/20 hover:bg-accent/20 text-accent border border-accent rounded-xl text-xs font-bold transition shadow-sm active:scale-95 animate-in fade-in max-w-[200px]"
            >
              <Play className="w-3.5 h-3.5 fill-current flex-shrink-0" />
              <span className="truncate">Resume {lastPausedTask.title}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewTask}
            className="flex items-center gap-2 bg-accent/20 hover:bg-accent/20 text-text px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>
    </div>
  );
}
