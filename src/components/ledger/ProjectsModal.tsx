import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderGit2,
  Plus,
  Trash2,
  X,
  Search,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTimelineStore } from '../../store/timelineStore';
import type { Project } from '../../types';

export interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectsModal({ isOpen, onClose }: ProjectsModalProps) {
  const { projects, fetchProjects, createProject, updateProject, deleteProject } = useTimelineStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'planning' | 'on_hold'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'planning' | 'completed' | 'on_hold'>('active');
  const [newCategory, setNewCategory] = useState<'work' | 'study'>('work');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void fetchProjects();
    }
  }, [isOpen, fetchProjects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Project name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createProject(newName, newDesc, newStatus, newCategory);
      if (created) {
        toast.success(`Project "${created.name}" created!`);
        setNewName('');
        setNewDesc('');
        setNewStatus('active');
        setNewCategory('work');
        setIsCreating(false);
      }
    } catch {
      toast.error('Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (project: Project, status: 'active' | 'completed' | 'planning' | 'on_hold') => {
    try {
      await updateProject(project.id, { status });
      toast.success(`"${project.name}" marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Are you sure you want to delete project "${project.name}"?`)) return;
    try {
      await deleteProject(project.id);
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-panel border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-surface-2 border border-border text-text">
              <FolderGit2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Projects & Initiatives</h2>
              <p className="text-xs text-text-muted">Manage your engineering work stories and career causal spines</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-text text-bg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              {isCreating ? 'Cancel' : 'New Initiative'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Create Form Drawer */}
        {isCreating && (
          <form onSubmit={handleCreate} className="p-5 border-b border-border bg-surface-2/40 flex flex-col gap-3 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="text-xs font-semibold text-text">New Project Initiative</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Initiative Name (e.g. Fabric Data Engineering)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                  autoFocus
                />
              </div>
              <div>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text focus:outline-none focus:border-border-strong"
                  title="Category"
                >
                  <option value="work">💼 Work</option>
                  <option value="study">🎓 Study</option>
                </select>
              </div>
              <div>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text focus:outline-none focus:border-border-strong"
                >
                  <option value="active">Active</option>
                  <option value="planning">Planning</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>
            <div>
              <textarea
                placeholder="Scope, objectives, or brief description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="w-full bg-surface border border-border rounded-lg p-2.5 text-xs text-text placeholder:text-text-muted resize-none focus:outline-none focus:border-border-strong"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-text text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? 'Creating...' : 'Create Initiative'}
              </button>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search initiatives..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-strong"
            />
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'active', 'planning', 'completed', 'on_hold'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-surface-2 text-text border border-border-strong'
                    : 'text-text-muted hover:text-text hover:bg-surface-2/50'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-xs">
              {search || statusFilter !== 'all' ? 'No matching initiatives found.' : 'No project initiatives yet. Click "New Initiative" above to create one!'}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const statusColors = {
                active: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
                completed: 'text-text-muted bg-surface-2 border-border',
                planning: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
                on_hold: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
              }[project.status] || 'text-text-muted bg-surface border-border';

              return (
                <div
                  key={project.id}
                  className="p-4 rounded-xl bg-surface border border-border hover:border-border-strong transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-text truncate">{project.name}</span>
                      {project.category === 'study' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border text-purple-400 bg-purple-950/40 border-purple-800/40 flex items-center gap-1">
                          🎓 Study
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border text-teal-400 bg-teal-950/40 border-teal-800/40 flex items-center gap-1">
                          💼 Work
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors} capitalize`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{project.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <select
                      value={project.status}
                      onChange={(e) => handleStatusChange(project, e.target.value as any)}
                      className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-text font-medium focus:outline-none focus:border-border-strong cursor-pointer"
                      title="Update Status"
                    >
                      <option value="active">Active</option>
                      <option value="planning">Planning</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                    </select>

                    <button
                      onClick={() => handleDelete(project)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
