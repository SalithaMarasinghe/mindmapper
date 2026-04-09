import { useState } from 'react';
import { inviteFriend } from '../../utils/sharing';
import type { SharePermission } from '../../types';
import { toast } from 'react-hot-toast';
import { Send } from 'lucide-react';

export function InviteByEmail({ mapId, onInviteSent }: { mapId: string, onInviteSent: () => void }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('view');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    
    setIsLoading(true);
    const { error } = await inviteFriend(mapId, email, permission);
    setIsLoading(false);
    
    if (error) {
      toast.error(error);
    } else {
      toast.success(`Invite sent to ${email}`);
      setEmail('');
      onInviteSent();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input 
        type="email"
        placeholder="friend@email.com"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-medium text-sm transition-all"
      />
      <select 
        value={permission}
        onChange={e => setPermission(e.target.value as SharePermission)}
        className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm font-bold text-gray-700 cursor-pointer w-[110px]"
      >
        <option value="view">Can view</option>
        <option value="edit">Can edit</option>
      </select>
      <button 
        type="submit"
        disabled={isLoading || !email.trim()}
        className="bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition shadow-sm active:scale-95"
      >
        <Send className="w-4 h-4 text-white" /> Invite
      </button>
    </form>
  );
}
