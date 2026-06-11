import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize, PlusCircle, Share, Edit2, Check, Link2Off } from 'lucide-react';
import type { MindmapMeta } from '../../types';
import { useMapsStore } from '../../store/mapsStore';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '../../store/settingsStore';
import { supabase } from '../../lib/supabase';
import { nanoid } from 'nanoid';

interface CanvasToolbarProps {
  map: MindmapMeta | undefined;
  onFitView: () => void;
  onAddBranch: () => void;
  onTidyUp: () => void;
}

export function CanvasToolbar({ map, onFitView, onAddBranch, onTidyUp }: CanvasToolbarProps) {
  const navigate = useNavigate();
  const { updateMap } = useMapsStore();
  const { isReadOnly } = useSettingsStore();
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);

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

  return (
    <div className="h-14 bg-[#1e2433] border-b border-[#2d3748] flex items-center justify-between px-2 sm:px-4 gap-2 z-40 relative shadow-lg">
      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition text-sm font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#2d3748] active:scale-95"
        >
          <span>← Dashboard</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 flex justify-center items-center">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 bg-[#0f1117] px-2 py-1 rounded-lg border border-teal-500 ring-4 ring-teal-900/40">
            <input 
              autoFocus
              className="text-sm font-bold text-slate-100 bg-transparent px-1 focus:outline-none min-w-[200px]"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
            />
            <button className="text-teal-400 p-1 hover:bg-teal-900/40 rounded-md transition" onClick={handleTitleSave}>
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div 
            onClick={handleTitleClick}
            className="flex items-center gap-2 text-base font-bold text-slate-100 group cursor-pointer hover:text-teal-400 transition max-w-[34vw] sm:max-w-[45vw]"
          >
            <span className="text-xl leading-none -mt-0.5">{map?.emoji}</span>
            <span className="truncate">{map?.title || 'Loading map...'}</span>
            {!isReadOnly && <Edit2 className="h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition" />}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto max-w-[58vw] sm:max-w-none pr-1">
        <div className="relative shrink-0">
          <button
            className="px-3 py-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition whitespace-nowrap"
            title="Share Map"
            onClick={handleShare}
          >
            <span className="inline-flex items-center gap-1.5">
              <Share className="h-4 w-4" />
              Share 🔗
            </span>
          </button>
          {sharePopoverOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#1e2433] border border-[#2d3748] rounded-xl shadow-xl p-3 z-50">
              <p className="text-xs font-semibold text-slate-400 mb-2">Shareable link</p>
              <input
                readOnly
                value={shareUrl}
                className="w-full text-sm bg-[#0f1117] border border-[#2d3748] rounded-lg px-3 py-2 text-slate-300"
              />
              <div className="mt-3 flex justify-between items-center">
                <button
                  onClick={handleRevoke}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 hover:text-red-300"
                >
                  <Link2Off className="w-4 h-4" />
                  Revoke link
                </button>
                <button
                  onClick={() => setSharePopoverOpen(false)}
                  className="text-sm font-semibold text-slate-400 hover:text-slate-200"
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
            className="flex items-center gap-1.5 text-white bg-teal-600 hover:bg-teal-700 transition text-sm font-semibold px-3.5 py-1.5 rounded-lg border border-teal-700 shadow-sm whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Add Branch</span>
          </button>
        )}
        <div className="w-px h-6 bg-[#2d3748] mx-1.5 shrink-0" />
        <button 
           onClick={onFitView}
          className="px-3 py-1.5 text-sm font-semibold text-slate-400 hover:text-slate-100 hover:bg-[#2d3748] rounded-lg transition whitespace-nowrap"
          title="Fit View"
        >
          <span className="inline-flex items-center gap-1.5">
            <Maximize className="h-4 w-4" />
            Fit View ⊞
          </span>
        </button>
        {!isReadOnly && (
          <button
            onClick={onTidyUp}
            className="px-3 py-1.5 text-sm font-semibold text-slate-400 hover:text-slate-100 hover:bg-[#2d3748] rounded-lg transition whitespace-nowrap"
            title="Tidy Up"
          >
            Tidy Up
          </button>
        )}
      </div>
    </div>
  );
}
