import { Lightbulb } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { useContentStore } from '../../store/contentStore';

export function MentalModelSection({ nodeId }: { nodeId: string }) {
  const { content, updateContent } = useContentStore();
  const mentalModel = content[nodeId]?.mentalModel || '';

  return (
    <SectionShell title="Mental Model" icon={Lightbulb}>
      <textarea
        value={mentalModel}
        onChange={e => updateContent(nodeId, { mentalModel: e.target.value })}
        placeholder="How do you think about this? What analogy helps?"
        className="w-full resize-none outline-none text-gray-800 placeholder:text-gray-400 min-h-[100px] text-base leading-relaxed bg-transparent font-medium"
      />
    </SectionShell>
  );
}
