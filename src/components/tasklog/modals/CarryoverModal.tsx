import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, Calendar, Flag, CheckSquare, Square } from 'lucide-react';
import type { WorkTask } from '../../../types';
import { toDateStr } from '../../../utils/taskTime';

interface CarryoverModalProps {
  tasks: WorkTask[];
  onClose: () => void;
  onCarryover: (taskIds: string[], targetDate: string) => Promise<void>;
}

export function CarryoverModal({ tasks, onClose, onCarryover }: CarryoverModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => tasks.map((t) => t.id));
  const [targetDate, setTargetDate] = useState(() => toDateStr(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allSelected = selectedIds.length === tasks.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map((t) => t.id));
    }
  };

  const toggleTask = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsSubmitting(true);
      await onCarryover(selectedIds, targetDate);
      onClose();
    } catch (err) {
      console.error('Failed to carryover tasks:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className="fixed inset-0 bg-[#0f1117]/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-[#1e2433] rounded-2xl shadow-2xl border border-[#2d3748] overflow-hidden my-auto flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3748] bg-[#161b26]">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>⚡ Carry Over Unfinished Tasks</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Move pending tasks from previous days to a new date
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#2d3748] rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {/* Target Date Picker */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f1117] border border-[#2d3748]">
            <span className="text-xs font-semibold text-slate-300">Move selected tasks to:</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-[#1e2433] text-slate-200 border border-[#2d3748] rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Select all toggle bar */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-slate-300 hover:text-teal-400 transition"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-teal-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>{allSelected ? 'Deselect All' : 'Select All'} ({tasks.length} tasks)</span>
            </button>
            <span>{selectedIds.length} selected</span>
          </div>

          {/* Task List */}
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {tasks.map((task) => {
              const isSelected = selectedIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1b2536] border-teal-600/50 text-slate-100 shadow-sm'
                      : 'bg-[#0f1117] border-[#2d3748] text-slate-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="mt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-teal-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-sm font-semibold truncate">{task.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Was planned: {task.plannedDate}
                      </span>
                      <span>•</span>
                      <span className="capitalize flex items-center gap-0.5">
                        <Flag className="w-3 h-3" /> {task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#2d3748] bg-[#161b26]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-[#2d3748] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isSubmitting}
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition shadow-sm active:scale-95 disabled:opacity-50"
          >
            <span>Move {selectedIds.length} Tasks to {targetDate}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
