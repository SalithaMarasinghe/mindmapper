import { Handle, Position } from '@xyflow/react';
import type { MindmapNode, NodeDirection } from '../../types';

interface RootNodeProps {
  data: {
    node: MindmapNode;
    totalProgress: string;
    onContextMenu?: (e: React.MouseEvent, node: MindmapNode) => void;
    onAddDirectionalChild?: (node: MindmapNode, direction: NodeDirection) => void;
    readOnly?: boolean;
  };
}

export function RootNode({ data }: RootNodeProps) {
  const { node, totalProgress, onContextMenu, onAddDirectionalChild, readOnly = false } = data;

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
      onContextMenu={handleContextMenu}
      className="group bg-teal-700 text-white px-6 py-4 rounded-xl shadow-lg border border-teal-800 min-w-[200px] text-center relative"
    >
      <div className="font-bold text-lg mb-1">{node.label}</div>
      <div className="text-teal-200 text-xs font-medium">{totalProgress}</div>

      {!readOnly && (
        <>
          <button onClick={(e) => handleAdd(e, 'left')} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
          <button onClick={(e) => handleAdd(e, 'right')} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
          <button onClick={(e) => handleAdd(e, 'top')} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
          <button onClick={(e) => handleAdd(e, 'bottom')} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">+</button>
        </>
      )}

      <Handle id="s-left" type="source" position={Position.Left} className="opacity-0 w-0 h-0" />
      <Handle id="s-right" type="source" position={Position.Right} className="opacity-0 w-0 h-0" />
      <Handle id="s-top" type="source" position={Position.Top} className="opacity-0 w-0 h-0" />
      <Handle id="s-bottom" type="source" position={Position.Bottom} className="opacity-0 w-0 h-0" />

      <Handle id="t-left" type="target" position={Position.Left} className="opacity-0 w-0 h-0" />
      <Handle id="t-right" type="target" position={Position.Right} className="opacity-0 w-0 h-0" />
      <Handle id="t-top" type="target" position={Position.Top} className="opacity-0 w-0 h-0" />
      <Handle id="t-bottom" type="target" position={Position.Bottom} className="opacity-0 w-0 h-0" />
    </div>
  );
}
