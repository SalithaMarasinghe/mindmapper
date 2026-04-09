import { List, X, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { useContentStore } from '../../store/contentStore';

export function KeyPointsSection({ nodeId }: { nodeId: string }) {
  const { content, addKeyPoint, removeKeyPoint, updateKeyPoint, updateContent } = useContentStore();
  const keyPoints = content[nodeId]?.keyPoints || [];

  const handleAdd = () => {
    addKeyPoint(nodeId, '');
  };

  const movePoint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === keyPoints.length - 1) return;

    const newArr = [...keyPoints];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newArr[index], newArr[swapIndex]] = [newArr[swapIndex], newArr[index]];
    
    newArr.forEach((p, i) => p.order = i);
    updateContent(nodeId, { keyPoints: newArr });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, pointId: string, text: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyPoint(nodeId, '', index + 1);
      // We'll need to focus the new one next. 
      // This is tricky without refs or a dedicated focus manager, 
      // but for now creating it is the requirement.
    } else if (e.key === 'Backspace' && text === '') {
      e.preventDefault();
      removeKeyPoint(nodeId, pointId);
    }
  };

  return (
    <SectionShell title="Key Points" icon={List}>
      <div className="flex flex-col gap-3">
        {keyPoints.length === 0 ? (
          <p className="text-gray-400 italic text-sm py-2">No key points added yet.</p>
        ) : (
          keyPoints.map((point, idx) => (
            <div key={point.id} className="flex items-start gap-2 group">
              <div className="flex flex-col items-center justify-center pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
                <button onClick={() => movePoint(idx, 'up')} disabled={idx === 0} className="hover:text-teal-600 disabled:opacity-30 p-0.5"><ArrowUp className="w-3.5 h-3.5"/></button>
                <button onClick={() => movePoint(idx, 'down')} disabled={idx === keyPoints.length - 1} className="hover:text-teal-600 disabled:opacity-30 p-0.5"><ArrowDown className="w-3.5 h-3.5"/></button>
              </div>
              <input
                value={point.text}
                onChange={e => updateKeyPoint(nodeId, point.id, e.target.value)}
                onKeyDown={e => handleKeyDown(e, idx, point.id, point.text)}
                placeholder="Enter a key point..."
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-gray-800"
              />
              <button 
                onClick={() => removeKeyPoint(nodeId, point.id)}
                className="p-2.5 text-gray-300 hover:text-red-500 transition-colors mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}

        <button 
          onClick={handleAdd}
          className="flex items-center gap-2 text-teal-600 font-medium text-sm hover:text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-lg transition-colors self-start mt-2"
        >
          <Plus className="h-4 w-4" /> Add Key Point
        </button>
      </div>
    </SectionShell>
  );
}
