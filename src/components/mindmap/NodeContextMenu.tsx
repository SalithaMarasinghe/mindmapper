import { useEffect, useRef } from 'react';
import { Plus, GitMerge, Edit2, Palette, Trash2 } from 'lucide-react';
import type { MindmapNode } from '../../types';
import { DEFAULT_BRANCH_COLORS } from '../../types';

interface ContextMenuProps {
  x: number;
  y: number;
  node: MindmapNode;
  onClose: () => void;
  onAddChild: (n: MindmapNode) => void;
  onAddSibling: (n: MindmapNode) => void;
  onRename: (n: MindmapNode) => void;
  onChangeColor: (n: MindmapNode, color: string) => void;
  onDelete: (n: MindmapNode) => void;
}

export function NodeContextMenu({ x, y, node, onClose, onAddChild, onAddSibling, onRename, onChangeColor, onDelete }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const isRoot = node.type === 'root';

  return (
    <div 
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-[100] w-56 bg-[#1e2433] rounded-xl shadow-xl shadow-black/50 border border-[#2d3748] py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-2 border-b border-[#2d3748] mb-1">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{node.type} Node Settings</span>
      </div>

      <button onClick={() => { onAddChild(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-teal-900/40 hover:text-teal-300 transition">
        <Plus className="h-4 w-4" /> Add branch
      </button>
      
      {!isRoot && (
        <button onClick={() => { onAddSibling(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-teal-900/40 hover:text-teal-300 transition">
          <GitMerge className="h-4 w-4" /> Add sibling node
        </button>
      )}
      
      <button onClick={() => { onRename(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-teal-900/40 hover:text-teal-300 transition">
        <Edit2 className="h-4 w-4" /> Rename
      </button>

      {!isRoot && (
        <div className="px-3 py-2.5 my-1 bg-[#0f1117]/60 border-y border-[#2d3748]">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="h-4 w-4 text-slate-500" />
            <span className="text-xs text-slate-500 font-semibold">Change color</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-6">
            {DEFAULT_BRANCH_COLORS.map(c => (
              <button 
                key={c}
                onClick={() => { onChangeColor(node, c); onClose(); }}
                className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${node.color === c ? 'ring-2 ring-offset-2 ring-offset-[#1e2433] ring-slate-300 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {!isRoot && (
        <button onClick={() => { onDelete(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-red-400 hover:bg-red-900/30 transition mt-1">
          <Trash2 className="h-4 w-4" /> Delete node
        </button>
      )}
    </div>
  );
}
