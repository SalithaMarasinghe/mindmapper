import { Handle, Position } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import type { MindmapNode } from '../../types';

interface LeafNodeProps {
  data: {
    node: MindmapNode;
    isCompleted?: boolean;
    onContextMenu?: (e: React.MouseEvent, node: MindmapNode) => void;
    onPreview?: (node: MindmapNode) => void;
    readOnly?: boolean;
  };
}

export function LeafNode({ data }: LeafNodeProps) {
  const navigate = useNavigate();
  const { node, isCompleted, onContextMenu, onPreview, readOnly = false } = data;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, node);
    }
  };

  return (
    <div 
      onClick={() => {
        if (!readOnly) navigate(`/map/${node.mapId}/node/${node.id}`);
      }}
      onContextMenu={handleContextMenu}
      className="group relative bg-gray-50 border border-gray-200 px-3 py-2 rounded-full shadow-sm text-sm cursor-pointer hover:bg-white hover:border-teal-300 hover:shadow hover:-translate-x-0.5 transition-all min-w-[140px] flex justify-between items-center"
    >
      <Handle id="t-left" type="target" position={Position.Left} className="opacity-0" />
      <Handle id="t-right" type="target" position={Position.Right} className="opacity-0 w-0 h-0" />
      <Handle id="t-top" type="target" position={Position.Top} className="opacity-0 w-0 h-0" />
      <Handle id="t-bottom" type="target" position={Position.Bottom} className="opacity-0 w-0 h-0" />
      <Handle id="s-left" type="source" position={Position.Left} className="opacity-0 w-0 h-0" />
      <Handle id="s-right" type="source" position={Position.Right} className="opacity-0 w-0 h-0" />
      <Handle id="s-top" type="source" position={Position.Top} className="opacity-0 w-0 h-0" />
      <Handle id="s-bottom" type="source" position={Position.Bottom} className="opacity-0 w-0 h-0" />
      
      <span className="text-gray-700 font-medium truncate pr-3">{node.label}</span>
      
      <div className="flex items-center">
        {isCompleted && (
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2 shadow-sm" />
        )}
        <span className="text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold whitespace-nowrap">
          → Study
        </span>
      </div>

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
    </div>
  );
}
