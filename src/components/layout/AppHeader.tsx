import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Lock, Unlock, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';

export function AppHeader({
  searchQuery,
  setSearchQuery,
  leftContent,
  rightContent,
}: {
  searchQuery: string,
  setSearchQuery: (q: string) => void,
  leftContent?: React.ReactNode,
  rightContent?: React.ReactNode,
}) {
  const { profile, user, signOut } = useAuthStore();
  const { isReadOnly, toggleReadOnly } = useSettingsStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initial = profile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#1e2433] border-b border-[#2d3748] z-50 px-4 sm:px-6">
      <div className="flex h-full items-center justify-between">
        
        {/* Left: Logo or Header Replacement */}
        {leftContent ? (
          leftContent
        ) : (
          <div className="flex items-center gap-2 font-bold text-teal-400 text-xl tracking-tight">
            <span className="text-2xl">🧠</span> MindMap
          </div>
        )}

        {/* Center: Search */}
        <div className="flex-1 max-w-md px-4 hidden sm:block relative text-slate-400 hover:text-slate-300 transition">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4" />
          <input 
            type="text" 
            placeholder="Search mindmaps..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f1117] rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-[#1a2030] transition-all text-slate-200 border border-[#2d3748] placeholder:text-slate-500"
          />
        </div>
        <div className="sm:hidden flex items-center justify-end flex-1 pr-4">
           <button className="p-2 text-slate-400 hover:text-slate-200 rounded-full transition">
              <Search className="h-5 w-5" />
           </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {rightContent}
          <button onClick={toggleReadOnly} className="p-2 text-slate-400 hover:bg-[#2d3748] rounded-full transition" title={isReadOnly ? "Read-only mode (click to unlock)" : "Edit mode (click to lock)"}>
            {isReadOnly ? <Lock className="h-5 w-5 text-orange-400" /> : <Unlock className="h-5 w-5" />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 pl-2 hover:bg-[#2d3748] rounded-full transition ml-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white font-semibold text-sm">
                {initial}
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[#1e2433] rounded-md shadow-lg border border-[#2d3748] py-1 z-50">
                  <Link to="/settings" onClick={() => setDropdownOpen(false)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-[#2d3748] hover:text-white transition">
                    <Settings className="h-4 w-4 text-slate-500" /> Settings
                  </Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-[#2d3748] hover:text-white transition">
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
