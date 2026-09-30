import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  title: string;
  message?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  title,
  message = 'Are you sure you want to delete this task? All tracking history and logs will be permanently removed. This action cannot be undone.',
  onClose,
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0f1117]/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#1e2433] rounded-2xl shadow-2xl border border-[#2d3748] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3748] bg-[#161b26]">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold text-slate-100">Delete Confirmation</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#2d3748] rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl">
            <p className="text-sm font-semibold text-rose-200 mb-1">"{title}"</p>
            <p className="text-xs text-rose-300/80 leading-relaxed">{message}</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-[#2d3748] rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Deleting...' : 'Delete Task'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
