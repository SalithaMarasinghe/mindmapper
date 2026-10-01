import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Unlock, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';

import { useJarvisStore } from '../../store/jarvisStore';
import { JarvisOrb } from '../jarvis/JarvisOrb';
import { NotificationBell } from '../notifications/NotificationBell';

export function AppHeader({
  leftContent,
  centerContent,
  rightContent,
  onJarvisClick,
}: {
  leftContent?: React.ReactNode,
  centerContent?: React.ReactNode,
  rightContent?: React.ReactNode,
  onJarvisClick?: () => void,
}) {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuthStore();
  const { isReadOnly, toggleReadOnly } = useSettingsStore();
  const { orbState, audioLevel, isRecording } = useJarvisStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleJarvisTrigger = () => {
    if (onJarvisClick) {
      onJarvisClick();
    } else {
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        handleJarvisTrigger();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onJarvisClick]);

  const initial = profile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#0a0a0a] border-b border-[#1a1a1a] z-50 px-4 sm:px-6">
      <div className="flex h-full items-center justify-between">
        
        {/* Left: Logo or Header Replacement */}
        {leftContent ? (
          leftContent
        ) : (
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-teal-400 text-xl tracking-tight">
            <span className="text-2xl">🧠</span> MindMap
          </Link>
        )}

        {/* Center: Content */}
        <div className="flex-1 flex justify-center items-center px-4">
          {centerContent}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Jarvis Header Globe Capsule */}
          <button
            type="button"
            onClick={handleJarvisTrigger}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#000000] border border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all duration-200 group mr-1"
            title="Switch to Jarvis AI (Alt+J)"
          >
            <div className="relative flex items-center justify-center">
              <JarvisOrb size={24} state={orbState} audioLevel={audioLevel} glow={false} />
              {isRecording && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <span className="text-xs font-semibold text-cyan-300 tracking-wide hidden sm:inline">
              Jarvis
            </span>
            <kbd className="hidden md:inline-block px-1 py-0.5 rounded bg-[#0a0a0a] text-[10px] text-cyan-400 font-mono border border-slate-700">
              Alt+J
            </kbd>
          </button>

          {/* Notification Bell with 1-Click Meeting Join */}
          <NotificationBell />

          {rightContent}
          <button onClick={toggleReadOnly} className="p-2 text-slate-400 hover:bg-[#141414] rounded-full transition" title={isReadOnly ? "Read-only mode (click to unlock)" : "Edit mode (click to lock)"}>
            {isReadOnly ? <Lock className="h-5 w-5 text-orange-400" /> : <Unlock className="h-5 w-5" />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 pl-2 hover:bg-[#141414] rounded-full transition ml-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white font-semibold text-sm">
                {initial}
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] rounded-md shadow-lg border border-[#1a1a1a] py-1 z-50">
                  <Link to="/settings" onClick={() => setDropdownOpen(false)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-[#141414] hover:text-white transition">
                    <Settings className="h-4 w-4 text-slate-500" /> Settings
                  </Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-[#141414] hover:text-white transition">
                    <LogOut className="h-4 w-4 text-slate-500" /> Sign out
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

