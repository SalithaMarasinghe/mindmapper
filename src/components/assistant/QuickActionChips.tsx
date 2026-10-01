import { Sparkles, Coffee, Calendar, Play, ListCheck, CheckCircle2 } from 'lucide-react';

interface QuickActionChipsProps {
  onSelect?: (prompt: string) => void;
  onSelectPrompt?: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickActionChips({ onSelect, onSelectPrompt, disabled }: QuickActionChipsProps) {
  const chips = [
    {
      label: 'What did I do today?',
      prompt: 'What tasks and events did I complete today, and how much time have I tracked?',
      icon: <Calendar className="w-3.5 h-3.5 text-teal-400" />,
    },
    {
      label: 'What tasks are open?',
      prompt: 'What tasks are currently open or unfinished?',
      icon: <ListCheck className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      label: 'Plan my day',
      prompt: 'Plan my day: ',
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      label: 'Take a break',
      prompt: "I'm taking a break now",
      icon: <Coffee className="w-3.5 h-3.5 text-amber-300" />,
    },
    {
      label: "I'm back",
      prompt: "I'm back from break, resume my work",
      icon: <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />,
    },
    {
      label: 'Wrap up day',
      prompt: 'Wrap up my day: summarize what was accomplished, prepare journal blocks, and carry over unfinished tasks.',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />,
    },
  ];

  const handleSelect = (prompt: string) => {
    if (typeof onSelect === 'function') {
      onSelect(prompt);
    } else if (typeof onSelectPrompt === 'function') {
      onSelectPrompt(prompt);
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 text-xs no-scrollbar select-none">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          disabled={disabled}
          onClick={() => handleSelect(chip.prompt)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0a0a0a] hover:bg-[#141414] border border-[#1a1a1a] text-slate-300 hover:text-white transition whitespace-nowrap active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm cursor-pointer"
        >
          {chip.icon}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
