import { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, CheckCircle2, Clock, AlertCircle, AlertTriangle } from 'lucide-react';
import type { WorkTask } from '../../../types';
import {
  toLocalInputValue,
  fromLocalInputValue,
  formatDateTime,
  validateTimestamps,
} from '../../../utils/taskTime';

export type TaskConfirmAction = 'start' | 'pause' | 'resume' | 'complete';

interface TaskTimeConfirmModalProps {
  task: WorkTask;
  action: TaskConfirmAction;
  runningTaskTitle?: string | null;
  defaultTimeISO?: string | null;
  onClose: () => void;
  onConfirm: (isoTimestamp: string) => Promise<void>;
}

export function TaskTimeConfirmModal({
  task,
  action,
  runningTaskTitle,
  defaultTimeISO,
  onClose,
  onConfirm,
}: TaskTimeConfirmModalProps) {
  const inputId = useId();
  const [localTime, setLocalTime] = useState(() => toLocalInputValue(defaultTimeISO));
  const [allowFuture, setAllowFuture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = {
    start: {
      title: 'Start Task',
      prompt: 'Are you starting this task now?',
      btnText: 'Confirm & Start',
      icon: <Play className="w-4 h-4 fill-current" />,
      accent: 'bg-accent/20 text-accent',
      btnCls: 'bg-accent/20 hover:bg-accent/20',
    },
    pause: {
      title: 'Pause Task',
      prompt: 'When did you pause working on this task?',
      btnText: 'Confirm & Pause',
      icon: <Pause className="w-4 h-4 fill-current" />,
      accent: 'bg-surface-2 text-text-secondary',
      btnCls: 'bg-surface-2 hover:bg-surface-2',
    },
    resume: {
      title: 'Resume Task',
      prompt: 'Are you resuming this task now?',
      btnText: 'Confirm & Resume',
      icon: <Play className="w-4 h-4 fill-current" />,
      accent: 'bg-accent/20 text-accent',
      btnCls: 'bg-accent/20 hover:bg-accent/20',
    },
    complete: {
      title: 'Complete Task',
      prompt: 'Are you finishing this task now?',
      btnText: 'Confirm & Finish',
      icon: <CheckCircle2 className="w-4 h-4" />,
      accent: 'bg-accent/20 text-accent',
      btnCls: 'bg-accent/20 hover:bg-accent/20',
    },
  }[action];

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const iso = fromLocalInputValue(localTime);
    if (!iso) {
      setError('Please provide a valid date and time.');
      return;
    }

    // Validation
    let validation: { valid: boolean; error?: string };
    if (action === 'start' || action === 'resume') {
      validation = validateTimestamps(iso, undefined, allowFuture);
    } else if (action === 'pause') {
      // Pause time must be >= active segment start
      const segmentStart = task.activeSegmentStartedAt || task.startedAt;
      validation = validateTimestamps(segmentStart, iso, allowFuture);
    } else {
      // Complete
      validation = validateTimestamps(task.startedAt, iso, allowFuture);
    }

    if (!validation.valid) {
      setError(validation.error || 'Invalid timestamp.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(iso);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${config.accent}`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-text">{config.title}</h3>
              <p className="text-xs text-text-secondary">{config.prompt}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-6 flex flex-col gap-4">
          {/* Running Task Switch Notice */}
          {runningTaskTitle && runningTaskTitle !== task.title && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-2 border border-border-strong text-xs text-text-secondary animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-text-secondary flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span>Task <strong>"{runningTaskTitle}"</strong> is currently active and will be automatically paused at this timestamp.</span>
              </div>
            </div>
          )}

          {/* Task Info Pill */}
          <div className="p-3 rounded-lg bg-bg border border-border flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Task
            </span>
            <p className="text-sm font-semibold text-text truncate">{task.title}</p>
            {task.startedAt && (
              <span className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                First started: {formatDateTime(task.startedAt)}
              </span>
            )}
          </div>

          {/* Timestamp Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {action === 'start'
                ? 'Start Time'
                : action === 'pause'
                ? 'Pause Time'
                : action === 'resume'
                ? 'Resume Time'
                : 'Completion Time'}
            </label>
            <div className="relative">
              <input
                id={inputId}
                type="datetime-local"
                value={localTime}
                onChange={(e) => {
                  setLocalTime(e.target.value);
                  setError(null);
                }}
                className="w-full bg-bg text-text border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all font-mono"
              />
            </div>
            <p className="text-[11px] text-text-secondary">
              Pre-filled with time. You can edit this before confirming.
            </p>
          </div>

          {/* Future time override option */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="allow-future"
              checked={allowFuture}
              onChange={(e) => {
                setAllowFuture(e.target.checked);
                setError(null);
              }}
              className="rounded bg-bg border-border text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="allow-future" className="text-xs text-text-secondary cursor-pointer select-none">
              Allow future date/time
            </label>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-text rounded-lg transition shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${config.btnCls}`}
            >
              {config.icon}
              <span>{isSubmitting ? 'Saving...' : config.btnText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
