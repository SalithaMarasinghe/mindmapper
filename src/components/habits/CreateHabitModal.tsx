import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { useTimelineStore } from '../../store/timelineStore';
import { PRESET_HABIT_COLORS, formatMinutes } from './HabitUtils';
import type { Habit } from '../../types';

interface CreateHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitToEdit?: Habit | null;
}

export function CreateHabitModal({ isOpen, onClose, habitToEdit }: CreateHabitModalProps) {
  const { createHabit, updateHabit } = useHabitStore();
  const { projects } = useTimelineStore();

  const [name, setName] = useState(habitToEdit?.name || '');
  const [targetMinutes, setTargetMinutes] = useState(habitToEdit?.targetMinutes || 60);
  const [customInput, setCustomInput] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [color, setColor] = useState(habitToEdit?.color || PRESET_HABIT_COLORS[0].hex);
  const [projectId, setProjectId] = useState<string>(habitToEdit?.projectId || '');
  const [icon, setIcon] = useState(habitToEdit?.icon || '⚡');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalTarget = isCustom && parseInt(customInput, 10) > 0 
      ? parseInt(customInput, 10) 
      : targetMinutes;

    const selectedProj = projects.find(p => p.id === projectId);

    if (habitToEdit) {
      await updateHabit(habitToEdit.id, {
        name: name.trim(),
        targetMinutes: finalTarget,
        color,
        icon,
        projectId: projectId ? projectId : null,
        projectTag: selectedProj ? selectedProj.name : null,
      });
    } else {
      await createHabit({
        name: name.trim(),
        targetMinutes: finalTarget,
        color,
        icon,
        projectId: projectId ? projectId : null,
        projectTag: selectedProj ? selectedProj.name : null,
      });
    }

    onClose();
  };

  const commonTargets = [15, 30, 45, 60, 90, 120, 180];
  const EMOJI_OPTIONS = ['⚡', '🧘', '💻', '🌿', '📚', '🏃', '🎨', '🎯', '💧', '✍️'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{icon}</span>
            <div>
              <h3 className="text-base font-bold text-text">
                {habitToEdit ? 'Edit Habit' : 'Create New Habit'}
              </h3>
              <p className="text-xs text-text-muted">Define your routine and daily target</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Name & Emoji */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Habit Name</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yoga, Python & SQL, Reading..."
                autoFocus
                required
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
          </div>

          {/* Quick Emoji Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">Habit Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                    icon === e 
                      ? 'bg-accent/20 border border-accent ring-1 ring-accent' 
                      : 'bg-surface-2 border border-border hover:border-text-muted'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Target Estimate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary">Daily Target Duration</label>
              <span className="text-xs font-bold text-accent">
                {isCustom && customInput ? `${customInput} mins` : formatMinutes(targetMinutes)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {commonTargets.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setTargetMinutes(mins);
                    setIsCustom(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                    !isCustom && targetMinutes === mins
                      ? 'bg-accent text-white border-accent shadow-xs'
                      : 'bg-surface-2 text-text-secondary border-border hover:border-text-muted'
                  }`}
                >
                  {formatMinutes(mins)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                  isCustom 
                    ? 'bg-accent text-white border-accent shadow-xs' 
                    : 'bg-surface-2 text-text-secondary border-border hover:border-text-muted'
                }`}
              >
                Custom
              </button>
            </div>

            {isCustom && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                <input
                  type="number"
                  min="5"
                  max="1440"
                  placeholder="Minutes (e.g. 100)"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="w-36 bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-text-muted">minutes per day</span>
              </div>
            )}
          </div>

          {/* Color Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Calendar Fill Color</label>
            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              {PRESET_HABIT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && <Check className="w-4 h-4 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Project Assignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Project <span className="text-text-muted font-normal">(Optional)</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">No Project (Standalone Routine)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              {habitToEdit ? 'Save Changes' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
