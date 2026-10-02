import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Unlock, Settings, LogOut, ChevronDown, FileText, FolderGit2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { NotificationBell } from '../notifications/NotificationBell';
import { SegmentedTabs } from './SegmentedTabs';
import { ActiveProjectSelector } from './ActiveProjectSelector';

export interface TopBarProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onCareerLedgerOpen: () => void;
  onProjectsOpen?: () => void;
}

export function TopBar({
  tabs,
  activeTab,
  onTabChange,
  onCareerLedgerOpen,
  onProjectsOpen,
}: TopBarProps) {
  const { profile, user, signOut } = useAuthStore();
  const { isReadOnly, toggleReadOnly } = useSettingsStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        onTabChange('jarvis-cockpit');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange]);

  const initial = profile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="fixed top-0 inset-x-0 h-12 bg-bg border-b border-border z-50 px-4">
      <div className="flex h-full items-center justify-between">
        
        {/* Left: Logo & Active Focus Project */}
        <div className="flex-1 flex items-center justify-start gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-accent text-lg tracking-tight shrink-0">
            <span>🧠</span> MindMap
          </Link>
          <div className="hidden md:flex items-center">
            <ActiveProjectSelector />
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex-1 flex justify-center items-center px-4">
          <SegmentedTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        </div>

        {/* Right: Actions */}
        <div className="flex-1 flex justify-end items-center gap-1.5">
          {/* Projects Initiative Manager Button */}
          {onProjectsOpen && (
            <button
              onClick={onProjectsOpen}
              className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary px-2 py-1.5 rounded-[8px] hover:bg-surface transition-colors"
              title="Projects & Initiatives"
            >
              <FolderGit2 className="h-4 w-4" />
            </button>
          )}

          {/* Career Ledger Button */}
          <button
            onClick={onCareerLedgerOpen}
            className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary px-2 py-1.5 rounded-[8px] hover:bg-surface transition-colors"
            title="Career Ledger"
          >
            <FileText className="h-4 w-4" />
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Read Only Toggle */}
          <button 
            onClick={toggleReadOnly} 
            className="p-1.5 rounded-[8px] hover:bg-surface text-text-muted transition-colors" 
            title={isReadOnly ? "Read-only mode (click to unlock)" : "Edit mode (click to lock)"}
          >
            {isReadOnly ? <Lock className="h-4 w-4 text-orange-400" /> : <Unlock className="h-4 w-4" />}
          </button>
          
          {/* Avatar Dropdown */}
          <div className="relative ml-1">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 p-1 pl-1.5 hover:bg-surface rounded-full transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-bg font-semibold text-sm">
                {initial}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-text-muted hidden sm:block" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-panel rounded-[8px] shadow-lg border border-border py-1 z-50">
                  <Link 
                    to="/settings" 
                    onClick={() => setDropdownOpen(false)} 
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text transition-colors"
                  >
                    <Settings className="h-4 w-4 text-text-muted" /> Settings
                  </Link>
                  <button 
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }} 
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-text-muted" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
