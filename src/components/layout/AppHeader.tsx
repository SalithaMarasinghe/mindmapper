import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sun, Moon, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function AppHeader({ searchQuery, setSearchQuery, leftContent }: { searchQuery: string, setSearchQuery: (q: string) => void, leftContent?: React.ReactNode }) {
  const { profile, user, signOut } = useAuthStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initial = profile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 px-4 sm:px-6">
      <div className="flex h-full items-center justify-between">
        
        {/* Left: Logo or Header Replacement */}
        {leftContent ? (
          leftContent
        ) : (
          <div className="flex items-center gap-2 font-bold text-teal-600 text-xl tracking-tight">
            <span className="text-2xl">🧠</span> MindMap
          </div>
        )}

        {/* Center: Search */}
        <div className="flex-1 max-w-md px-4 hidden sm:block relative text-gray-500 hover:text-gray-700 transition">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4" />
          <input 
            type="text" 
            placeholder="Search mindmaps..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-gray-900 border border-transparent"
          />
        </div>
        <div className="sm:hidden flex items-center justify-end flex-1 pr-4">
           <button className="p-2 text-gray-400 hover:text-gray-900 rounded-full transition">
              <Search className="h-5 w-5" />
           </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition">
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 pl-2 hover:bg-gray-100 rounded-full transition ml-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white font-semibold text-sm">
                {initial}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-50">
                  <Link to="/settings" onClick={() => setDropdownOpen(false)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Settings className="h-4 w-4 text-gray-400" /> Settings
                  </Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <LogOut className="h-4 w-4 text-gray-400" /> Sign out
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
