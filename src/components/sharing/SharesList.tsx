import { useEffect, useState } from 'react';
import { getShares, removeInvite } from '../../utils/sharing';
import type { MapShare } from '../../types';
import { toast } from 'react-hot-toast';

export function SharesList({ mapId }: { mapId: string }) {
  const [shares, setShares] = useState<MapShare[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShares = async () => {
    const list = await getShares(mapId);
    setShares(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchShares();
  }, [mapId]);

  const handleRemove = async (shareId: string) => {
    await removeInvite(shareId);
    toast.success('Access removed');
    fetchShares();
  };

  if (loading) return <div className="text-sm font-semibold text-gray-400 py-2">Loading permissions...</div>;
  if (shares.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">People with access</div>
      {shares.map(share => (
        <div key={share.id} className="flex items-center justify-between py-2 group">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs shadow-sm">
               {share.sharedWithEmail?.[0]?.toUpperCase()}
             </div>
             <span className="text-sm font-bold text-gray-800">{share.sharedWithEmail}</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs font-semibold px-2 py-0.5 rounded border-gray-200 bg-gray-50 text-gray-600 border capitalize">
               Can {share.permission}
             </span>
             <button 
               onClick={() => handleRemove(share.id)}
               className="text-xs font-bold text-gray-400 hover:text-red-600 transition px-2 py-1 hover:bg-red-50 rounded"
             >
               Remove
             </button>
          </div>
        </div>
      ))}
    </div>
  );
}
