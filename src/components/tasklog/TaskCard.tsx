import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import type { WorkTask } from '../../types';
import { MarkdownViewer } from '../common/MarkdownViewer';
import {
  formatTime,
  formatDuration,
  calculateLiveTrackedSeconds,
  toDateStr,
} from '../../utils/taskTime';

interface TaskCardProps {
  task: WorkTask;
  selectedDate: string;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onRevertToInProgress: () => void;
  onRevertToTodo: () => void;
}

export function TaskCard({
  task,
  selectedDate,
  onClick,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onResume,
  onComplete,
  onRevertToInProgress,
  onRevertToTodo,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setTick] = useState(0);

  const isRunning = task.status === 'in_progress' && !task.isPaused && Boolean(task.activeSegmentStartedAt);
  const isPaused = task.status === 'in_progress' && task.isPaused;

  // Live timer tick for active running tasks
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const liveSeconds = calculateLiveTrackedSeconds(
    task.trackedSeconds,
    isRunning ? task.activeSegmentStartedAt : null
  );

  const isOverdue = task.plannedDate < selectedDate && task.status !== 'done';
  const isDifferentDate = task.plannedDate !== selectedDate;

  const priorityBadge = {
    high: 'bg-rose-950/50 text-rose-300 border-rose-800/60',
    medium: 'bg-amber-950/50 text-amber-300 border-amber-800/60',
    low: 'bg-blue-950/50 text-blue-300 border-blue-800/60',
  }[task.priority];

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[#0a0a0a] hover:bg-[#141414] border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 flex flex-col gap-3 cursor-pointer select-none ${
        isRunning
          ? 'border-teal-600/70 shadow-teal-950/30 ring-1 ring-teal-500/20'
          : isPaused
          ? 'border-amber-700/60 bg-[#0a0a0a]/90'
          : 'border-[#1a1a1a] hover:border-slate-600'
      }`}
    >
      {/* Top Meta: Priority, Date, Status Pill, Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${priorityBadge}`}
          >
            {task.priority}
          </span>

          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-950/70 text-teal-300 border border-teal-700/70">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
              Running
            </span>
          )}

          {isPaused && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-700/70">
              <Pause className="w-2.5 h-2.5 fill-current" />
              Paused
            </span>
          )}

          {isDifferentDate && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                isOverdue
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                  : 'bg-[#0a0a0a] text-slate-400 border-slate-700'
              }`}
            >
              {isOverdue && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
              <Calendar className="w-2.5 h-2.5" />
              {task.plannedDate}
            </span>
          )}
        </div>

        {/* More Actions Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#141414] rounded-md transition opacity-80 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-[#0a0a0a] rounded-xl shadow-xl border border-[#1a1a1a] py-1 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-[#0f0f0f] hover:text-white transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-teal-400" />
                  Edit Task
                </button>

                {task.status === 'in_progress' && (
                  <>
                    {isRunning ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onPause();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-[#0f0f0f] transition"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause Task
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onResume();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-teal-300 hover:bg-[#0f0f0f] transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Resume Task
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onRevertToTodo();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-[#0f0f0f] hover:text-white transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                      Move back to To Do
                    </button>
                  </>
                )}

                {task.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRevertToInProgress();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-[#0f0f0f] hover:text-white transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    Reopen to In Progress
                  </button>
                )}

                <div className="my-1 border-t border-[#1a1a1a]" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Task
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition line-clamp-2 leading-snug">
        {task.title}
      </h3>

      {/* Description Markdown Preview Snippet */}
      {task.description && (
        <div className="text-xs text-slate-400 max-h-12 overflow-hidden line-clamp-2 pointer-events-none opacity-80 group-hover:opacity-95">
          <MarkdownViewer content={task.description} />
        </div>
      )}

      {/* Timing and Status Details */}
      <div className="pt-2 border-t border-[#1a1a1a]/60 flex items-center justify-between text-xs">
        {/* Status Time Info */}
        <div className="flex items-center gap-1.5 text-slate-400">
          {task.status === 'todo' && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {task.plannedDate === toDateStr(new Date()) ? 'Planned for Today' : task.plannedDate}
            </span>
          )}

          {task.status === 'in_progress' && (
            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <div className="flex items-center gap-1.5 text-teal-400 font-medium">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span className="font-mono">{formatDuration(liveSeconds)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-400/90 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono">{formatDuration(task.trackedSeconds)}</span>
                  <span className="text-[10px] text-slate-500">(paused)</span>
                </div>
              )}
            </div>
          )}

          {task.status === 'done' && (
            <div className="flex flex-col text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold font-mono">
                  {formatDuration(task.trackedSeconds)}
                </span>
              </div>
              {task.startedAt && task.completedAt && (
                <span className="text-[10px] text-slate-500 pl-5">
                  Span: {formatTime(task.startedAt)} – {formatTime(task.completedAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {task.status === 'todo' && (
            <button
              type="button"
              onClick={onStart}
              title="Start Task"
              className="flex items-center gap-1.5 px-3 py-1 bg-teal-900/50 hover:bg-teal-800/70 text-teal-300 border border-teal-700/60 rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
            >
              <Play className="w-3 h-3 fill-current" />
              Start
            </button>
          )}

          {task.status === 'in_progress' && (
            <>
              {isRunning ? (
                <button
                  type="button"
                  onClick={onPause}
                  title="Pause Task"
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-900/50 hover:bg-amber-800/70 text-amber-300 border border-amber-700/60 rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResume}
                  title="Resume Task"
                  className="flex items-center gap-1 px-2.5 py-1 bg-teal-900/50 hover:bg-teal-800/70 text-teal-300 border border-teal-700/60 rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Resume
                </button>
              )}

              <button
                type="button"
                onClick={onComplete}
                title="Complete Task"
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-900/50 hover:bg-emerald-800/70 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </button>
            </>
          )}

          {task.status === 'done' && (
            <button
              type="button"
              onClick={onRevertToInProgress}
              title="Reopen to In Progress"
              className="p-1.5 text-slate-500 hover:text-amber-300 hover:bg-[#141414] rounded-md transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
