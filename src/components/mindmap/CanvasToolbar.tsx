import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize, PlusCircle, Share, Edit2, Check, Link2Off } from 'lucide-react';
import type { MindmapMeta } from '../../types';
import { useMapsStore } from '../../store/mapsStore';
import { toast } from 'react-hot-toast';
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
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);

  const handleTitleClick = () => {
    if (!map) return;
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
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-2 sm:px-4 gap-2 z-40 relative shadow-sm">
      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition text-sm font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 active:scale-95"
        >
          <span>← Dashboard</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 flex justify-center items-center">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-teal-500 ring-4 ring-teal-50">
            <input 
              autoFocus
              className="text-sm font-bold text-gray-900 bg-transparent px-1 focus:outline-none min-w-[200px]"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
            />
            <button className="text-teal-600 p-1 hover:bg-teal-100 rounded-md transition" onClick={handleTitleSave}>
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div 
            onClick={handleTitleClick}
            className="flex items-center gap-2 text-base font-bold text-gray-900 group cursor-pointer hover:text-teal-700 transition max-w-[34vw] sm:max-w-[45vw]"
          >
            <span className="text-xl leading-none -mt-0.5">{map?.emoji}</span>
            <span className="truncate">{map?.title || 'Loading map...'}</span>
            <Edit2 className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
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
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50">
              <p className="text-xs font-semibold text-gray-500 mb-2">Shareable link</p>
              <input
                readOnly
                value={shareUrl}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
              />
              <div className="mt-3 flex justify-between items-center">
                <button
                  onClick={handleRevoke}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  <Link2Off className="w-4 h-4" />
                  Revoke link
                </button>
                <button
                  onClick={() => setSharePopoverOpen(false)}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={onAddBranch}
          className="flex items-center gap-1.5 text-white bg-teal-600 hover:bg-teal-700 transition text-sm font-semibold px-3.5 py-1.5 rounded-lg border border-teal-700 shadow-sm whitespace-nowrap"
        >
          <PlusCircle className="h-4 w-4" />
          <span>+ Add Branch</span>
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1.5 shrink-0" />
        <button 
           onClick={onFitView}
          className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
          title="Fit View"
        >
          <span className="inline-flex items-center gap-1.5">
            <Maximize className="h-4 w-4" />
            Fit View ⊞
          </span>
        </button>
        <button
          onClick={onTidyUp}
          className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
          title="Tidy Up"
        >
          Tidy Up
        </button>
      </div>
    </div>
  );
}
