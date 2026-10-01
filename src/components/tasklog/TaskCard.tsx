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
    high: 'bg-surface-2 text-text border-border-strong',
    medium: 'bg-surface-2 text-text-secondary border-border-strong',
    low: 'bg-surface-2 text-text-secondary border-border-strong',
  }[task.priority];

  return (
    <div
      onClick={onClick}
      className={`group relative bg-surface hover:bg-surface-2 border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 flex flex-col gap-3 cursor-pointer select-none ${
        isRunning
          ? 'border-accent shadow-accent/20 ring-1 ring-accent'
          : isPaused
          ? 'border-border-strong bg-surface'
          : 'border-border hover:border-border-strong'
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
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent/20 animate-ping" />
              Running
            </span>
          )}

          {isPaused && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-text-secondary border border-border-strong">
              <Pause className="w-2.5 h-2.5 fill-current" />
              Paused
            </span>
          )}

          {isDifferentDate && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                isOverdue
                  ? 'bg-surface-2 text-text-secondary border-border-strong'
                  : 'bg-surface text-text-secondary border-border'
              }`}
            >
              {isOverdue && <AlertTriangle className="w-2.5 h-2.5 text-text-secondary" />}
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
            className="p-1 text-text-secondary hover:text-text hover:bg-surface-2 rounded-md transition opacity-80 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-surface rounded-xl shadow-xl border border-border py-1 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface-2 hover:text-text transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-accent" />
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface-2 transition"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-accent hover:bg-surface-2 transition"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface-2 hover:text-text transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-text-secondary" />
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
                    className="w-full flex items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface-2 hover:text-text transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-text-secondary" />
                    Reopen to In Progress
                  </button>
                )}

                <div className="my-1 border-t border-border" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-text hover:bg-surface-2 hover:text-text transition"
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
      <h3 className="text-sm font-semibold text-text group-hover:text-text transition line-clamp-2 leading-snug">
        {task.title}
      </h3>

      {/* Description Markdown Preview Snippet */}
      {task.description && (
        <div className="text-xs text-text-secondary max-h-12 overflow-hidden line-clamp-2 pointer-events-none opacity-80 group-hover:opacity-95">
          <MarkdownViewer content={task.description} />
        </div>
      )}

      {/* Timing and Status Details */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
        {/* Status Time Info */}
        <div className="flex items-center gap-1.5 text-text-secondary">
          {task.status === 'todo' && (
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {task.plannedDate === toDateStr(new Date()) ? 'Planned for Today' : task.plannedDate}
            </span>
          )}

          {task.status === 'in_progress' && (
            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <div className="flex items-center gap-1.5 text-accent font-medium">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span className="font-mono">{formatDuration(liveSeconds)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-text-secondary font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono">{formatDuration(task.trackedSeconds)}</span>
                  <span className="text-[10px] text-text-muted">(paused)</span>
                </div>
              )}
            </div>
          )}

          {task.status === 'done' && (
            <div className="flex flex-col text-[11px] text-text-secondary">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                <span className="text-accent font-semibold font-mono">
                  {formatDuration(task.trackedSeconds)}
                </span>
              </div>
              {task.startedAt && task.completedAt && (
                <span className="text-[10px] text-text-muted pl-5">
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
              className="flex items-center gap-1.5 px-3 py-1 bg-accent/20 hover:bg-accent/20 text-accent border border-accent rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
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
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-surface-2 text-text-secondary border border-border-strong rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResume}
                  title="Resume Task"
                  className="flex items-center gap-1 px-2.5 py-1 bg-accent/20 hover:bg-accent/20 text-accent border border-accent rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Resume
                </button>
              )}

              <button
                type="button"
                onClick={onComplete}
                title="Complete Task"
                className="flex items-center gap-1 px-2.5 py-1 bg-accent/20 hover:bg-accent/20 text-accent border border-accent rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
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
              className="p-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-2 rounded-md transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
