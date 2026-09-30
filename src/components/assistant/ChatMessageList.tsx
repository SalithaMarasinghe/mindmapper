import { useEffect, useRef } from 'react';
import { Bot, Sparkles, Loader2 } from 'lucide-react';
import type { AssistantMessage, AssistantProposal } from '../../types';
import { ChatMessageItem } from './ChatMessageItem';
import { QuickActionChips } from './QuickActionChips';

interface ChatMessageListProps {
  messages: AssistantMessage[];
  isSending: boolean;
  onApproveProposal: (messageId: string, proposal: AssistantProposal) => void;
  onRejectProposal: (messageId: string, proposalId: string) => void;
  submittingProposalId: string | null;
  onSelectPrompt: (prompt: string) => void;
}

export function ChatMessageList({
  messages,
  isSending,
  onApproveProposal,
  onRejectProposal,
  submittingProposalId,
  onSelectPrompt,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  if (messages.length === 0 && !isSending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center mb-4 text-teal-400 shadow-lg shadow-teal-500/5">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          How can I help you today?
        </h2>
        <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
          I can organize your daily task list, start and pause task timers, log work & meeting notes to your journal, or prepare your daily wrap-up.
        </p>

        <div className="w-full bg-[#161b26]/80 border border-[#232a3b] rounded-xl p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Suggested Prompts
          </p>
          <QuickActionChips onSelect={onSelectPrompt} disabled={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          onApproveProposal={(prop) => onApproveProposal(message.id, prop)}
          onRejectProposal={(propId) => onRejectProposal(message.id, propId)}
          submittingProposalId={submittingProposalId}
        />
      ))}

      {isSending && (
        <div className="flex gap-3 max-w-4xl mx-auto w-full">
          <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0 mt-1">
            <Bot className="w-4 h-4 text-teal-400" />
          </div>
          <div className="bg-[#161b26] border border-[#232a3b] text-slate-300 px-4 py-3 rounded-2xl rounded-tl-sm text-sm flex items-center gap-2.5 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span className="text-xs text-slate-400">Thinking & preparing response...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}
