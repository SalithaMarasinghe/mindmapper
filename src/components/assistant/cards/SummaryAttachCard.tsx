import { useState } from 'react';
import { FileText, ArrowRight } from 'lucide-react';
import type { AttachWorkSummaryProposal } from '../../../types';
import { ProposalCard } from './ProposalCard';
import { MarkdownViewer } from '../../common/MarkdownViewer';

interface SummaryAttachCardProps {
  proposal: AttachWorkSummaryProposal;
  onApprove: (updatedProposal?: AttachWorkSummaryProposal) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function SummaryAttachCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: SummaryAttachCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [summaryMarkdown, setSummaryMarkdown] = useState(
    proposal.payload.summaryMarkdown
  );

  const handleApprove = () => {
    const updated: AttachWorkSummaryProposal = {
      ...proposal,
      payload: {
        ...proposal.payload,
        summaryMarkdown,
      },
    };
    onApprove(updated);
  };

  return (
    <ProposalCard
      proposal={proposal}
      title={proposal.summary}
      icon={<FileText className="w-4 h-4 text-teal-400" />}
      onApprove={handleApprove}
      onReject={onReject}
      onEdit={() => setIsEditing(!isEditing)}
      isSubmitting={isSubmitting}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <span>Attach summary to target task:</span>
          <strong className="text-teal-300 font-semibold">{proposal.payload.taskTitle}</strong>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
        </div>

        {!isEditing ? (
          <div className="p-3 bg-[#0f1117] rounded-xl border border-[#2d3748] max-h-56 overflow-y-auto">
            <MarkdownViewer content={summaryMarkdown} className="text-xs" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#1e2638]">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">
                Edit Work Summary (Markdown)
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Close Editor
              </button>
            </div>
            <textarea
              rows={6}
              value={summaryMarkdown}
              onChange={(e) => setSummaryMarkdown(e.target.value)}
              className="bg-[#141a24] text-slate-100 border border-teal-700/60 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-teal-500 leading-relaxed resize-y"
            />
          </div>
        )}
      </div>
    </ProposalCard>
  );
}
