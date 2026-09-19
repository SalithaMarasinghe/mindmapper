import { useState, useEffect } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { MapGrid } from '../components/dashboard/MapGrid';
import { CreateMapModal } from '../components/dashboard/CreateMapModal';
import { useMapsStore } from '../store/mapsStore';
import { Plus, Search } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { WorkJournal } from '../components/timeline/WorkJournal';

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'work-journal' | 'mind-maps'>('work-journal');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { maps, fetchMaps } = useMapsStore();
  const { isReadOnly } = useSettingsStore();

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  const tabs = (
    <div className="flex bg-[#0f1117] p-1 rounded-lg border border-[#2d3748]">
      <button
        onClick={() => setActiveTab('work-journal')}
        className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
          activeTab === 'work-journal' 
            ? 'bg-[#1e2433] text-teal-400 shadow-sm' 
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Work Journal
      </button>
      <button
        onClick={() => setActiveTab('mind-maps')}
        className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
          activeTab === 'mind-maps' 
            ? 'bg-[#1e2433] text-teal-400 shadow-sm' 
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Mind Maps
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] pb-20 font-sans">
      <AppHeader centerContent={tabs} />
      
      <main className={`mx-auto pt-24 ${
        activeTab === 'work-journal' 
          ? 'w-full px-2 sm:px-4' 
          : 'max-w-7xl px-4 sm:px-6 lg:px-8'
      }`}>
        {activeTab === 'work-journal' ? (
          <div className="work-journal-container">
            <WorkJournal />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Your Mindmaps</h1>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-900/60 text-teal-300">
                    {maps.length} {maps.length === 1 ? 'map' : 'maps'}
                  </span>
                  <span className="text-slate-500 text-xs">
                    · Last updated {maps.length > 0 ? new Date(Math.max(...maps.map(m => new Date(m.updatedAt).getTime()))).toLocaleDateString() : 'never'}
                  </span>
                </div>
                <p className="text-slate-400 mt-1.5 text-sm sm:text-base">Organize your thoughts and expand your knowledge.</p>
              </div>
              
              <div className="flex-1 max-w-md w-full relative text-slate-400 hover:text-slate-300 transition">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" />
                <input 
                  type="text" 
                  placeholder="Search mindmaps..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1e2433] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-[#252b3d] transition-all text-slate-200 border border-[#2d3748] placeholder:text-slate-500"
                />
              </div>

              {!isReadOnly && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition shadow-sm hover:shadow active:scale-95 whitespace-nowrap"
                >
                  <Plus className="h-5 w-5" />
                  New Mindmap
                </button>
              )}
            </div>

            <MapGrid 
              maps={maps} 
              searchQuery={searchQuery} 
              onNew={() => setIsModalOpen(true)} 
            />
          </>
        )}
      </main>

      {isModalOpen && <CreateMapModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
