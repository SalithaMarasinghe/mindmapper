import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';

interface SectionShellProps {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionShell({ title, icon: Icon, defaultOpen = true, children }: SectionShellProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-bg rounded-xl shadow-sm border border-border overflow-hidden mb-5 transition-shadow hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-bg/50 hover:bg-bg transition-colors outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-surface-2 text-accent rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
          <span className="font-semibold text-text text-lg">{title}</span>
        </div>
        <div className="text-text-secondary">
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
      </button>

      <div 
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 border-t border-border' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
