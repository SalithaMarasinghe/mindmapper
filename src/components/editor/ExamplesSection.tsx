import { Sparkles } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { useContentStore } from '../../store/contentStore';

export function ExamplesSection({ nodeId }: { nodeId: string }) {
  const { content, updateContent } = useContentStore();
  const goodExample = content[nodeId]?.goodExample || '';
  const badExample = content[nodeId]?.badExample || '';

  return (
    <SectionShell title="Examples" icon={Sparkles}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-1">
        
        {/* Good Example */}
        <div className="flex flex-col gap-2 relative">
          <div className="text-sm font-bold text-green-700 flex items-center gap-1.5 ml-1">
            <span className="text-lg leading-none">✅</span> Good Example
          </div>
          <div className="relative group">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-400 rounded-l-md opacity-70" />
            <textarea
              value={goodExample}
              onChange={e => updateContent(nodeId, { goodExample: e.target.value })}
              placeholder="e.g. Using Zustand for simple global app state without boilerplate..."
              className="w-full min-h-[140px] bg-green-50/40 border border-green-100 rounded-md py-3 pr-3 pl-5 outline-none focus:ring-2 focus:ring-green-500/20 text-gray-800 placeholder:text-gray-400 resize-none transition-all font-medium"
            />
          </div>
        </div>

        {/* Bad Example */}
        <div className="flex flex-col gap-2 relative">
          <div className="text-sm font-bold text-red-700 flex items-center gap-1.5 ml-1">
            <span className="text-lg leading-none">❌</span> Misconception
          </div>
          <div className="relative group">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-l-md opacity-70" />
            <textarea
              value={badExample}
              onChange={e => updateContent(nodeId, { badExample: e.target.value })}
              placeholder="e.g. Using Redux for a 2-page simple app because it's 'industry standard'..."
              className="w-full min-h-[140px] bg-red-50/40 border border-red-100 rounded-md py-3 pr-3 pl-5 outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 placeholder:text-gray-400 resize-none transition-all font-medium"
            />
          </div>
        </div>

      </div>
    </SectionShell>
  );
}
