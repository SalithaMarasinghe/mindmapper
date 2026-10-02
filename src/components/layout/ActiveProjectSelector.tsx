import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Target, FolderGit2 } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';

interface ActiveProjectSelectorProps {
  compact?: boolean;
}

export function ActiveProjectSelector({ compact = false }: ActiveProjectSelectorProps) {
  const { projects, activeProjectId, setActiveProjectId, getActiveProject, fetchProjects } = useTimelineStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projects.length === 0) {
      void fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeProject = getActiveProject();

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200 cursor-pointer ${
          activeProject
            ? 'bg-surface hover:bg-surface-2 border-border hover:border-accent/40 text-text'
            : 'bg-surface/50 hover:bg-surface border-border text-text-muted hover:text-text-secondary'
        } ${compact ? 'text-xs h-7' : 'text-xs h-7.5'}`}
        title="Active Focus Project (Narrative Spine)"
        aria-label="Active Focus Project"
      >
        <span className="relative flex h-2 w-2">
          {activeProject && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              activeProject ? 'bg-accent' : 'bg-text-muted'
            }`}
          ></span>
        </span>

        <span className="font-medium text-text-secondary truncate max-w-[105px] xs:max-w-[130px] sm:max-w-[160px]">
          {activeProject ? activeProject.name : 'Select Project'}
        </span>

        <ChevronDown
          className={`w-3 h-3 text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-panel border border-border rounded-[10px] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 mb-1 border-b border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1">
              <Target className="w-3 h-3 text-accent" /> Active Focus Storyline
            </span>
            <span className="text-[10px] text-text-muted">
              {projects.length} project{projects.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {projects.length === 0 ? (
              <div className="p-3 text-center text-xs text-text-muted">No projects found.</div>
            ) : (
              projects.map((p) => {
                const isSelected = p.id === activeProjectId || (!activeProjectId && p.id === activeProject?.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProjectId(p.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-left text-xs transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-surface-2 text-text font-medium'
                        : 'text-text-secondary hover:bg-surface hover:text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FolderGit2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
                      <span className="truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          p.status === 'active'
                            ? 'bg-accent/15 text-accent'
                            : 'bg-surface text-text-muted'
                        }`}
                      >
                        {p.status}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
