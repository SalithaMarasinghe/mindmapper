import { useEffect, useRef, useState } from 'react';

export interface SegmentedTabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function SegmentedTabs({ tabs, activeTab, onTabChange }: SegmentedTabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const activeElement = tabsRef.current.get(activeTab);
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div className="bg-panel rounded-[12px] p-1 border border-border inline-flex items-center relative">
      <div
        className="absolute bg-surface-2 rounded-[8px] h-[calc(100%-8px)] top-1"
        style={{
          transform: `translateX(${indicatorStyle.left}px)`,
          width: `${indicatorStyle.width}px`,
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}
        aria-hidden="true"
      />
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabsRef.current.set(tab.id, el);
              else tabsRef.current.delete(tab.id);
            }}
            onClick={() => onTabChange(tab.id)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-[8px] relative z-10 transition-colors duration-200 ${
              isActive ? 'text-text' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
