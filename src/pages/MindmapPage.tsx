import { ReactFlowProvider } from '@xyflow/react';
import { MindmapCanvas } from '../components/mindmap/MindmapCanvas';

export function MindmapPage() {
  return (
    <ReactFlowProvider>
      <MindmapCanvas />
    </ReactFlowProvider>
  );
}
