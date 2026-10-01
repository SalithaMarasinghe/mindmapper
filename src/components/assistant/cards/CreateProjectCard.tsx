import { useState } from 'react';
import { FolderGit2, Sparkles, Tag } from 'lucide-react';
import type { CreateProjectProposal } from '../../../types';
import { ProposalCard } from './ProposalCard';

interface CreateProjectCardProps {
  proposal: CreateProjectProposal;
  onApprove: (updatedProposal?: CreateProjectProposal) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function CreateProjectCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: CreateProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(proposal.payload.name || '');
  const [description, setDescription] = useState(proposal.payload.description || '');
  const [status, setStatus] = useState(proposal.payload.status || 'active');

  const handleApprove = () => {
    const updated: CreateProjectProposal = {
      ...proposal,
      payload: {
        name: name.trim() || proposal.payload.name,
        description: description.trim() || undefined,
        status: status as 'active' | 'completed' | 'on_hold' | 'planning',
      },
    };
    onApprove(updated);
  };

  const statusBadge = {
    active: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
    planning: 'bg-blue-950/70 text-blue-300 border-blue-700/60',
    completed: 'bg-purple-950/70 text-purple-300 border-purple-700/60',
    on_hold: 'bg-amber-950/70 text-amber-300 border-amber-700/60',
  }[status] || 'bg-[#0a0a0a] text-slate-300 border-slate-700';

  return (
    <ProposalCard
      proposal={proposal}
      title={proposal.summary || `Create Project: ${name}`}
      icon={<FolderGit2 className="w-4 h-4 text-teal-400" />}
      onApprove={handleApprove}
      onReject={onReject}
      onEdit={proposal.status === 'pending' ? () => setIsEditing((prev) => !prev) : undefined}
      isSubmitting={isSubmitting}
    >
      <div className="flex flex-col gap-3">
        <p className="text-slate-300">
          The assistant proposes creating a new project initiative to organize and chain your work story:
        </p>

        {isEditing ? (
          <div className="flex flex-col gap-2.5 p-3.5 bg-[#000000] rounded-xl border border-[#1a1a1a]">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Reusable AI Prototype"
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Description / Strategic Scope
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of what this project encompasses..."
                rows={2}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="active">Active (Currently In Progress)</option>
                <option value="planning">Planning (Not Started)</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-[#000000] rounded-xl border border-[#1a1a1a] flex flex-col gap-2 transition hover:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-slate-100 text-sm truncate flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  {name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}
                >
                  {status}
                </span>
              </div>

              {proposal.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold"
                >
                  Edit
                </button>
              )}
            </div>

            {description ? (
              <p className="text-xs text-slate-300 leading-relaxed bg-[#080808] p-2.5 rounded-lg border border-[#161616]">
                {description}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No description provided</p>
            )}

            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 pt-2 border-t border-[#111111]">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-500" />
                Initiative Tracker: <strong>Work Stories & Career Ledger</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </ProposalCard>
  );
}
