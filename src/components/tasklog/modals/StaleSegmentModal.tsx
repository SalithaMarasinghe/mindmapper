import { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Clock, AlertCircle } from 'lucide-react';
import type { WorkTask, TaskTimeEntry } from '../../../types';
import {
  toLocalInputValue,
  fromLocalInputValue,
  formatDateTime,
  validateTimestamps,
} from '../../../utils/taskTime';

interface StaleSegmentModalProps {
  task: WorkTask;
  entry: TaskTimeEntry;
  onClose: () => void;
  onConfirm: (stopTimeISO: string) => Promise<void>;
}

export function StaleSegmentModal({
  task,
  entry,
  onClose,
  onConfirm,
}: StaleSegmentModalProps) {
  const inputId = useId();
  const [stopLocalTime, setStopLocalTime] = useState(() => toLocalInputValue());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const iso = fromLocalInputValue(stopLocalTime);
    if (!iso) {
      setError('Please provide a valid stop time.');
      return;
    }

    const validation = validateTimestamps(entry.startedAt, iso, false);
    if (!validation.valid) {
      setError(validation.error || 'Invalid stop time.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(iso);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close stale segment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0f1117]/85 backdrop-blur-sm animate-in fade-in duration-200"
      />
      <div className="relative w-full max-w-lg bg-[#1e2433] rounded-2xl shadow-2xl border border-amber-800/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#2d3748] bg-amber-950/30">
          <div className="p-2 rounded-lg bg-amber-900/60 text-amber-300">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Task Left Running</h3>
            <p className="text-xs text-amber-300/80">An active work timer was left open</p>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="p-6 flex flex-col gap-4">
          <div className="p-3.5 bg-[#0f1117] rounded-xl border border-[#2d3748] flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Running Task
            </span>
            <p className="text-sm font-bold text-slate-100">{task.title}</p>
            <div className="flex items-center gap-1.5 text-xs text-amber-300 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Started on: {formatDateTime(entry.startedAt)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            This task has been running continuously since a previous session. When did you stop working on it?
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Stop Time
            </label>
            <input
              id={inputId}
              type="datetime-local"
              required
              value={stopLocalTime}
              onChange={(e) => {
                setStopLocalTime(e.target.value);
                setError(null);
              }}
              className="w-full bg-[#0f1117] text-slate-100 border border-[#2d3748] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d3748]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Keep Running
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition active:scale-95 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Set Stop Time & Pause'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
