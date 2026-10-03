import { useState } from 'react';
import { Bot, User, Copy, Check } from 'lucide-react';
import type { AssistantMessage, AssistantProposal } from '../../types';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { TaskProposalCard } from './cards/TaskProposalCard';
import { TransitionCard } from './cards/TransitionCard';
import { ActionEchoCard } from './cards/ActionEchoCard';
import { WorkJournalCard } from './cards/WorkJournalCard';
import { SummaryAttachCard } from './cards/SummaryAttachCard';
import { WrapUpCard } from './cards/WrapUpCard';
import { CreateProjectCard } from './cards/CreateProjectCard';

interface ChatMessageItemProps {
  message: AssistantMessage;
  onApproveProposal: (proposal: AssistantProposal) => void;
  onRejectProposal: (proposalId: string) => void;
  submittingProposalId: string | null;
}

export function ChatMessageItem({
  message,
  onApproveProposal,
  onRejectProposal,
  submittingProposalId,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const timeFormatted = new Date(message.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = message.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 max-w-4xl mx-auto w-full group">
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%]">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-[11px] text-slate-500">{timeFormatted}</span>
            <span className="text-xs font-medium text-slate-300">You</span>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] text-slate-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
            {message.content}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#141414]/60 border border-slate-600 flex items-center justify-center shrink-0 mt-5">
          <User className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3 max-w-4xl mx-auto w-full group">
      <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0 mt-5 shadow-sm">
        <Bot className="w-4 h-4 text-teal-400" />
      </div>

      <div className="flex flex-col max-w-[90%] sm:max-w-[85%] flex-1">
        <div className="flex items-center justify-between mb-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-teal-400">Assistant</span>
            <span className="text-[11px] text-slate-500">{timeFormatted}</span>
          </div>
          {message.content && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-teal-300 transition-colors py-0.5 px-1.5 rounded hover:bg-white/5 cursor-pointer"
              title="Copy answer"
              aria-label="Copy answer to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Text bubble */}
        {message.content && (
          <div className="bg-[#0a0a0a] border border-[#161616] text-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm shadow-sm relative group/bubble">
            <MarkdownViewer content={message.content} />
            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-end">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-teal-300 transition-colors py-0.5 px-2 rounded hover:bg-white/5 cursor-pointer"
                title="Copy answer"
                aria-label="Copy answer to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied answer</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy answer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Proposals list */}
        {message.proposals && message.proposals.length > 0 && (
          <div className="flex flex-col gap-3 mt-3">
            {message.proposals.map((proposal) => {
              const isSubmitting = submittingProposalId === proposal.id;

              // Tier 1 auto-executed or undone proposals render as compact ActionEchoCard
              if (proposal.status === 'auto_executed' || proposal.status === 'undone') {
                return (
                  <ActionEchoCard
                    key={proposal.id}
                    proposal={proposal}
                    messageId={message.id}
                  />
                );
              }

              switch (proposal.type) {
                case 'create_tasks':
                  return (
                    <TaskProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onApprove={(updated) => onApproveProposal(updated || proposal)}
                      onReject={() => onRejectProposal(proposal.id)}
                      isSubmitting={isSubmitting}
                    />
                  );

                case 'start_task':
                case 'pause_task':
                case 'resume_task':
                case 'finish_task':
                case 'pause_all':
                case 'resume_last_paused':
                  return (
                    <TransitionCard
                      key={proposal.id}
                      proposal={proposal}
                      onApprove={(updated) => onApproveProposal(updated || proposal)}
                      onReject={() => onRejectProposal(proposal.id)}
                      isSubmitting={isSubmitting}
                    />
                  );

                case 'create_work_event':
                case 'create_meeting_event':
                case 'update_meeting_event':
                  return (
                    <WorkJournalCard
                      key={proposal.id}
                      proposal={proposal}
                      onApprove={(updated) => onApproveProposal(updated || proposal)}
                      onReject={() => onRejectProposal(proposal.id)}
                      isSubmitting={isSubmitting}
                    />
                  );

                case 'attach_work_summary':
                  return (
                    <SummaryAttachCard
                      key={proposal.id}
                      proposal={proposal}
                      onApprove={(updated) => onApproveProposal(updated || proposal)}
                      onReject={() => onRejectProposal(proposal.id)}
                      isSubmitting={isSubmitting}
                    />
                  );

                case 'create_project':
                  return (
                    <CreateProjectCard
                      key={proposal.id}
                      proposal={proposal}
                      onApprove={(updated) => onApproveProposal(updated || proposal)}
                      onReject={() => onRejectProposal(proposal.id)}
                      isSubmitting={isSubmitting}
                    />
                  );

                case 'daily_wrap_up':
                case 'carry_over_tasks':
                  return (
                    <WrapUpCard
                      key={proposal.id}
                      proposal={proposal}
                      onApprove={(updated) => onApproveProposal(updated || proposal)}
                      onReject={() => onRejectProposal(proposal.id)}
                      isSubmitting={isSubmitting}
                    />
                  );

                default:
                  return null;
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
