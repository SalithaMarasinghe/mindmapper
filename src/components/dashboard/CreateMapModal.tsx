import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { useMapsStore } from '../../store/mapsStore';
import { DEFAULT_BRANCH_COLORS } from '../../types';

interface CreateMapModalProps {
  onClose: () => void;
}

const EMOJI_OPTIONS = ['🧠','💡','🚀','🎯','📚','🗺️','🎨','📐','🛠️','✨','🔥','💻','⚛️','🧬','🌿','📊','📝','🔍','🧩','⚡'];

export function CreateMapModal({ onClose }: CreateMapModalProps) {
  const { createMap } = useMapsStore();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🧠');
  const [color, setColor] = useState(DEFAULT_BRANCH_COLORS[0]);
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    
    const newId = await createMap(title.trim(), emoji, color, tags, description.trim());
    setIsSubmitting(false);

    if (newId) {
      onClose();
      navigate(`/map/${newId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">New Mindmap</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 focus-within:text-teal-600 transition-colors">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
              placeholder="e.g., Fundamentals of React"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Map Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`h-10 w-10 text-xl flex items-center justify-center rounded-lg transition-all ${emoji === e ? 'bg-teal-50 border-2 border-teal-500 shadow-sm' : 'bg-gray-50 border border-transparent hover:bg-gray-100'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Color</label>
            <div className="flex flex-wrap gap-2.5">
              {DEFAULT_BRANCH_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-all flex items-center justify-center hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-gray-900 shadow-md scale-110' : 'shadow-sm'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tags</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
              placeholder="programming, frontend, learning (comma separated)"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description<span className="text-gray-400 font-normal"> - Optional</span></label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none transition-shadow"
              placeholder="What is this mindmap about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="flex items-center px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-teal-400 transition shadow-sm"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Map
          </button>
        </div>
      </div>
    </div>
  );
}
