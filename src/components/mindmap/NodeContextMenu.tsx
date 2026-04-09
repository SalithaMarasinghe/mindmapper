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
      className="fixed z-[100] w-56 bg-white rounded-xl shadow-xl shadow-gray-200/50 border border-gray-200 py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-2 border-b border-gray-100 mb-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{node.type} Node Settings</span>
      </div>

      <button onClick={() => { onAddChild(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition">
        <Plus className="h-4 w-4" /> Add branch
      </button>
      
      {!isRoot && (
        <button onClick={() => { onAddSibling(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition">
          <GitMerge className="h-4 w-4" /> Add sibling node
        </button>
      )}
      
      <button onClick={() => { onRename(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition">
        <Edit2 className="h-4 w-4" /> Rename
      </button>

      {!isRoot && (
        <div className="px-3 py-2.5 my-1 bg-gray-50/50 border-y border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="h-4 w-4 text-gray-500" />
            <span className="text-xs text-gray-500 font-semibold">Change color</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-6">
            {DEFAULT_BRANCH_COLORS.map(c => (
              <button 
                key={c}
                onClick={() => { onChangeColor(node, c); onClose(); }}
                className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${node.color === c ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {!isRoot && (
        <button onClick={() => { onDelete(node); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition mt-1">
          <Trash2 className="h-4 w-4" /> Delete node
        </button>
      )}
    </div>
  );
}
