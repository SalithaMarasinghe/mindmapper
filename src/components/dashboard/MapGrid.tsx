import { useNavigate } from 'react-router-dom';
import { PlusCircle, SearchX } from 'lucide-react';
import { MapCard } from './MapCard';
import type { MindmapMeta } from '../../types';
import { useMapsStore } from '../../store/mapsStore';
import { toast } from 'react-hot-toast';

interface MapGridProps {
  maps: MindmapMeta[];
  searchQuery: string;
  onNew: () => void;
}

export function MapGrid({ maps, searchQuery, onNew }: MapGridProps) {
  const navigate = useNavigate();
  const { deleteMap, duplicateMap, updateMap, isLoading } = useMapsStore();

  const filteredMaps = maps.filter(m => {
    const q = searchQuery.toLowerCase();
    return m.title.toLowerCase().includes(q) || 
           m.tags.some(t => t.toLowerCase().includes(q));
  });

  const handleDelete = async (id: string) => {
    await deleteMap(id);
    toast.success('Map deleted');
  };

  const handleDuplicate = async (id: string) => {
    toast.loading('Duplicating map...', { id: 'dup' });
    const newId = await duplicateMap(id);
    if (newId) {
      toast.success('Map duplicated', { id: 'dup' });
    } else {
      toast.error('Failed to duplicate map', { id: 'dup' });
    }
  };

  const handleRename = async (map: MindmapMeta) => {
    const newName = prompt('Enter new name for the mindmap:', map.title);
    if (newName && newName.trim() !== map.title) {
      await updateMap(map.id, { title: newName.trim() });
      toast.success('Map renamed');
    }
  };

  if (isLoading && maps.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse border border-gray-200" />
        ))}
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm mt-8">
        <div className="text-6xl mb-4">🗺️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No mindmaps yet</h3>
        <p className="text-gray-500 mb-6 max-w-sm">Capture your knowledge, visualize ideas, and build mental models layer by layer.</p>
        <button 
          onClick={onNew}
          className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition hover:shadow-md"
        >
          <PlusCircle className="h-5 w-5" />
          Create your first mindmap
        </button>
      </div>
    );
  }

  if (filteredMaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <SearchX className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-500">We couldn't find anything matching "{searchQuery}".</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredMaps.map(map => (
        <MapCard 
          key={map.id} 
          map={map} 
          onClick={() => navigate(`/map/${map.id}`)}
          onDelete={() => handleDelete(map.id)}
          onDuplicate={() => handleDuplicate(map.id)}
          onRename={() => handleRename(map)}
        />
      ))}
    </div>
  );
}
