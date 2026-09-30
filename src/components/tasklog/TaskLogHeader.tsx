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
    <div className="flex flex-col bg-[#1e2433] border-b border-[#2d3748] flex-shrink-0">
      {/* Carryover notice banner if past tasks exist */}
      {pastUnfinishedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 border-b border-amber-800/40 text-xs text-amber-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              You have <strong className="text-amber-100">{pastUnfinishedCount}</strong> unfinished{' '}
              {pastUnfinishedCount === 1 ? 'task' : 'tasks'} from earlier days.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenCarryover}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/60 text-amber-100 rounded-lg font-semibold transition active:scale-95 text-xs shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
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
            className="p-1.5 hover:bg-[#2d3748] rounded-lg transition text-slate-400 hover:text-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              isCurrentToday
                ? 'bg-teal-900/40 text-teal-300 border border-teal-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#2d3748]'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleNextDay}
            title="Next Day"
            className="p-1.5 hover:bg-[#2d3748] rounded-lg transition text-slate-400 hover:text-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-[#2d3748] mx-1" />

          {/* Date Picker Input */}
          <div className="flex items-center gap-2 relative group">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-bold text-slate-100">
              {getRelativeDateLabel(selectedDate)}{' '}
              <span className="text-xs text-slate-400 font-normal">({selectedDate})</span>
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
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-700/60 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 animate-in fade-in"
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
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-700/60 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 animate-in fade-in max-w-[200px]"
            >
              <Play className="w-3.5 h-3.5 fill-current flex-shrink-0" />
              <span className="truncate">Resume {lastPausedTask.title}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewTask}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>
    </div>
  );
}
