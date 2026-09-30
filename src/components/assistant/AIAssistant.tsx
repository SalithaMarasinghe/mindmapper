import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Play,
  Loader2,
} from 'lucide-react';
import { useAssistantStore } from '../../store/assistantStore';
import { useTaskStore } from '../../store/taskStore';
import { ChatMessageList } from './ChatMessageList';
import { ChatInputBar } from './ChatInputBar';
import type { AssistantProposal } from '../../types';

export function AIAssistant() {
  const {
    conversations,
    currentConversationId,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    fetchConversations,
    selectConversation,
    startNewConversation,
    sendMessage,
    executeProposal,
    rejectProposal,
    deleteConversation,
  } = useAssistantStore();

  const { tasks } = useTaskStore();
  const runningTask = tasks.find((t) => t.status === 'in_progress' && !t.isPaused);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submittingProposalId, setSubmittingProposalId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleApproveProposal = async (messageId: string, proposal: AssistantProposal) => {
    setSubmittingProposalId(proposal.id);
    try {
      await executeProposal(messageId, proposal);
    } finally {
      setSubmittingProposalId(null);
    }
  };

  const handleRejectProposal = async (messageId: string, proposalId: string) => {
    await rejectProposal(messageId, proposalId);
  };

  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#0a0d14]">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64 sm:w-72' : 'w-0'
        } transition-all duration-300 ease-in-out border-r border-[#1e2433] bg-[#0d1017] flex flex-col shrink-0 overflow-hidden z-20`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-[#1e2433] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Conversations
            </span>
          </div>
          <button
            type="button"
            onClick={startNewConversation}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 text-xs font-medium transition cursor-pointer"
            title="Start new conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingConversations && conversations.length === 0 ? (
            <div className="flex items-center justify-center p-6 text-slate-500 text-xs gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading history...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-slate-500 leading-relaxed">
              No conversations yet. Start one by asking a question or giving a command!
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              const dateStr = new Date(conv.updatedAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-teal-500/15 border border-teal-500/30 text-teal-300 font-medium'
                      : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-400'
                      }`}
                    />
                    <div className="truncate flex-1">
                      <p className="truncate font-medium">{conv.title}</p>
                      <p className="text-[10px] text-slate-500 font-normal">{dateStr}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this conversation?')) {
                        deleteConversation(conv.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0 cursor-pointer"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1017]/50 relative">
        {/* Chat Header */}
        <header className="h-12 border-b border-[#1e2433] bg-[#0d1017]/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>

            <div className="min-w-0 flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100 truncate">
                {currentConversation ? currentConversation.title : 'AI Assistant'}
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                Propose & Confirm
              </span>
            </div>
          </div>

          {/* Running Task Status Badge */}
          {runningTask && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-xs text-teal-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              </span>
              <Play className="w-3 h-3 fill-current text-teal-400" />
              <span className="truncate max-w-[150px] font-medium">{runningTask.title}</span>
            </div>
          )}
        </header>

        {/* Chat Messages */}
        {isLoadingMessages ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            <span>Loading messages...</span>
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isSending={isSending}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            submittingProposalId={submittingProposalId}
            onSelectPrompt={(prompt) => setInputText(prompt)}
          />
        )}

        {/* Input Bar */}
        <ChatInputBar
          text={inputText}
          setText={setInputText}
          onSendMessage={(text) => sendMessage(text)}
          disabled={isSending}
        />
      </main>
    </div>
  );
}
