import { FileText } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { useContentStore } from '../../store/contentStore';

export function NotesSection({ nodeId }: { nodeId: string }) {
  const { content, updateContent } = useContentStore();
  const notes = content[nodeId]?.notes || '';

  return (
    <SectionShell title="Notes" icon={FileText} defaultOpen={false}>
      <textarea
        value={notes}
        onChange={e => updateContent(nodeId, { notes: e.target.value })}
        placeholder="Any additional notes, page references, or reminders..."
        className="w-full resize-none outline-none text-gray-800 placeholder:text-gray-400 min-h-[120px] text-base leading-relaxed bg-transparent"
      />
    </SectionShell>
  );
}
