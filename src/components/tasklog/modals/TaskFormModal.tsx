import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Save, Calendar, Flag, Sparkles } from 'lucide-react';
import type { WorkTask, TaskPriority } from '../../../types';
import { MarkdownEditor } from '../../common/MarkdownEditor';
import { toDateStr } from '../../../utils/taskTime';

interface TaskFormModalProps {
  initialTask?: WorkTask;
  defaultPlannedDate?: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: TaskPriority;
    plannedDate: string;
  }) => Promise<void>;
}

export function TaskFormModal({
  initialTask,
  defaultPlannedDate,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const isEditing = Boolean(initialTask);
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || 'medium');
  const [plannedDate, setPlannedDate] = useState(
    initialTask?.plannedDate || defaultPlannedDate || toDateStr(new Date())
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    setError(null);

    try {
      setIsSubmitting(true);
      await onSubmit({
        title: title.trim(),
        description,
        priority,
        plannedDate,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-[#0a0a0a] rounded-2xl shadow-2xl border border-[#1a1a1a] overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] bg-[#0a0a0a] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-900/40 text-teal-300 border border-teal-700/50">
              {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {isEditing ? 'Edit Task' : 'Create New Task'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Update task details and markdown content' : 'Add a task to your To Do column'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#141414] rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Title Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Title <span className="text-teal-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Design authentication modal and session refresh logic"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-[#000000] text-slate-100 border border-[#1a1a1a] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder:text-slate-500 transition-all font-medium"
            />
          </div>

          {/* Metadata Row: Priority & Planned Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-slate-400" /> Priority
              </label>
              <div className="grid grid-cols-3 gap-2 bg-[#000000] p-1 rounded-lg border border-[#1a1a1a]">
                {(['low', 'medium', 'high'] as const).map((p) => {
                  const active = priority === p;
                  let activeCls = 'bg-teal-900/70 text-teal-300 border-teal-700/60 shadow-sm';
                  if (p === 'high') activeCls = 'bg-rose-900/70 text-rose-300 border-rose-700/60 shadow-sm';
                  if (p === 'medium') activeCls = 'bg-amber-900/70 text-amber-300 border-amber-700/60 shadow-sm';

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 text-xs font-bold capitalize rounded-md border border-transparent transition-all ${
                        active
                          ? activeCls
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#0a0a0a]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Planned Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Planned Date
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full bg-[#000000] text-slate-100 border border-[#1a1a1a] rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Markdown Description */}
          <div className="flex flex-col gap-2 flex-1 min-h-[260px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                Description / Spec <span className="text-slate-500 font-normal lowercase">(markdown supported)</span>
              </label>
              <span className="text-[11px] text-teal-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Copy-paste from AI chat formats automatically
              </span>
            </div>

            <MarkdownEditor
              value={description}
              onChange={setDescription}
              placeholder="Paste your AI generated task outline, bullet points, code snippets, or notes here..."
              minHeight="220px"
              className="flex-1"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1a1a1a] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-[#141414] rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                'Saving...'
              ) : isEditing ? (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
