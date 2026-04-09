import { useRef, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { useContentStore } from '../../store/contentStore';

export function DefinitionSection({ nodeId }: { nodeId: string }) {
  const { content, updateContent } = useContentStore();
  const definition = content[nodeId]?.definition || '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [definition]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent(nodeId, { definition: e.target.value });
    adjustHeight();
  };

  return (
    <SectionShell title="Definition" icon={BookOpen}>
      <textarea
        ref={textareaRef}
        value={definition}
        onChange={handleChange}
        placeholder="What is this concept in your own words?"
        className="w-full resize-none outline-none text-gray-800 placeholder:text-gray-400 min-h-[80px] text-base leading-relaxed bg-transparent font-medium"
      />
    </SectionShell>
  );
}
