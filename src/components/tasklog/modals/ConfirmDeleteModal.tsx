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
        className="absolute inset-0 bg-bg backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2 text-text">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold text-text">Delete Confirmation</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="p-3 bg-surface-2 border border-border-strong rounded-xl">
            <p className="text-sm font-semibold text-text mb-1">"{title}"</p>
            <p className="text-xs text-text leading-relaxed">{message}</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-text bg-surface-2 hover:bg-surface-2 rounded-lg transition shadow-sm active:scale-95 disabled:opacity-50"
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
