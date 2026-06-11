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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="bg-[#1e2433] rounded-2xl shadow-2xl border border-[#2d3748] w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#2d3748] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">New Mindmap</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#2d3748] rounded-full text-slate-400 hover:text-slate-200 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5 focus-within:text-teal-400 transition-colors">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              required
              type="text"
              className="w-full rounded-lg border border-[#2d3748] bg-[#0f1117] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-shadow"
              placeholder="e.g., Fundamentals of React"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Map Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`h-10 w-10 text-xl flex items-center justify-center rounded-lg transition-all ${emoji === e ? 'bg-teal-900/50 border-2 border-teal-500 shadow-sm' : 'bg-[#0f1117] border border-[#2d3748] hover:bg-[#2d3748]'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Primary Color</label>
            <div className="flex flex-wrap gap-2.5">
              {DEFAULT_BRANCH_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-all flex items-center justify-center hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-offset-[#1e2433] ring-slate-200 shadow-md scale-110' : 'shadow-sm'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Tags</label>
            <input
              type="text"
              className="w-full rounded-lg border border-[#2d3748] bg-[#0f1117] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-shadow"
              placeholder="programming, frontend, learning (comma separated)"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Description<span className="text-slate-500 font-normal"> - Optional</span></label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-[#2d3748] bg-[#0f1117] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none transition-shadow"
              placeholder="What is this mindmap about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-[#2d3748] bg-[#0f1117]/50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-[#2d3748] bg-[#2d3748]/50 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="flex items-center px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-teal-800/50 disabled:text-teal-400 transition shadow-sm"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Map
          </button>
        </div>
      </div>
    </div>
  );
}
