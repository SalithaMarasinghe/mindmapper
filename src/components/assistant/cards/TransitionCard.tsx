import { useState } from 'react';
import { Play, CheckCircle2, Coffee, Clock, AlertTriangle } from 'lucide-react';
import type {
  StartTaskProposal,
  PauseTaskProposal,
  ResumeTaskProposal,
  FinishTaskProposal,
  PauseAllProposal,
  ResumeLastPausedProposal,
} from '../../../types';
import { ProposalCard } from './ProposalCard';
import { toLocalInputValue, fromLocalInputValue } from '../../../utils/taskTime';

type TransitionProposal =
  | StartTaskProposal
  | PauseTaskProposal
  | ResumeTaskProposal
  | FinishTaskProposal
  | PauseAllProposal
  | ResumeLastPausedProposal;

interface TransitionCardProps {
  proposal: TransitionProposal;
  onApprove: (updatedProposal?: TransitionProposal) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function TransitionCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: TransitionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localTime, setLocalTime] = useState(() =>
    toLocalInputValue(proposal.payload.timestampISO)
  );

  const getIcon = () => {
    switch (proposal.type) {
      case 'start_task':
        return <Play className="w-4 h-4 text-text fill-current" />;
      case 'pause_task':
      case 'pause_all':
        return <Coffee className="w-4 h-4 text-amber-300" />;
      case 'resume_task':
      case 'resume_last_paused':
        return <Play className="w-4 h-4 text-text fill-current" />;
      case 'finish_task':
        return <CheckCircle2 className="w-4 h-4 text-text" />;
    }
  };

  const handleApprove = () => {
    const iso = fromLocalInputValue(localTime);
    if (!iso) {
      onApprove();
      return;
    }

    const updated: TransitionProposal = {
      ...proposal,
      payload: {
        ...proposal.payload,
        timestampISO: iso,
      },
    } as TransitionProposal;

    onApprove(updated);
  };

  const autoPauseTitle =
    'autoPauseTaskTitle' in proposal.payload ? proposal.payload.autoPauseTaskTitle : null;

  return (
    <ProposalCard
      proposal={proposal}
      title={proposal.summary}
      icon={getIcon()}
      onApprove={handleApprove}
      onReject={onReject}
      onEdit={() => setIsEditing(!isEditing)}
      isSubmitting={isSubmitting}
    >
      <div className="flex flex-col gap-3">
        {/* Auto pause warning if starting while another task is running */}
        {autoPauseTitle && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              Task <strong>"{autoPauseTitle}"</strong> is currently running and will be paused at
              this time.
            </span>
          </div>
        )}

        {/* Resolved Timestamp Box */}
        <div className="p-3 bg-[#000000] rounded-xl border border-[#1a1a1a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-text-muted">
                Action Timestamp
              </span>
              {!isEditing ? (
                <span className="text-sm font-bold text-text font-mono">
                  {proposal.payload.timeDisplay || localTime.replace('T', ' ')}
                </span>
              ) : (
                <input
                  type="datetime-local"
                  value={localTime}
                  onChange={(e) => setLocalTime(e.target.value)}
                  className="bg-surface text-text border border-[#1a1a1a] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-teal-500 mt-1"
                />
              )}
            </div>
          </div>

          {proposal.status === 'pending' && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-semibold text-text hover:text-text"
            >
              {isEditing ? 'Done' : 'Change Time'}
            </button>
          )}
        </div>
      </div>
    </ProposalCard>
  );
}
