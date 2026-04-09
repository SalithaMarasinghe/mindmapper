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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-5 transition-shadow hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50/50 hover:bg-gray-50 transition-colors outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
          <span className="font-semibold text-gray-900 text-lg">{title}</span>
        </div>
        <div className="text-gray-400">
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
      </button>

      <div 
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 border-t border-gray-100' : 'grid-rows-[0fr] opacity-0'}`}
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
