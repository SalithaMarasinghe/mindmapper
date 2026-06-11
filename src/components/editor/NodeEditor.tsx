import { useEffect, useState } from 'react';
import { Eye, EyeOff, FileDown, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMapStore } from '../../store/mapStore';
import { useContentStore } from '../../store/contentStore';
import { useSettingsStore } from '../../store/settingsStore';
import RichEditor from '@/components/editor/RichEditor';
import { exportBranchToPdf } from '../../utils/exportBranchToPdf';

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
  mapTitle = 'Mind Map',
  parentLabel,
  isTestMode = false,
  onToggleTestMode
}: { 
  nodeId: string; 
  mapId: string;
  mapTitle?: string;
  parentLabel?: string;
  isTestMode?: boolean;
  onToggleTestMode?: (val: boolean) => void;
}) {
  const { nodes } = useMapStore();
  const { getOrCreateContent, content, saveStatus, retrySave, updateContent, markComplete, markIncomplete } = useContentStore();
  const { isReadOnly } = useSettingsStore();
  const [isNotesHidden, setIsNotesHidden] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

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

  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    } else {
      setShowSaved(false);
    }
  }, [status]);

  const currentNode = nodes.find((n) => n.id === nodeId);
  const isCompleted = nodeContent?.isCompleted || false;

  if (!nodeContent) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />
      </div>
    );
  }

  const initialContent = nodeContent.richContent;

  function handleSave(blocks: unknown[]) {
    updateContent(nodeId, { richContent: blocks });
  }

  const { setSaveStatus } = useContentStore.getState();

  const handleStudyToggle = () => {
    if (isCompleted) {
      markIncomplete(nodeId);
    } else {
      markComplete(nodeId);
    }
  };

  const handleExportPdf = async () => {
    if (!currentNode || !nodeContent) return;
    setIsExporting(true);
    try {
      await exportBranchToPdf(currentNode, nodeContent, mapTitle, parentLabel);
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearContent = () => {
    if (window.confirm('Are you sure you want to completely erase all content on this page? This cannot be undone.')) {
      handleSave([]);
      setEditorKey(k => k + 1);
      toast.success('Content erased');
    }
  };

  return (
    <div className="node-study-page flex flex-col h-full bg-[#0f1117] w-full pb-16">
      <div className="node-page-header flex items-center justify-between py-4 px-1 xl:px-4 sticky top-0 bg-[#0f1117]/95 backdrop-blur z-10 border-b border-[#2d3748] mb-4">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
          {currentNode?.label || 'Study Material'}
          <div className="text-sm font-semibold flex items-center gap-1.5 transition-colors">
            {(status === 'unsaved' || status === 'saving') && (
              <span className="text-teal-400 flex items-center gap-1.5 bg-teal-900/30 px-2 py-0.5 rounded border border-teal-800 shadow-sm ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Saving...
              </span>
            )}
            {status === 'saved' && showSaved && (
              <span className="text-green-400 flex items-center gap-1 bg-green-900/30 px-2 py-0.5 rounded border border-green-800 shadow-sm transition-opacity duration-300 ml-2">
                Saved ✓
              </span>
            )}
            {status === 'failed' && (
              <button 
                onClick={() => retrySave(nodeId)}
                className="text-red-400 flex items-center gap-1 bg-red-900/30 px-2 py-0.5 rounded border border-red-800 shadow-sm hover:bg-red-900/50 transition-colors ml-2"
              >
                ⚠ Save failed — Retry
              </button>
            )}
          </div>
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isTestMode ? 'bg-orange-900/40 text-orange-300 hover:bg-orange-900/60' : 'text-slate-400 hover:bg-[#2d3748]'}`}
          >
            {isTestMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isTestMode ? '📖 Study Mode' : '🧠 Test Mode'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            title="Export this branch to PDF"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all text-teal-400 bg-teal-900/30 border border-teal-800 hover:bg-teal-900/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileDown className="w-4 h-4" />}
            {isExporting ? 'Exporting…' : 'Export PDF'}
          </button>
          {!isReadOnly && (
            <button
              onClick={handleClearContent}
              title="Erase all content"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all text-red-400 bg-red-900/10 border border-transparent hover:bg-red-900/30 hover:border-red-800/50"
            >
              <Trash2 className="w-4 h-4" />
              Erase
            </button>
          )}
          {!isReadOnly && (
            <button
              onClick={handleStudyToggle}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className={`text-sm font-bold px-4 py-2 rounded-lg border transition ${isCompleted ? 'bg-[#2d3748] text-green-400 border-green-800 hover:bg-[#3d4a60]' : 'bg-green-600 text-white border-transparent hover:bg-green-700'}`}
            >
              {isCompleted ? '✓ Studied' : 'Mark as Studied'}
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

      <div className={`flex-1 w-full px-1 xl:px-4 ${isTestMode && isNotesHidden ? 'notes-hidden' : ''}`}>
        <RichEditor
          key={`${nodeId}-${editorKey}`}
          nodeId={nodeId}
          mapId={mapId}
          initialContent={initialContent}
          onDirty={() => setSaveStatus(nodeId, 'unsaved')}
          onSave={handleSave}
          readOnly={isTestMode || isReadOnly}
        />
      </div>
    </div>
  );
}
