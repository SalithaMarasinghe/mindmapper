import { useState, useEffect } from 'react';
import { X, Users, Globe } from 'lucide-react';
import { PublicLinkToggle } from './PublicLinkToggle';
import { InviteByEmail } from './InviteByEmail';
import { SharesList } from './SharesList';
import { useMapsStore } from '../../store/mapsStore';

interface ShareModalProps {
  mapId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ mapId, isOpen, onClose }: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'invite'>('link');
  const [refreshKey, setRefreshKey] = useState(0);
  const { maps } = useMapsStore();
  const map = maps.find(m => m.id === mapId);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen || !mapId || !map) return null;

  return (
    <>
      <div className="fixed inset-0 bg-[#000000]/40 backdrop-blur-sm z-[100] animate-in fade-in duration-200" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:max-w-[500px] bg-[#0a0a0a] rounded-2xl shadow-xl z-[110] overflow-hidden animate-in zoom-in-95 duration-200 border border-[#1a1a1a] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0a0a0a] shrink-0">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Share mindmap</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-gray-900 hover:bg-[#0a0a0a] rounded-full transition active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a] px-6 pt-2 bg-[#080808]/50 shrink-0">
           <button 
             onClick={() => setActiveTab('link')}
             className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'link' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
           >
             <Globe className="w-4 h-4" /> Public Link
           </button>
           <button 
             onClick={() => setActiveTab('invite')}
             className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'invite' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
           >
             <Users className="w-4 h-4" /> Invite Friends
           </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-[#0a0a0a] overflow-y-auto max-h-[70vh]">
          {activeTab === 'link' && <PublicLinkToggle map={map} />}
          
          {activeTab === 'invite' && (
            <div className="flex flex-col gap-2">
              <InviteByEmail mapId={map.id} onInviteSent={() => setRefreshKey(k=>k+1)} />
              <SharesList mapId={map.id} key={refreshKey} />
            </div>
          )}
        </div>

      </div>
    </>
  );
}
