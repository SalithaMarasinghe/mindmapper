import { Sparkles, Brain, ClipboardList } from 'lucide-react';

interface EmptySuggestionsProps {
  onSuggestionClick: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: <Sparkles className="w-5 h-5 text-accent" />,
    title: 'Real-time mindmap prompt',
    description: 'Generate a context-engineered prompt',
    prompt: 'Context engineer a prompt to build a real-time collaborative mindmap in React 19 and Tailwind',
  },
  {
    icon: <Brain className="w-5 h-5 text-accent" />,
    title: 'Explain RAG architecture',
    description: 'Deep dive into vector search',
    prompt: 'Explain what RAG is, how vector search works with pgvector, and best practices',
  },
  {
    icon: <ClipboardList className="w-5 h-5 text-accent" />,
    title: 'Plan my day',
    description: 'Organize tasks and schedule',
    prompt: 'Help me plan my day based on my current tasks and upcoming meetings',
  },
];

export function EmptySuggestions({ onSuggestionClick }: EmptySuggestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <h2 className="text-base font-medium text-text mb-1">What can I help with?</h2>
      <p className="text-xs text-text-muted mb-8 max-w-md">
        Speak into the mic or type below. Ask to engineer a prompt, explain complex architectures, or manage your tasks.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onSuggestionClick(s.prompt)}
            className="bg-surface rounded-[12px] border border-border hover:border-border-strong p-4 cursor-pointer transition-all duration-200 text-left flex flex-col"
          >
            <div className="mb-2 bg-surface-2 p-2 rounded-full self-start">
              {s.icon}
            </div>
            <h3 className="text-sm font-medium text-text mt-2">{s.title}</h3>
            <p className="text-xs text-text-muted mt-1">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
