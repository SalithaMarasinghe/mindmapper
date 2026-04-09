import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import type { MindmapNode } from '../../types';
import type { NodeContent } from '../../types';
import RichEditor from '../editor/RichEditor';

interface QuickPreviewModalProps {
  node: MindmapNode;
  breadcrumb: string[];
  content: NodeContent | null;
  isLoading: boolean;
  onClose: () => void;
  showOpenButton?: boolean;
}

const isEditingElementFocused = () => {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  return Boolean(
    active.closest('[contenteditable]') ||
    active.closest('.bn-editor') ||
    active.tagName === 'INPUT' ||
    active.tagName === 'TEXTAREA'
  );
};

export function QuickPreviewModal({
  node,
  breadcrumb,
  content,
  isLoading,
  onClose,
  showOpenButton = true,
}: QuickPreviewModalProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditingElementFocused()) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="preview-modal-backdrop" onClick={onClose}>
      <div className="preview-modal-box animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition"
          aria-label="Close modal"
        >
          <X className="w-4 h-4 mx-auto" />
        </button>

        <div className="preview-modal-header">
          <div className="flex items-center gap-3 pr-10">
            <h2 className="text-xl font-bold text-[var(--color-text)]">{node.label}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${content?.isCompleted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {content?.isCompleted ? 'Studied ✓' : 'Not studied yet'}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5">{breadcrumb.join(' > ')}</p>
        </div>

        <div className="preview-modal-content p-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
              <div className="h-24 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          ) : content?.richContent && content.richContent.length > 0 ? (
            <div className="bg-[var(--color-surface)]">
              <RichEditor
                nodeId={node.id}
                mapId={node.mapId}
                initialContent={content.richContent}
                onSave={() => {}}
                readOnly
              />
            </div>
          ) : (
            <div className="h-full min-h-56 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
              No study material added yet for this node.
            </div>
          )}
        </div>

        <div className="preview-modal-footer">
          {showOpenButton && (
            <button
              onClick={() => {
                onClose();
                navigate(`/map/${node.mapId}/node/${node.id}`);
              }}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition"
            >
              Open Full Page →
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
