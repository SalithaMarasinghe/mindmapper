import { useState } from 'react';
import { MoreVertical, Copy, Trash2, Edit2, CheckCircle2, CloudDownload, CloudOff } from 'lucide-react';
import type { MindmapMeta } from '../../types';
import { useOfflineStore } from '../../store/offlineStore';
import { useSettingsStore } from '../../store/settingsStore';

interface MapCardProps {
  map: MindmapMeta;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export function MapCard({ map, onClick, onDuplicate, onDelete, onRename }: MapCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { offlineMapIds } = useOfflineStore();
  const { isReadOnly } = useSettingsStore();
  const isOffline = offlineMapIds.includes(map.id);

  const percent = map.nodeCount === 0 ? 0 : Math.round((map.completedCount / map.nodeCount) * 100);
  const isCompleted = percent === 100 && map.nodeCount > 0;

  // Simple relative time format
  const getRelativeTime = (dateStr: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
    const daysDifference = Math.round((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference === 0) return 'Today';
    if (daysDifference === -1) return 'Yesterday';
    if (daysDifference < -30) return new Date(dateStr).toLocaleDateString();
    return rtf.format(daysDifference, 'day');
  };

  return (
    <div 
      className="group relative flex flex-col justify-between bg-[#1e2433] rounded-xl border border-[#2d3748] p-5 shadow-sm hover:shadow-md hover:border-slate-600 transition-all cursor-pointer h-48"
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="text-4xl mb-3 leading-none">{map.emoji || '🧠'}</div>
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-semibold text-slate-100 text-lg truncate tracking-tight" title={map.title}>
              {map.title}
            </h3>
            {isOffline && <span title="Available offline" className="flex items-center"><CloudDownload className="h-4 w-4 text-teal-600 flex-shrink-0" /></span>}
          </div>
          <div className="flex gap-1.5 mt-1 overflow-hidden">
            {map.tags?.slice(0, 3).map(tag => (
              <span key={tag} className="inline-block bg-[#2d3748] text-slate-400 text-xs px-2 py-0.5 rounded flex-shrink-0 max-w-[80px] truncate">
                {tag}
              </span>
            ))}
            {map.tags?.length > 3 && (
              <span className="inline-block bg-[#2d3748] text-slate-400 text-xs px-2 py-0.5 rounded flex-shrink-0">
                +{map.tags.length - 3}
              </span>
            )}
          </div>
        </div>
        
        {isCompleted && (
          <CheckCircle2 className="absolute top-5 right-5 h-5 w-5 text-green-500 bg-[#1e2433] rounded-full flex-shrink-0" />
        )}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
          <span>{map.completedCount} / {map.nodeCount} node{map.nodeCount !== 1 && 's'}</span>
          <span className={percent === 100 ? "text-green-600" : ""}>{percent}%</span>
        </div>
        <div className="w-full bg-[#2d3748] rounded-full h-1.5 mb-4 overflow-hidden">
          <div 
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${percent}%`, backgroundColor: percent === 100 ? '#22c55e' : map.color || '#0d9488' }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Edited {getRelativeTime(map.updatedAt)}</span>
          
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 hover:bg-[#2d3748] rounded-md text-slate-500 hover:text-slate-200 transition opacity-0 group-hover:opacity-100 focus:opacity-100 ui-open:opacity-100 -mr-1"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 bottom-8 w-48 bg-[#1e2433] rounded-lg shadow-xl shadow-black/40 border border-[#2d3748] py-1.5 z-40">
                  {!isReadOnly && (
                    <>
                      <button 
                        onClick={() => { setMenuOpen(false); onRename(); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-[#2d3748] transition"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-gray-400" /> Rename
                      </button>
                      <button 
                        onClick={() => { setMenuOpen(false); onDuplicate(); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-[#2d3748] transition"
                      >
                        <Copy className="h-3.5 w-3.5 text-gray-400" /> Duplicate
                      </button>
                    </>
                  )}
                  <button 
                    onClick={async () => { 
                      setMenuOpen(false); 
                      await useOfflineStore.getState().toggleOffline(map.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-[#2d3748] transition"
                  >
                    {isOffline ? <CloudOff className="h-3.5 w-3.5 text-gray-400" /> : <CloudDownload className="h-3.5 w-3.5 text-gray-400" />}
                    {isOffline ? 'Remove offline access' : 'Make available offline'}
                  </button>
                  {!isReadOnly && (
                    <>
                      <div className="h-px bg-[#2d3748] my-1 font-medium" />
                      <button 
                        onClick={() => { 
                          setMenuOpen(false); 
                          if (window.confirm("Delete this mindmap? This cannot be undone.")) {
                            onDelete();
                          }
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/30 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
