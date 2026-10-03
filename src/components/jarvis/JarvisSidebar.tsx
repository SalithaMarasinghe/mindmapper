import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Trash2,
  Globe,
  Headphones,
  Loader2,
  Monitor,
  Settings,
  LogOut,
  PanelLeftClose,
  X,
  Target,
  FolderGit2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useAssistantStore } from '../../store/assistantStore';
import { useJarvisStore } from '../../store/jarvisStore';
import { useAuthStore } from '../../store/authStore';
import { useTimelineStore } from '../../store/timelineStore';
import type { AssistantConversation } from '../../types';

interface JarvisSidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export function JarvisSidebar({ onClose, isMobile }: JarvisSidebarProps) {
  const {
    conversations,
    currentConversationId,
    selectConversation,
    deleteConversation,
    startNewConversation,
    isLoadingConversations,
  } = useAssistantStore();

  const {
    isHandsFree,
    isWakeWordLoading,
    toggleHandsFree,
    isWebSearchEnabled,
    toggleWebSearch,
  } = useJarvisStore();

  const { user, signOut } = useAuthStore();

  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    getActiveProject,
    fetchProjects,
  } = useTimelineStore();

  const [projectDropdownOpen, setProjectDropdownOpen] = React.useState(false);
  const projectRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (projects.length === 0) {
      void fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    if (projectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [projectDropdownOpen]);

  const activeProject = getActiveProject();

  // Group conversations chronologically
  const grouped = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgo = todayStart - 6 * 86400000;

    const groups: {
      today: AssistantConversation[];
      yesterday: AssistantConversation[];
      last7Days: AssistantConversation[];
      older: AssistantConversation[];
    } = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    for (const c of conversations) {
      const time = new Date(c.updatedAt || c.createdAt).getTime();
      if (time >= todayStart) {
        groups.today.push(c);
      } else if (time >= yesterdayStart) {
        groups.yesterday.push(c);
      } else if (time >= sevenDaysAgo) {
        groups.last7Days.push(c);
      } else {
        groups.older.push(c);
      }
    }

    return groups;
  }, [conversations]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === currentConversationId) {
      startNewConversation();
    }
    await deleteConversation(id);
  };

  const handleSelect = (id: string) => {
    selectConversation(id);
    if (isMobile) {
      onClose?.();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface/80 backdrop-blur-md text-text select-none">
      {/* ── Top Header Row ────────────────────────────────────────────── */}
      <div className="pt-[max(env(safe-area-inset-top,0px),8px)] pb-2 px-3 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-xs tracking-wide text-text uppercase">
            Sessions
          </span>
          <span className="text-[10px] text-text-muted/60 font-mono">
            ({conversations.length})
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        >
          {isMobile ? <X className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* ── New Session Button ─────────────────────────────────────────── */}
      <div className="p-3 border-b border-border/30 shrink-0">
        <button
          type="button"
          onClick={() => {
            startNewConversation();
            if (isMobile) onClose?.();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] bg-surface-2 hover:bg-surface-3 border border-border/60 hover:border-border text-xs font-medium text-text transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
            <span>New Session</span>
          </div>
          <span className="text-[10px] text-text-muted/60 font-mono">Clean chat</span>
        </button>
      </div>

      {/* ── Active Project Section ────────────────────────────────────────── */}
      <div className="p-3 border-b border-border/30 shrink-0" ref={projectRef}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 px-1 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-accent" /> Active Focus Project
          </span>
          <span className="text-[10px] text-text-muted/50 font-mono">
            {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] bg-surface-2/80 hover:bg-surface-2 border border-border/60 hover:border-border text-xs transition-colors cursor-pointer group shadow-2xs"
            title="Switch Active Project"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
              <FolderGit2 className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="font-medium text-text truncate">
                {activeProject ? activeProject.name : 'Select Project'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {activeProject && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-accent/15 text-accent font-medium">
                  {activeProject.status}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-text-muted group-hover:text-text transition-transform duration-200 ${
                  projectDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {projectDropdownOpen && (
            <div className="mt-1.5 w-full bg-panel border border-border rounded-[10px] shadow-xl p-1 max-h-48 overflow-y-auto space-y-0.5 animate-in fade-in zoom-in-95 duration-100 z-10">
              {projects.length === 0 ? (
                <div className="p-2.5 text-center text-xs text-text-muted">No projects found.</div>
              ) : (
                projects.map((p) => {
                  const isSelected = p.id === activeProjectId || (!activeProjectId && p.id === activeProject?.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[6px] text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-surface-2 text-text font-medium border border-border/50'
                          : 'text-text-secondary hover:bg-surface hover:text-text border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FolderGit2 className={`w-3 h-3 shrink-0 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full uppercase text-text-muted">
                          {p.status}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Instant 1-Click Toggles Section ────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-border/30 space-y-1.5 shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 px-1 mb-1">
          Instant Controls
        </div>

        {/* 1-Click Hands-Free Wake-Word Toggle */}
        <button
          type="button"
          onClick={() => void toggleHandsFree()}
          disabled={isWakeWordLoading}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[8px] text-xs transition-colors cursor-pointer border ${
            isHandsFree
              ? 'bg-accent/15 text-accent font-medium border-accent/40 shadow-xs'
              : 'hover:bg-surface-2 text-text-secondary hover:text-text border-transparent'
          }`}
          title={isHandsFree ? "Hands-Free Active ('Hey Jarvis') - Tap to turn off" : "Turn on Hands-Free ('Hey Jarvis')"}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isWakeWordLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />
            ) : (
              <Headphones className={`w-3.5 h-3.5 shrink-0 ${isHandsFree ? 'text-accent' : 'text-text-muted'}`} />
            )}
            <span className="truncate">Hands-Free ('Hey Jarvis')</span>
          </div>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase shrink-0 transition-colors ${
              isHandsFree
                ? 'bg-accent text-bg font-bold'
                : 'bg-surface-2 text-text-muted font-medium'
            }`}
          >
            {isWakeWordLoading ? '...' : isHandsFree ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* 1-Click Auto Web Search Toggle */}
        <button
          type="button"
          onClick={toggleWebSearch}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[8px] text-xs transition-colors cursor-pointer border ${
            isWebSearchEnabled
              ? 'bg-accent/15 text-accent font-medium border-accent/40 shadow-xs'
              : 'hover:bg-surface-2 text-text-secondary hover:text-text border-transparent'
          }`}
          title={isWebSearchEnabled ? 'Auto Web Search Active (searches automatically when needed) - Tap to disable' : 'Auto Web Search Disabled - Tap to enable'}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Globe className={`w-3.5 h-3.5 shrink-0 ${isWebSearchEnabled ? 'text-accent' : 'text-text-muted'}`} />
            <span className="truncate">Auto Web Search</span>
          </div>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase shrink-0 transition-colors ${
              isWebSearchEnabled
                ? 'bg-accent text-bg font-bold'
                : 'bg-surface-2 text-text-muted font-medium'
            }`}
          >
            {isWebSearchEnabled ? 'AUTO' : 'OFF'}
          </span>
        </button>
      </div>

      {/* ── Scrollable Past Conversations List ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2 space-y-3">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-xs space-y-2">
            <Loader2 className="w-4 h-4 animate-spin mx-auto text-accent" />
            <p>Loading sessions...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-8 px-3 text-center text-text-muted text-xs">
            <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-30 text-text-muted" />
            <p className="font-medium text-text-secondary">No conversations yet</p>
            <p className="text-[11px] text-text-muted/70 mt-1">
              Ask Jarvis anything to start your first session.
            </p>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <ConversationGroup
                title="Today"
                items={grouped.today}
                currentId={currentConversationId}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            )}
            {grouped.yesterday.length > 0 && (
              <ConversationGroup
                title="Yesterday"
                items={grouped.yesterday}
                currentId={currentConversationId}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            )}
            {grouped.last7Days.length > 0 && (
              <ConversationGroup
                title="Previous 7 Days"
                items={grouped.last7Days}
                currentId={currentConversationId}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            )}
            {grouped.older.length > 0 && (
              <ConversationGroup
                title="Older"
                items={grouped.older}
                currentId={currentConversationId}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            )}
          </>
        )}
      </div>

      {/* ── Footer Actions & User Account ──────────────────────────────── */}
      <div className="p-2.5 border-t border-border/30 space-y-1 text-xs shrink-0">
        {/* Switch to Desktop Dashboard */}
        <Link
          to="/dashboard"
          onClick={() => {
            sessionStorage.setItem('prefer_desktop', 'true');
            if (isMobile) onClose?.();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] hover:bg-surface-2 text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          <Monitor className="w-3.5 h-3.5 text-text-muted" />
          <span>Desktop Dashboard</span>
        </Link>

        {/* Settings */}
        <Link
          to="/settings"
          onClick={() => {
            if (isMobile) onClose?.();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] hover:bg-surface-2 text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-text-muted" />
          <span>Settings</span>
        </Link>

        {/* User Account & Sign Out */}
        <div className="pt-2 mt-1 border-t border-border/20 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <div className="w-6 h-6 rounded-full bg-surface-2 border border-border/60 flex items-center justify-center text-[10px] font-semibold text-text-secondary shrink-0">
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <span className="text-[11px] text-text-muted truncate">
              {user?.email || 'Logged In'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isMobile) onClose?.();
              signOut();
            }}
            className="p-1.5 rounded-[6px] hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors cursor-pointer shrink-0"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationGroup({
  title,
  items,
  currentId,
  onSelect,
  onDelete,
}: {
  title: string;
  items: AssistantConversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 px-2 py-1">
        {title}
      </div>
      {items.map((conv) => {
        const isActive = conv.id === currentId;
        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full group flex items-center justify-between px-2.5 py-2 rounded-[8px] text-xs transition-colors cursor-pointer ${
              isActive
                ? 'bg-surface-2 text-text font-medium shadow-xs border border-border/50'
                : 'hover:bg-surface-2/60 text-text-secondary hover:text-text border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
              <MessageSquare
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
                }`}
              />
              <span className="truncate">{conv.title || 'Untitled Session'}</span>
            </div>

            <button
              type="button"
              onClick={(e) => onDelete(conv.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-all shrink-0 cursor-pointer"
              title="Delete conversation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
