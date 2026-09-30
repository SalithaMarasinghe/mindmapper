import type { ReactNode } from 'react';
import { Check, X, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BaseProposal } from '../../../types';

interface ProposalCardProps {
  proposal: BaseProposal;
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
  isSubmitting?: boolean;
}

export function ProposalCard({
  proposal,
  icon,
  title,
  children,
  onApprove,
  onReject,
  onEdit,
  isSubmitting,
}: ProposalCardProps) {
  const isPending = proposal.status === 'pending';
  const isApproved = proposal.status === 'approved';
  const isRejected = proposal.status === 'rejected';
  const isFailed = proposal.status === 'failed';

  return (
    <div
      className={`rounded-xl border transition-all my-3 overflow-hidden shadow-md ${
        isApproved
          ? 'bg-[#121c18] border-emerald-800/60 ring-1 ring-emerald-500/20'
          : isRejected
          ? 'bg-[#1e1e24] border-slate-700/60 opacity-60'
          : isFailed
          ? 'bg-[#221417] border-rose-800/80 ring-1 ring-rose-500/30'
          : 'bg-[#1a2130] border-teal-700/50 hover:border-teal-600/80'
      }`}
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141a26] border-b border-[#2d3748]/80 text-xs">
        <div className="flex items-center gap-2">
          {icon && <span className="p-1 rounded bg-[#1e2433] text-teal-400">{icon}</span>}
          <span className="font-bold text-slate-100 tracking-wide">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {isApproved && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          )}

          {isRejected && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
              <X className="w-3 h-3" />
              Rejected
            </span>
          )}

          {isFailed && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-800">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}

          {isPending && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-700/70">
              <AlertTriangle className="w-3 h-3" />
              Requires Approval
            </span>
          )}
        </div>
      </div>

      {/* Proposal Body */}
      <div className="p-4 text-xs text-slate-300 flex flex-col gap-3">{children}</div>

      {/* Failure Error Message */}
      {isFailed && proposal.error && (
        <div className="mx-4 mb-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{proposal.error}</span>
        </div>
      )}

      {/* Actions Bar (Only visible while pending or failed for retry) */}
      {(isPending || isFailed) && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-[#121622] border-t border-[#2d3748]/60">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onReject}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#1e2433] transition disabled:opacity-50"
          >
            Reject
          </button>

          {onEdit && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onEdit}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-400 hover:text-teal-300 hover:bg-teal-950/40 transition disabled:opacity-50"
            >
              Edit
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onApprove}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-sm active:scale-95 transition disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Executing...' : 'Approve & Execute'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
