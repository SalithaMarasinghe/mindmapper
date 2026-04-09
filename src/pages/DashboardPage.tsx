import { useState, useEffect } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { MapGrid } from '../components/dashboard/MapGrid';
import { CreateMapModal } from '../components/dashboard/CreateMapModal';
import { useMapsStore } from '../store/mapsStore';
import { Plus } from 'lucide-react';

export function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { maps, fetchMaps } = useMapsStore();

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <AppHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Your Mindmaps</h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                {maps.length} {maps.length === 1 ? 'map' : 'maps'}
              </span>
              <span className="text-gray-400 text-xs">
                · Last updated {maps.length > 0 ? new Date(Math.max(...maps.map(m => new Date(m.updatedAt).getTime()))).toLocaleDateString() : 'never'}
              </span>
            </div>
            <p className="text-gray-500 mt-1.5 text-sm sm:text-base">Organize your thoughts and expand your knowledge.</p>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition shadow-sm hover:shadow active:scale-95 whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            New Mindmap
          </button>
        </div>

        <MapGrid 
          maps={maps} 
          searchQuery={searchQuery} 
          onNew={() => setIsModalOpen(true)} 
        />
      </main>

      {isModalOpen && <CreateMapModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
