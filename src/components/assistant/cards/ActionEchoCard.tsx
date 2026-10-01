import { useState } from 'react';
import {
  Play,
  Coffee,
  Undo2,
  Clock,
  Check,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Calendar,
  Briefcase,
  Users,
  FileText,
} from 'lucide-react';
import type {
  AssistantProposal,
  StartTaskProposal,
  PauseTaskProposal,
  ResumeTaskProposal,
  PauseAllProposal,
  ResumeLastPausedProposal,
  FinishTaskProposal,
  AttachWorkSummaryProposal,
  CreateWorkEventProposal,
  CreateMeetingEventProposal,
} from '../../../types';
import { useAssistantStore } from '../../../store/assistantStore';
import {
  toLocalInputValue,
  fromLocalInputValue,
  formatTime,
} from '../../../utils/taskTime';

type AutoProposal =
  | StartTaskProposal
  | PauseTaskProposal
  | ResumeTaskProposal
  | PauseAllProposal
  | ResumeLastPausedProposal
  | FinishTaskProposal
  | AttachWorkSummaryProposal
  | CreateWorkEventProposal
  | CreateMeetingEventProposal;

interface ActionEchoCardProps {
  proposal: AssistantProposal;
  messageId: string;
}

export function ActionEchoCard({ proposal, messageId }: ActionEchoCardProps) {
  const { undoAction, updateActionTime } = useAssistantStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isSavingTime, setIsSavingTime] = useState(false);

  const p = proposal as AutoProposal;
  const payload = (p.payload || {}) as Record<string, unknown>;
  const currentTimestampISO =
    typeof payload.timestampISO === 'string' ? payload.timestampISO : undefined;

  const [inputTime, setInputTime] = useState(() =>
    toLocalInputValue(currentTimestampISO)
  );

  const isUndone = proposal.status === 'undone';
  const taskTitle =
    'taskTitle' in payload && typeof payload.taskTitle === 'string'
      ? payload.taskTitle
      : 'title' in payload && typeof payload.title === 'string'
      ? payload.title
      : 'Task';

  let timeDisplay =
    'timeDisplay' in payload && typeof payload.timeDisplay === 'string'
      ? payload.timeDisplay
      : currentTimestampISO
      ? formatTime(currentTimestampISO)
      : '';

  if (!timeDisplay && typeof payload.startTime === 'string') {
    const end = typeof payload.endTime === 'string' ? ` – ${payload.endTime}` : '';
    timeDisplay = `${payload.startTime}${end}`;
  }

  const getActionConfig = () => {
    switch (proposal.type) {
      case 'start_task':
        return {
          icon: <Play className="w-3.5 h-3.5 text-text fill-teal-400/20" />,
          actionLabel: 'Started',
          badgeColor: 'text-text bg-accent/10 border-accent/20',
          sentence: `Started "${taskTitle}"`,
          snippet: null,
        };
      case 'pause_task':
        return {
          icon: <Coffee className="w-3.5 h-3.5 text-amber-400" />,
          actionLabel: 'Paused',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          sentence: `Paused "${taskTitle}"`,
          snippet: null,
        };
      case 'pause_all':
        return {
          icon: <Coffee className="w-3.5 h-3.5 text-amber-400" />,
          actionLabel: 'Break Started',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          sentence: `Paused for a break (${taskTitle})`,
          snippet: null,
        };
      case 'resume_task':
      case 'resume_last_paused':
        return {
          icon: <RotateCcw className="w-3.5 h-3.5 text-text" />,
          actionLabel: 'Resumed',
          badgeColor: 'text-text bg-accent/10 border-accent/20',
          sentence: `Resumed "${taskTitle}"`,
          snippet: null,
        };
      case 'finish_task': {
        const durationStr = typeof payload.trackedDurationDisplay === 'string' ? payload.trackedDurationDisplay : null;
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-text" />,
          actionLabel: 'Completed',
          badgeColor: 'text-text bg-surface-2 border-border',
          sentence: `Completed "${taskTitle}" (Moved to Done)`,
          snippet: durationStr ? `Duration: ${durationStr}` : null,
        };
      }
      case 'attach_work_summary': {
        const summaryStr = typeof payload.summaryMarkdown === 'string' ? payload.summaryMarkdown : '';
        return {
          icon: <FileText className="w-3.5 h-3.5 text-sky-400" />,
          actionLabel: 'Summary Attached',
          badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
          sentence: `Attached Work Summary to "${taskTitle}"`,
          snippet: summaryStr
            ? summaryStr.slice(0, 140) + (summaryStr.length > 140 ? '...' : '')
            : null,
        };
      }
      case 'create_work_event': {
        const descStr = typeof payload.description === 'string' ? payload.description : '';
        return {
          icon: <Briefcase className="w-3.5 h-3.5 text-text" />,
          actionLabel: 'Work Journal Entry',
          badgeColor: 'text-text bg-accent/10 border-accent/20',
          sentence: `Logged to Work Journal: "${taskTitle}"`,
          snippet: descStr
            ? descStr.slice(0, 140) + (descStr.length > 140 ? '...' : '')
            : null,
        };
      }
      case 'create_meeting_event': {
        const discussStr = typeof payload.discussionSummary === 'string' ? payload.discussionSummary : '';
        return {
          icon: <Users className="w-3.5 h-3.5 text-purple-400" />,
          actionLabel: 'Meeting Logged',
          badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          sentence: `Logged Meeting: "${taskTitle}"`,
          snippet: discussStr
            ? discussStr.slice(0, 140) + (discussStr.length > 140 ? '...' : '')
            : null,
        };
      }
      default:
        return {
          icon: <Check className="w-3.5 h-3.5 text-text-muted" />,
          actionLabel: 'Executed',
          badgeColor: 'text-text-muted bg-slate-500/10 border-slate-500/20',
          sentence: proposal.summary,
          snippet: null,
        };
    }
  };

  const config = getActionConfig();

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await undoAction(messageId, proposal);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleSaveTime = async () => {
    const iso = fromLocalInputValue(inputTime);
    if (!iso) return;
    setIsSavingTime(true);
    try {
      await updateActionTime(messageId, proposal.id, iso);
      setIsEditing(false);
    } finally {
      setIsSavingTime(false);
    }
  };

  const hasTimePicker = Boolean(currentTimestampISO);

  return (
    <div
      className={`rounded-xl border transition-all my-2 overflow-hidden shadow-sm ${
        isUndone
          ? 'bg-surface-2 border-border opacity-70'
          : 'bg-surface-2 border-border hover:border-border'
      }`}
    >
      <div className="p-3 sm:p-3.5 flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${
                isUndone
                  ? 'bg-surface/60 border-slate-700/60 text-text-muted'
                  : config.badgeColor
              }`}
            >
              {isUndone ? <Undo2 className="w-3.5 h-3.5" /> : config.icon}
            </span>

            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-semibold truncate ${
                  isUndone ? 'text-text-muted line-through' : 'text-text'
                }`}
              >
                {config.sentence}
              </span>
              {timeDisplay && !isUndone && (
                <span className="text-[11px] font-mono text-text-muted shrink-0">
                  at <strong className="text-slate-200">{timeDisplay}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Right badge / status */}
          <div className="shrink-0 flex items-center gap-1.5">
            {isUndone ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface/80 text-text-muted border border-slate-700/60">
                <Undo2 className="w-2.5 h-2.5" />
                Undone
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-text border border-border">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Auto-Executed
              </span>
            )}
          </div>
        </div>

        {/* Snippet preview if available */}
        {!isUndone && config.snippet && (
          <div className="px-2.5 py-1.5 rounded bg-surface border border-[#161616] text-[11px] text-text-secondary line-clamp-2">
            {config.snippet}
          </div>
        )}

        {/* Action buttons (Undo & Edit Time) - only if not undone */}
        {!isUndone && (
          <div className="flex items-center justify-between pt-1 border-t border-[#111111]/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={isUndoing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition cursor-pointer disabled:opacity-50"
                title="Revert this action and restore previous state"
              >
                {isUndoing ? (
                  <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                ) : (
                  <Undo2 className="w-3 h-3 text-text-muted group-hover:text-rose-400" />
                )}
                <span>Undo</span>
              </button>

              {hasTimePicker && (
                <button
                  type="button"
                  onClick={() => {
                    setInputTime(toLocalInputValue(currentTimestampISO));
                    setIsEditing(!isEditing);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text hover:bg-teal-950/30 border border-transparent hover:border-teal-900/50 transition cursor-pointer"
                  title="Adjust the recorded timestamp"
                >
                  <Clock className="w-3 h-3 text-text-muted" />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit Time'}</span>
                </button>
              )}
            </div>

            <span className="text-[10px] text-text-muted font-medium">
              Instant Sync
            </span>
          </div>
        )}

        {/* Inline Time Editor */}
        {!isUndone && isEditing && hasTimePicker && (
          <div className="mt-1 p-2.5 bg-[#000000] border border-[#111111] rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-3.5 h-3.5 text-text shrink-0" />
              <span className="text-[11px] text-text-muted shrink-0">Adjust to:</span>
              <input
                type="datetime-local"
                value={inputTime}
                onChange={(e) => setInputTime(e.target.value)}
                className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-teal-500 w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 text-xs text-text-muted hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingTime}
                onClick={handleSaveTime}
                className="px-3 py-1 bg-text hover:bg-text/90 text-bg text-slate-900 font-semibold text-xs rounded transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSavingTime ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
