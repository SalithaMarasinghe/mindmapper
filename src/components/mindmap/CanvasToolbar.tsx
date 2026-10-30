import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Maximize, 
  PlusCircle, 
  Share, 
  Edit2, 
  Check, 
  Link2Off,
  Sparkles,
  CircleDot,
  Split,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import type { MindmapMeta, LayoutPattern } from '../../types';
import { useMapsStore } from '../../store/mapsStore';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '../../store/settingsStore';
import { supabase } from '../../lib/supabase';
import { nanoid } from 'nanoid';

interface CanvasToolbarProps {
  map: MindmapMeta | undefined;
  onFitView: () => void;
  onAddBranch: () => void;
  onTidyUp: (pattern?: LayoutPattern) => void;
  layoutPattern: LayoutPattern;
  onLayoutPatternChange: (pattern: LayoutPattern) => void;
}

export function CanvasToolbar({ 
  map, 
  onFitView, 
  onAddBranch, 
  onTidyUp,
  layoutPattern,
  onLayoutPatternChange
}: CanvasToolbarProps) {
  const navigate = useNavigate();
  const { updateMap } = useMapsStore();
  const { isReadOnly } = useSettingsStore();
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [isPatternOpen, setIsPatternOpen] = useState(false);
  const patternMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patternMenuRef.current && !patternMenuRef.current.contains(e.target as Node)) {
        setIsPatternOpen(false);
      }
    };
    if (isPatternOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPatternOpen]);

  const PATTERNS: Array<{
    id: LayoutPattern;
    label: string;
    description: string;
    icon: typeof CircleDot;
  }> = [
    {
      id: 'radial',
      label: 'Radial 360°',
      description: 'Circular fan-out spread around center',
      icon: CircleDot,
    },
    {
      id: 'balanced',
      label: 'Balanced L/R',
      description: 'Evenly balanced two-sided tree',
      icon: Split,
    },
    {
      id: 'right',
      label: 'Flow Right',
      description: 'One-sided hierarchy expanding right',
      icon: ArrowRight,
    },
  ];

  const currentPattern = PATTERNS.find(p => p.id === layoutPattern) || PATTERNS[0];
  const PatternIcon = currentPattern.icon;

  const handleTitleClick = () => {
    if (!map || isReadOnly) return;
    setEditTitle(map.title);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (!map || !editTitle.trim() || editTitle.trim() === map.title) {
      setIsEditingTitle(false);
      return;
    }
    await updateMap(map.id, { title: editTitle.trim() });
    setIsEditingTitle(false);
    toast.success('Title updated');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') setIsEditingTitle(false);
  };

  const handleShare = async () => {
    if (!map) return;
    try {
      let token = map.shareToken;
      if (!token) {
        token = nanoid(21);
        const { error } = await supabase
          .from('mindmaps')
          .update({ share_token: token, is_public: true })
          .eq('id', map.id);
        if (error) throw error;
        await useMapsStore.getState().fetchMaps();
      }

      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard ✓');
      setSharePopoverOpen(true);
    } catch (error) {
      console.error('Failed to create share link:', error);
      toast.error('Failed to create share link');
    }
  };

  const handleRevoke = async () => {
    if (!map) return;
    try {
      const { error } = await supabase
        .from('mindmaps')
        .update({ share_token: null, is_public: false })
        .eq('id', map.id);
      if (error) throw error;
      await useMapsStore.getState().fetchMaps();
      setSharePopoverOpen(false);
      setShareUrl('');
      toast.success('Share link revoked');
    } catch (error) {
      console.error('Failed to revoke share link:', error);
      toast.error('Failed to revoke link');
    }
  };

  const handleSelectPattern = (patternId: LayoutPattern) => {
    setIsPatternOpen(false);
    onLayoutPatternChange(patternId);
    onTidyUp(patternId);
  };

  return (
    <div className="h-14 bg-bg border-b border-border flex items-center justify-between px-2 sm:px-4 gap-2 z-40 relative shadow-lg">
      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text transition text-sm font-semibold px-2.5 py-1.5 rounded-lg hover:bg-bg active:scale-95"
        >
          <span>← Dashboard</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 flex justify-center items-center">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 bg-bg px-2 py-1 rounded-lg border border-border ring-4 ring-border-strong/40">
            <input 
              autoFocus
              className="text-sm font-bold text-text bg-transparent px-1 focus:outline-none min-w-[200px]"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
            />
            <button className="text-accent p-1 hover:bg-surface rounded-md transition" onClick={handleTitleSave}>
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div 
            onClick={handleTitleClick}
            className="flex items-center gap-2 text-base font-bold text-text group cursor-pointer hover:text-accent transition max-w-[34vw] sm:max-w-[45vw]"
          >
            <span className="text-xl leading-none -mt-0.5">{map?.emoji}</span>
            <span className="truncate">{map?.title || 'Loading map...'}</span>
            {!isReadOnly && <Edit2 className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition" />}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto max-w-[58vw] sm:max-w-none pr-1">
        <div className="relative shrink-0">
          <button
            className="px-3 py-1.5 text-sm font-semibold text-text bg-accent hover:bg-surface-2 rounded-lg transition whitespace-nowrap"
            title="Share Map"
            onClick={handleShare}
          >
            <span className="inline-flex items-center gap-1.5">
              <Share className="h-4 w-4" />
              Share 🔗
            </span>
          </button>
          {sharePopoverOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-bg border border-border rounded-xl shadow-xl p-3 z-50">
              <p className="text-xs font-semibold text-text-secondary mb-2">Shareable link</p>
              <input
                readOnly
                value={shareUrl}
                className="w-full text-sm bg-bg border border-border rounded-lg px-3 py-2 text-text"
              />
              <div className="mt-3 flex justify-between items-center">
                <button
                  onClick={handleRevoke}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-secondary"
                >
                  <Link2Off className="w-4 h-4" />
                  Revoke link
                </button>
                <button
                  onClick={() => setSharePopoverOpen(false)}
                  className="text-sm font-semibold text-text-secondary hover:text-text"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {!isReadOnly && (
          <button 
            onClick={onAddBranch}
            className="flex items-center gap-1.5 text-text bg-accent hover:bg-surface-2 transition text-sm font-semibold px-3.5 py-1.5 rounded-lg border border-border shadow-sm whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Add Branch</span>
          </button>
        )}

        <div className="w-px h-6 bg-border mx-1 shrink-0" />

        <button 
          onClick={onFitView}
          className="px-2.5 py-1.5 text-sm font-semibold text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition whitespace-nowrap"
          title="Fit View"
        >
          <span className="inline-flex items-center gap-1.5">
            <Maximize className="h-4 w-4" />
            Fit View ⊞
          </span>
        </button>

        {!isReadOnly && (
          <>
            {/* Layout Pattern Selector Dropdown */}
            <div className="relative shrink-0" ref={patternMenuRef}>
              <button
                onClick={() => setIsPatternOpen(!isPatternOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition border border-border/60 shadow-sm whitespace-nowrap"
                title="Select Layout Pattern"
              >
                <PatternIcon className="h-4 w-4 text-accent" />
                <span className="hidden md:inline">{currentPattern.label}</span>
                <ChevronDown className="h-3 w-3 text-text-muted" />
              </button>

              {isPatternOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-bg border border-border rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Layout Pattern
                  </div>
                  {PATTERNS.map((p) => {
                    const Icon = p.icon;
                    const isActive = p.id === layoutPattern;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPattern(p.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition text-sm ${
                          isActive 
                            ? 'bg-accent/15 text-accent font-semibold' 
                            : 'text-text hover:bg-surface-2'
                        }`}
                      >
                        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span>{p.label}</span>
                            {isActive && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <p className="text-xs text-text-secondary font-normal mt-0.5 leading-snug">
                            {p.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tidy Up / Auto Layout Button */}
            <button
              onClick={() => onTidyUp()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-text bg-accent/20 hover:bg-accent/35 border border-accent/40 rounded-lg transition shadow-sm whitespace-nowrap"
              title={`Tidy up nodes in ${currentPattern.label} layout`}
            >
              <Sparkles className="h-4 w-4 text-accent" />
              <span>Tidy Up</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
