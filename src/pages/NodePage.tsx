import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Brain, X } from 'lucide-react';

import { AppHeader } from '../components/layout/AppHeader';
import { NodeEditor } from '../components/editor/NodeEditor';

import { useMapStore } from '../store/mapStore';
import { useMapsStore } from '../store/mapsStore';
import { useContentStore } from '../store/contentStore';
import { DEFAULT_BRANCH_COLORS } from '../types';

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

export function NodePage() {
  const { mapId, nodeId } = useParams();
  const navigate = useNavigate();

  const { maps, getMapById, fetchMaps } = useMapsStore();
  const { nodes, loadMap } = useMapStore();
  const { loadContent, content, markComplete, markIncomplete } = useContentStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const loadNodeData = useCallback(async (cancelledRef?: { cancelled: boolean }) => {
    if (!mapId) {
      setLoadError('Could not load this node. Check your connection.');
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    setLoadError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;

    timeoutId = setTimeout(() => {
      timedOut = true;
      if (!cancelledRef?.cancelled) {
        setIsLoaded(true);
        setLoadError('Could not load this node. Check your connection.');
      }
    }, 5000);

    try {
      if (maps.length === 0) await fetchMaps();
      if (cancelledRef?.cancelled || timedOut) return;

      await loadMap(mapId);
      if (cancelledRef?.cancelled || timedOut) return;

      // Missing node_content rows are valid fresh-state; loadContent should not block render.
      await loadContent(mapId);
      if (cancelledRef?.cancelled || timedOut) return;
    } catch (e) {
      console.error('Failed to initialize NodePage:', e);
      if (!cancelledRef?.cancelled && !timedOut) {
        setLoadError('Could not load this node. Check your connection.');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (!cancelledRef?.cancelled) {
        setIsLoaded(true);
      }
    }
  }, [mapId, maps.length, fetchMaps, loadMap, loadContent]);

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    void loadNodeData(cancelledRef);
    return () => {
      cancelledRef.cancelled = true;
    };
  }, [mapId, nodeId, loadNodeData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingElementFocused()) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const isCompleted = content[nodeId || '']?.isCompleted || false;
        if (isCompleted) {
          markIncomplete(nodeId || '');
        } else {
          markComplete(nodeId || '');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodeId, content, markComplete, markIncomplete]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditingElementFocused()) return;
      if (e.key === 'Escape') setPanelOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!isLoaded || !mapId || !nodeId) return (
    <div className="min-h-screen bg-[#0f1117] flex justify-center items-center">
       <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />
    </div>
  );

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#1e2433] border border-[#2d3748] rounded-2xl shadow-xl p-6 text-center">
          <p className="text-slate-200 font-semibold mb-4">Could not load this node. Check your connection.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { void loadNodeData(); }}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition"
            >
              Retry
            </button>
            <button
              onClick={() => navigate(mapId ? `/map/${mapId}` : '/')}
              className="px-4 py-2 rounded-lg border border-[#2d3748] bg-[#0f1117] hover:bg-[#1a2030] text-slate-300 font-semibold transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return <div className="p-12 text-center text-slate-400 font-semibold text-lg">Node missing or deleted.</div>;

  const parentNode = nodes.find(n => n.id === node.parentId);
  const mapMeta = getMapById(mapId);
  const nodeContent = content[nodeId];

  // Sibling navigation
  const siblings = nodes.filter(n => n.parentId === (node.parentId || null)).sort((a,b) => a.order - b.order);
  const currentIndex = siblings.findIndex(n => n.id === nodeId);
  const prevSibling = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextSibling = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  const isCompleted = nodeContent?.isCompleted || false;

  const handleStudyToggle = () => {
    if (isCompleted) {
      markIncomplete(nodeId);
    } else {
      markComplete(nodeId);
    }
  };

  const LeftContent = (
    <button 
      onClick={() => navigate(`/map/${mapId}`, { state: { focusRoot: true } })}
      className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition text-sm font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#2d3748] active:scale-95 border border-transparent"
    >
      <ChevronLeft className="h-4 w-4" />
      Back to Map
    </button>
  );

  return (
    <div
      className="nodrag nowheel nopan flex flex-col min-h-screen bg-[#0f1117] font-sans"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AppHeader searchQuery="" setSearchQuery={() => {}} leftContent={LeftContent} />

      <div className="node-page-fullwidth pt-14 min-h-screen relative">
        <button
          onClick={() => setPanelOpen((p) => !p)}
          className="panel-toggle-tab"
          title="Node Info"
          aria-label="Toggle node info panel"
        >
          <ChevronRight
            size={16}
            className={`panel-chevron ${panelOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div
          className={`panel-overlay ${panelOpen ? 'panel-overlay-open' : ''}`}
          onClick={() => setPanelOpen(false)}
        />

        <aside className={`node-side-panel ${panelOpen ? 'node-side-panel-open' : ''}`}>
          <button
            onClick={() => setPanelOpen(false)}
            className="panel-close-btn"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>

          <nav className="panel-breadcrumb text-[11px] text-slate-500 font-bold tracking-widest uppercase flex flex-wrap items-center gap-1 pt-6">
            <Link to="/" className="hover:text-teal-400 transition truncate max-w-[80px]">Dashboard</Link>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            <Link to={`/map/${mapId}`} state={{ focusRoot: true }} className="hover:text-teal-400 transition truncate max-w-[120px]">{mapMeta?.title || 'Map'}</Link>
            {parentNode && (
              <>
                <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                <Link to={`/map/${mapId}/node/${parentNode.id}`} className="hover:text-teal-400 transition truncate max-w-[80px]">{parentNode.label}</Link>
              </>
            )}
          </nav>

          <span className="node-type-badge inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-[#2d3748] text-slate-400 border border-[#3d4a60] w-fit">
            {node.type} Node
          </span>

          <h2 className="panel-node-title text-3xl font-bold text-slate-100 leading-tight tracking-tight transition-colors border-b-4 border-transparent w-max" style={{ borderBottomColor: node.type !== 'root' ? (node.color || DEFAULT_BRANCH_COLORS[0]) : 'transparent', paddingBottom: 4 }}>
            {node.emoji && <span className="mr-2">{node.emoji}</span>}
            {node.label}
          </h2>

          <p className="panel-parent text-sm text-slate-400 font-semibold mt-1">
            Child of: <span className="text-slate-200">{parentNode?.label || 'None'}</span>
          </p>

          <hr className="border-[#2d3748]" />

          <button
            onClick={() => setIsTestMode(!isTestMode)}
            className={`btn-test-yourself w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm active:scale-95 border ${isTestMode ? 'bg-orange-600 text-white border-transparent hover:bg-orange-700' : 'bg-[#2d3748] text-orange-400 border-[#3d4a60] hover:bg-[#364155]'}`}
          >
            <Brain className="h-5 w-5" />
            {isTestMode ? 'Exit Test Mode' : '🧠 Test Yourself'}
          </button>

          <button
            onClick={handleStudyToggle}
            className={`btn-mark-studied w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm active:scale-95 border ${isCompleted ? 'bg-[#2d3748] text-green-400 border-[#3d4a60] hover:bg-[#364155]' : 'bg-green-600 text-white border-transparent hover:bg-green-700 hover:shadow'}`}
          >
            <Check className="h-5 w-5" />
            {isCompleted ? '✓ Studied' : 'Mark as Studied'}
          </button>

          <div className="panel-sibling-nav mt-auto pt-6 border-t border-[#2d3748] flex items-center justify-between gap-3">
            <button
              disabled={!prevSibling}
              onClick={() => {
                if (prevSibling) {
                  navigate(`/map/${mapId}/node/${prevSibling.id}`);
                  setPanelOpen(false);
                }
              }}
              className="flex-1 flex flex-col items-start px-3 py-2 rounded-xl bg-[#0f1117] hover:bg-[#1a2030] disabled:opacity-30 disabled:hover:bg-[#0f1117] transition border border-[#2d3748] text-left active:scale-95 disabled:active:scale-100"
            >
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-0.5">← Previous</span>
              <span className="text-sm font-bold text-slate-200 truncate w-full">{prevSibling ? prevSibling.label : '-'}</span>
            </button>
            <button
              disabled={!nextSibling}
              onClick={() => {
                if (nextSibling) {
                  navigate(`/map/${mapId}/node/${nextSibling.id}`);
                  setPanelOpen(false);
                }
              }}
              className="flex-1 flex flex-col items-end px-3 py-2 rounded-xl bg-[#0f1117] hover:bg-[#1a2030] disabled:opacity-30 disabled:hover:bg-[#0f1117] transition border border-[#2d3748] text-right active:scale-95 disabled:active:scale-100"
            >
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-0.5">Next →</span>
              <span className="text-sm font-bold text-slate-200 truncate w-full">{nextSibling ? nextSibling.label : '-'}</span>
            </button>
          </div>
        </aside>

        <main className="node-editor-full">
          <NodeEditor
            nodeId={nodeId}
            mapId={mapId}
            mapTitle={mapMeta?.title ?? 'Mind Map'}
            parentLabel={parentNode?.label}
            isTestMode={isTestMode}
            onToggleTestMode={setIsTestMode}
          />
        </main>
      </div>
    </div>
  );
}
