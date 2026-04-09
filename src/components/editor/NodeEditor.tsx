import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMapStore } from '../../store/mapStore';
import { useContentStore } from '../../store/contentStore';
import RichEditor from '@/components/editor/RichEditor';

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

export function NodeEditor({ 
  nodeId, 
  mapId,
  isTestMode = false,
  onToggleTestMode
}: { 
  nodeId: string; 
  mapId: string;
  isTestMode?: boolean;
  onToggleTestMode?: (val: boolean) => void;
}) {
  const { nodes } = useMapStore();
  const { getOrCreateContent, content, saveStatus, retrySave, updateContent, markComplete, markIncomplete } = useContentStore();
  const [isNotesHidden, setIsNotesHidden] = useState(false);

  useEffect(() => {
    getOrCreateContent(nodeId, mapId);
  }, [nodeId, mapId, getOrCreateContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingElementFocused()) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const newVal = !isTestMode;
        if (onToggleTestMode) onToggleTestMode(newVal);
        if (newVal) toast.success('Test mode on — good luck! 🧠');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTestMode, onToggleTestMode]);

  const handleToggleTestMode = () => {
    const newVal = !isTestMode;
    if (onToggleTestMode) onToggleTestMode(newVal);
    if (newVal) toast.success('Test mode on — good luck! 🧠');
  };

  const nodeContent = content[nodeId];
  const status = saveStatus[nodeId] || 'saved';
  const currentNode = nodes.find((n) => n.id === nodeId);
  const isCompleted = nodeContent?.isCompleted || false;

  if (!nodeContent) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-teal-500 animate-spin" />
      </div>
    );
  }

  const lastSavedTime = nodeContent.lastEdited 
    ? new Date(nodeContent.lastEdited).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const initialContent = nodeContent.richContent;

  function handleSave(blocks: unknown[]) {
    updateContent(nodeId, { richContent: blocks });
  }

  const handleStudyToggle = () => {
    if (isCompleted) {
      markIncomplete(nodeId);
    } else {
      markComplete(nodeId);
    }
  };

  return (
    <div className="node-study-page flex flex-col h-full bg-[#f8fafc] w-full pb-16">
      <div className="node-page-header flex items-center justify-between py-4 px-1 xl:px-4 sticky top-0 bg-[#f8fafc]/95 backdrop-blur z-10 border-b border-transparent mb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          {currentNode?.label || 'Study Material'}
        </h1>
        <div className="node-page-actions flex items-center gap-2">
          <button
            onClick={handleToggleTestMode}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            title="Toggle with Cmd/Ctrl + T"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isTestMode ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {isTestMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isTestMode ? '📖 Study Mode' : '🧠 Test Mode'}
          </button>
          <button
            onClick={handleStudyToggle}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className={`text-sm font-bold px-4 py-2 rounded-lg border transition ${isCompleted ? 'btn-completed bg-white text-green-700 border-green-200 hover:bg-green-50' : 'btn-mark-complete bg-green-600 text-white border-transparent hover:bg-green-700'}`}
          >
            {isCompleted ? '✓ Studied' : 'Mark as Studied'}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center pb-4 px-1 xl:px-4">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Study Material</h2>
        <div className="text-sm font-semibold flex items-center gap-1.5 transition-colors">
          {status === 'unsaved' && (
            <span className="text-gray-400">Unsaved changes...</span>
          )}
          {status === 'saving' && (
            <span className="text-teal-600 flex items-center gap-1.5 bg-teal-50 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Saving...
            </span>
          )}
          {status === 'saved' && (
            <span className="text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full">
              Saved ✓ at {lastSavedTime}
            </span>
          )}
          {status === 'failed' && (
            <button 
              onClick={() => retrySave(nodeId)}
              className="text-red-600 flex items-center gap-1 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition-colors"
            >
              Save failed ✗ — retry?
            </button>
          )}
        </div>
      </div>

      {isTestMode && (
        <div className="mx-1 xl:mx-4 mb-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800 flex items-center justify-between gap-4">
          <span>🧠 Test Mode — read your notes, then hide them to test recall</span>
          <button
            onClick={() => setIsNotesHidden((prev) => !prev)}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
          >
            {isNotesHidden ? 'Reveal' : 'Hide Notes'}
          </button>
        </div>
      )}

      <div className={`flex-1 w-full max-w-4xl mx-auto px-1 xl:px-4 ${isTestMode && isNotesHidden ? 'notes-hidden' : ''}`}>
        <RichEditor
          nodeId={nodeId}
          mapId={mapId}
          initialContent={initialContent}
          onSave={handleSave}
          readOnly={isTestMode}
        />
      </div>
    </div>
  );
}
