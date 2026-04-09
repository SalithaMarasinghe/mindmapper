import { useState } from 'react';
import { Link as LinkIcon, Plus, X, ExternalLink } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { useContentStore } from '../../store/contentStore';

export function ResourcesSection({ nodeId }: { nodeId: string }) {
  const { content, addResource, removeResource } = useContentStore();
  const resources = content[nodeId]?.resources || [];

  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    addResource(nodeId, {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: newUrl.trim() || undefined
    });
    
    setNewTitle('');
    setNewUrl('');
  };

  return (
    <SectionShell title="Resources" icon={LinkIcon} defaultOpen={false}>
      <div className="flex flex-col gap-4">
        
        {resources.length === 0 ? (
          <p className="text-gray-400 italic text-sm py-1">No resources added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {resources.map(res => (
              <div key={res.id} className="flex items-center justify-between bg-gray-50/50 border border-gray-200 px-4 py-3 rounded-lg group hover:border-teal-200 hover:bg-white transition-colors cursor-default shadow-sm">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">{res.title}</span>
                  {res.url && (
                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-1 mt-0.5 w-fit">
                      {res.url} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button 
                  onClick={() => removeResource(nodeId, res.id)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors bg-white rounded-md border border-transparent shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="mt-2 bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-inner flex flex-col gap-3">
          <div className="text-sm font-bold text-gray-700">Add a link or reference</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Title (e.g. React Docs)"
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm transition-all"
            />
            <input
              placeholder="URL (optional)"
              type="url"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm transition-all"
            />
          </div>
          <button 
            type="submit"
            disabled={!newTitle.trim()}
            className="flex items-center justify-center gap-2 text-white font-medium text-sm bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 px-4 py-2 rounded-md transition-colors self-end w-full sm:w-auto mt-2"
          >
            <Plus className="h-4 w-4" /> Add Resource
          </button>
        </form>

      </div>
    </SectionShell>
  );
}
