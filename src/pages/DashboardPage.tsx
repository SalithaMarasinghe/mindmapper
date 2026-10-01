import { useState, useEffect } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { MapGrid } from '../components/dashboard/MapGrid';
import { CreateMapModal } from '../components/dashboard/CreateMapModal';
import { useMapsStore } from '../store/mapsStore';
import { Plus, Search } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { WorkJournal } from '../components/timeline/WorkJournal';
import { TaskLog } from '../components/tasklog/TaskLog';
import { JarvisScreen } from '../components/jarvis/JarvisScreen';
import { CareerLedgerModal } from '../components/ledger/CareerLedgerModal';

type DashboardTab = 'jarvis-cockpit' | 'task-log' | 'work-journal' | 'mind-maps';

const TABS = [
  { id: 'jarvis-cockpit', label: 'Jarvis AI' },
  { id: 'task-log', label: 'Task Log' },
  { id: 'work-journal', label: 'Work Journal' },
  { id: 'mind-maps', label: 'Mind Maps' },
];

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('jarvis-cockpit');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const { maps, fetchMaps } = useMapsStore();
  const { isReadOnly } = useSettingsStore();

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  const isFullScreen = activeTab !== 'mind-maps';

  return (
    <div className={`min-h-screen bg-bg font-sans ${isFullScreen ? 'h-screen flex flex-col overflow-hidden' : 'pb-20'}`}>
      <TopBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as DashboardTab)}
        onCareerLedgerOpen={() => setIsLedgerOpen(true)}
      />
      
      <main className={`${
        isFullScreen
          ? 'w-full flex-1 flex flex-col min-h-0 pt-12 px-0' 
          : 'max-w-7xl mx-auto pt-24 px-4 sm:px-6 lg:px-8'
      }`}>
        {activeTab === 'jarvis-cockpit' && (
          <div className="flex-1 flex flex-col min-h-0 w-full h-full">
            <JarvisScreen />
          </div>
        )}

        {activeTab === 'task-log' && (
          <div className="flex-1 flex flex-col min-h-0 w-full h-full">
            <TaskLog />
          </div>
        )}

        {activeTab === 'work-journal' && (
          <div className="flex-1 flex flex-col min-h-0 w-full h-full">
            <WorkJournal />
          </div>
        )}

        {activeTab === 'mind-maps' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-text tracking-tight">Your Mindmaps</h1>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-text-secondary">
                    {maps.length} {maps.length === 1 ? 'map' : 'maps'}
                  </span>
                  <span className="text-text-muted text-xs">
                    · Last updated {maps.length > 0 ? new Date(Math.max(...maps.map(m => new Date(m.updatedAt).getTime()))).toLocaleDateString() : 'never'}
                  </span>
                </div>
                <p className="text-text-secondary mt-1.5 text-sm sm:text-base">Organize your thoughts and expand your knowledge.</p>
              </div>
              
              <div className="flex-1 max-w-md w-full relative text-text-muted hover:text-text-secondary transition-colors">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" />
                <input 
                  type="text" 
                  placeholder="Search mindmaps..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-surface rounded-[12px] py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-surface-2 transition-all text-text border border-border placeholder:text-text-muted"
                />
              </div>

              {!isReadOnly && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-white text-[#0B0B0C] px-5 py-2.5 rounded-[12px] font-medium hover:bg-white/90 transition-colors shadow-sm active:scale-95 whitespace-nowrap"
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
      {isLedgerOpen && <CareerLedgerModal isOpen={isLedgerOpen} onClose={() => setIsLedgerOpen(false)} />}
    </div>
  );
}
