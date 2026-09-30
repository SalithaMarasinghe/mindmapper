import { useState } from 'react';
import { ListPlus, AlertTriangle, Calendar } from 'lucide-react';
import type { CreateTasksProposal } from '../../../types';
import { ProposalCard } from './ProposalCard';

interface TaskProposalCardProps {
  proposal: CreateTasksProposal;
  onApprove: (updatedProposal?: CreateTasksProposal) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function TaskProposalCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: TaskProposalCardProps) {
  const [tasks, setTasks] = useState(() => proposal.payload.tasks);

  const handleRemoveTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApprove = () => {
    if (tasks.length === 0) {
      onReject();
      return;
    }
    const updated: CreateTasksProposal = {
      ...proposal,
      payload: { tasks },
    };
    onApprove(updated);
  };

  return (
    <ProposalCard
      proposal={proposal}
      title={proposal.summary || `Create ${tasks.length} Task${tasks.length === 1 ? '' : 's'}`}
      icon={<ListPlus className="w-4 h-4 text-teal-400" />}
      onApprove={handleApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-slate-300">
          The assistant proposes adding the following tasks to <strong className="text-teal-300">To Do</strong>:
        </p>

        <div className="flex flex-col gap-2">
          {tasks.map((task, idx) => {
            const priorityBadge = {
              high: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
              medium: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
              low: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
            }[task.priority];

            return (
              <div
                key={task.tempId || idx}
                className="p-3 bg-[#0f1117] rounded-xl border border-[#2d3748] flex flex-col gap-1.5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-slate-500 text-xs">#{idx + 1}</span>
                    <span className="font-semibold text-slate-100 truncate">{task.title}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider border ${priorityBadge}`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  {proposal.status === 'pending' && tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(idx)}
                      title="Remove this task from proposal"
                      className="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded transition"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {task.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Planned: {task.plannedDate}
                  </span>

                  {task.isLikelyDuplicate && (
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <AlertTriangle className="w-3 h-3" />
                      Possible duplicate of an existing task
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProposalCard>
  );
}
