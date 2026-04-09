import { useState } from 'react';
import { Copy, Globe, Link2Off } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateShareLink, revokeShareLink } from '../../utils/sharing';
import { useMapsStore } from '../../store/mapsStore';
import type { MindmapMeta } from '../../types';

export function PublicLinkToggle({ map }: { map: MindmapMeta }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      if (checked) {
        await generateShareLink(map.id);
        toast.success('Public sharing enabled');
      } else {
        await revokeShareLink(map.id);
        toast.success('Public link revoked');
      }
      // Refresh the maps store to update local state (isPublic, shareToken)
      await useMapsStore.getState().fetchMaps();
    } catch (error) {
      console.error('Sharing toggle failed', error);
      toast.error('Failed to update sharing settings');
    } finally {
      setIsLoading(false);
    }
  };

  const currentLink = map.shareToken ? `${window.location.origin}/share/${map.shareToken}` : '';

  const copyToClipboard = () => {
    if (!currentLink) return;
    navigator.clipboard.writeText(currentLink);
    toast.success('Link copied! 🔗');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-200 shadow-sm">
        <label className="flex items-center gap-3 cursor-pointer">
          <Globe className={`w-5 h-5 ${map.isPublic ? 'text-teal-600' : 'text-gray-400'}`} />
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 text-sm">Anyone with the link can view</span>
            <span className="text-xs font-semibold text-gray-500">Shared maps are read-only. Your notes stay private.</span>
          </div>
        </label>
        
        <div className="relative inline-block w-11 h-6 select-none cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={map.isPublic}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={isLoading}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
        </div>
      </div>

      {map.isPublic && (
        <div className="flex flex-col gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <input 
              readOnly
              value={currentLink}
              className="flex-1 bg-gray-50 border border-gray-200 shadow-inner font-medium text-gray-700 text-sm rounded-lg px-3 py-2 outline-none"
            />
            <button 
              onClick={copyToClipboard}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition shadow-sm active:scale-95"
            >
              <Copy className="w-4 h-4" /> Copy link
            </button>
          </div>
          <button 
            onClick={() => handleToggle(false)}
            className="flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-700 self-start mt-1 p-2 hover:bg-red-50 rounded-lg transition"
          >
            <Link2Off className="w-4 h-4" /> Revoke public link
          </button>
        </div>
      )}
      
      {!map.isPublic && (
        <div className="text-center text-sm font-semibold text-gray-400 py-6 border-2 border-dashed border-gray-200 rounded-xl mt-2 flex flex-col items-center gap-2">
           <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
             <Link2Off className="w-5 h-5" />
           </div>
           This mindmap is currently private.
        </div>
      )}
    </div>
  );
}
