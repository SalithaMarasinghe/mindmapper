import { Handle, Position } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import type { MindmapNode, NodeDirection } from '../../types';

interface BranchNodeProps {
  data: {
    node: MindmapNode;
    completedCount: number;
    totalCount: number;
    onContextMenu?: (e: React.MouseEvent, node: MindmapNode) => void;
    onAddDirectionalChild?: (node: MindmapNode, direction: NodeDirection) => void;
    onPreview?: (node: MindmapNode) => void;
    readOnly?: boolean;
  };
}

export function BranchNode({ data }: BranchNodeProps) {
  const navigate = useNavigate();
  const { node, completedCount, totalCount, onContextMenu, onAddDirectionalChild, onPreview, readOnly = false } = data;
  const isCompleted = totalCount > 0 && completedCount === totalCount;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, node);
    }
  };

  const handleAdd = (e: React.MouseEvent, direction: NodeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    onAddDirectionalChild?.(node, direction);
  };

  return (
    <div 
      onClick={() => {
        if (!readOnly) navigate(`/map/${node.mapId}/node/${node.id}`);
      }}
      onContextMenu={handleContextMenu}
      className="group bg-white px-4 py-3 rounded-lg shadow-sm border-l-4 border-y border-r border-gray-200 min-w-[160px] cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all relative"
      style={{ borderLeftColor: node.color || '#0d9488' }}
    >
      <Handle id="t-left" type="target" position={Position.Left} className="opacity-0" />
      <Handle id="t-right" type="target" position={Position.Right} className="opacity-0 w-0 h-0" />
      <Handle id="t-top" type="target" position={Position.Top} className="opacity-0 w-0 h-0" />
      <Handle id="t-bottom" type="target" position={Position.Bottom} className="opacity-0 w-0 h-0" />
      
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-gray-800 text-sm pr-4">{node.label}</span>
        {isCompleted && (
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm flex-shrink-0" />
        )}
      </div>

      {!readOnly && (
        <>
          <button onClick={(e) => handleAdd(e, 'left')} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
          <button onClick={(e) => handleAdd(e, 'right')} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
          <button onClick={(e) => handleAdd(e, 'top')} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
          <button onClick={(e) => handleAdd(e, 'bottom')} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
        </>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPreview?.(node);
        }}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-teal-600/90 text-white flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
        aria-label="Quick preview"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>

      <Handle id="s-left" type="source" position={Position.Left} className="opacity-0 w-0 h-0" />
      <Handle id="s-right" type="source" position={Position.Right} className="opacity-0" />
      <Handle id="s-top" type="source" position={Position.Top} className="opacity-0 w-0 h-0" />
      <Handle id="s-bottom" type="source" position={Position.Bottom} className="opacity-0 w-0 h-0" />
    </div>
  );
}
