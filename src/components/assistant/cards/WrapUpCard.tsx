import { useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, Clock, Calendar, CheckSquare, Square } from 'lucide-react';
import type { DailyWrapUpProposal, CarryOverTasksProposal } from '../../../types';
import { ProposalCard } from './ProposalCard';
import { formatDuration } from '../../../utils/taskTime';
import { useTaskStore } from '../../../store/taskStore';

type WrapUpOrCarryover = DailyWrapUpProposal | CarryOverTasksProposal;

interface WrapUpCardProps {
  proposal: WrapUpOrCarryover;
  onApprove: (updatedProposal?: WrapUpOrCarryover) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function WrapUpCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: WrapUpCardProps) {
  const isCarryoverOnly = proposal.type === 'carry_over_tasks';
  const tasksInStore = useTaskStore((state) => state.tasks);
  const [isEditing, setIsEditing] = useState(false);

  // ── State for carry_over_tasks ──────────────────────────────────────────────
  const carryoverPayload = isCarryoverOnly ? (proposal as CarryOverTasksProposal).payload : null;
  const initialTaskIds = carryoverPayload?.taskIds || [];
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(initialTaskIds);
  const [carryoverTargetDate, setCarryoverTargetDate] = useState<string>(
    carryoverPayload?.targetDate || ''
  );

  // ── State for daily_wrap_up ────────────────────────────────────────────────
  const wrapUpPayload = !isCarryoverOnly ? (proposal as DailyWrapUpProposal).payload : null;
  const initialWrapUpTaskIds = wrapUpPayload?.carryoverTaskIds || [];
  const [selectedWrapUpTaskIds, setSelectedWrapUpTaskIds] = useState<string[]>(initialWrapUpTaskIds);
  const [wrapUpTargetDate, setWrapUpTargetDate] = useState<string>(
    wrapUpPayload?.targetCarryoverDate || ''
  );
  const [narrative, setNarrative] = useState<string>(
    wrapUpPayload?.summaryNarrative || ''
  );

  // Helper to resolve task title
  const getTaskTitle = (id: string, fallbackTitles?: string[], idx?: number) => {
    const storeTask = tasksInStore.find((t) => t.id === id);
    if (storeTask) return storeTask.title;
    if (fallbackTitles && idx !== undefined && fallbackTitles[idx]) {
      return fallbackTitles[idx];
    }
    return `Task ${id.slice(0, 8)}`;
  };

  const toggleTaskId = (id: string) => {
    if (isCarryoverOnly) {
      setSelectedTaskIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setSelectedWrapUpTaskIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
  };

  // ── Carryover Only Card ─────────────────────────────────────────────────────
  if (isCarryoverOnly) {
    const handleApproveCarryover = () => {
      const updated: CarryOverTasksProposal = {
        ...(proposal as CarryOverTasksProposal),
        payload: {
          ...(proposal as CarryOverTasksProposal).payload,
          taskIds: selectedTaskIds,
          targetDate: carryoverTargetDate,
        },
      };
      onApprove(updated);
    };

    return (
      <ProposalCard
        proposal={proposal}
        title={proposal.summary}
        icon={<Calendar className="w-4 h-4 text-amber-400" />}
        onApprove={handleApproveCarryover}
        onReject={onReject}
        onEdit={() => setIsEditing(!isEditing)}
        isSubmitting={isSubmitting}
      >
        <div className="flex flex-col gap-2.5">
          {!isEditing ? (
            <>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>
                    Move <strong>{selectedTaskIds.length}</strong> tasks to target date
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px] text-amber-300">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>{carryoverTargetDate}</span>
                </div>
              </div>

              {selectedTaskIds.length > 0 ? (
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
                  {selectedTaskIds.map((id, i) => (
                    <li key={id}>{getTaskTitle(id, carryoverPayload?.taskTitles, i)}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-500 italic">No tasks selected for carryover.</div>
              )}
            </>
          ) : (
            /* Edit Mode */
            <div className="flex flex-col gap-3 p-3 bg-[#000000] rounded-xl border border-amber-800/40 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-[#111111]">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Edit Carryover Tasks & Date
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close Edit
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase">
                  Target Date
                </label>
                <input
                  type="date"
                  value={carryoverTargetDate}
                  onChange={(e) => setCarryoverTargetDate(e.target.value)}
                  className="bg-[#080808] text-slate-100 border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-mono text-xs w-full sm:w-48"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-semibold uppercase">
                  Select Tasks to Roll Over ({selectedTaskIds.length} selected)
                </label>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {initialTaskIds.map((id, i) => {
                    const isChecked = selectedTaskIds.includes(id);
                    const title = getTaskTitle(id, carryoverPayload?.taskTitles, i);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => toggleTaskId(id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                          isChecked
                            ? 'bg-amber-950/30 border-amber-800/50 text-slate-200'
                            : 'bg-[#080808] border-[#161616] text-slate-400 opacity-60'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className="text-xs truncate">{title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </ProposalCard>
    );
  }

  // ── Full Daily Wrap-Up Card ─────────────────────────────────────────────────
  const {
    completedTasksCount,
    totalTrackedSeconds,
    proposedJournalEvents,
  } = (proposal as DailyWrapUpProposal).payload;

  const handleApproveWrapUp = () => {
    const updated: DailyWrapUpProposal = {
      ...(proposal as DailyWrapUpProposal),
      payload: {
        ...(proposal as DailyWrapUpProposal).payload,
        summaryNarrative: narrative,
        carryoverTaskIds: selectedWrapUpTaskIds,
        targetCarryoverDate: wrapUpTargetDate,
      },
    };
    onApprove(updated);
  };

  return (
    <ProposalCard
      proposal={proposal}
      title={proposal.summary}
      icon={<Sparkles className="w-4 h-4 text-purple-400" />}
      onApprove={handleApproveWrapUp}
      onReject={onReject}
      onEdit={() => setIsEditing(!isEditing)}
      isSubmitting={isSubmitting}
    >
      <div className="flex flex-col gap-3">
        {/* Metric Badges */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-[#000000] rounded-lg border border-[#1a1a1a] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-bold">
                Completed
              </span>
              <span className="font-bold text-slate-200">{completedTasksCount} tasks</span>
            </div>
          </div>

          <div className="p-2.5 bg-[#000000] rounded-lg border border-[#1a1a1a] flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-bold">
                Tracked Effort
              </span>
              <span className="font-bold text-teal-300 font-mono">
                {formatDuration(totalTrackedSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Narrative & Carryover in View Mode */}
        {!isEditing ? (
          <>
            {/* Narrative Summary */}
            {narrative && (
              <div className="p-3 bg-[#000000] rounded-xl border border-[#1a1a1a] text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {narrative}
              </div>
            )}

            {/* Carryover notice */}
            {selectedWrapUpTaskIds.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>
                      Carry over <strong>{selectedWrapUpTaskIds.length}</strong> unfinished tasks
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-amber-300">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>{wrapUpTargetDate}</span>
                  </div>
                </div>

                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-300 mt-1">
                  {selectedWrapUpTaskIds.map((id) => (
                    <li key={id}>{getTaskTitle(id)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          /* Edit Mode Form */
          <div className="flex flex-col gap-3 p-3 bg-[#000000] rounded-xl border border-purple-800/40 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-[#111111]">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                Edit Wrap-Up Summary & Tasks
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close Edit
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase">
                Summary Narrative
              </label>
              <textarea
                rows={3}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                className="bg-[#080808] text-slate-100 border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 resize-none text-xs leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase">
                Target Carryover Date
              </label>
              <input
                type="date"
                value={wrapUpTargetDate}
                onChange={(e) => setWrapUpTargetDate(e.target.value)}
                className="bg-[#080808] text-slate-100 border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono text-xs w-full sm:w-48"
              />
            </div>

            {initialWrapUpTaskIds.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-semibold uppercase">
                  Select Tasks to Carry Over ({selectedWrapUpTaskIds.length} selected)
                </label>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                  {initialWrapUpTaskIds.map((id) => {
                    const isChecked = selectedWrapUpTaskIds.includes(id);
                    const title = getTaskTitle(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => toggleTaskId(id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                          isChecked
                            ? 'bg-purple-950/30 border-purple-800/50 text-slate-200'
                            : 'bg-[#080808] border-[#161616] text-slate-400 opacity-60'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className="text-xs truncate">{title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Proposed Journal blocks */}
        {proposedJournalEvents && proposedJournalEvents.length > 0 && (
          <div className="text-xs text-slate-400 flex flex-col gap-1">
            <span className="font-semibold text-slate-300">
              Generate {proposedJournalEvents.length} Work Journal blocks from your time segments:
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              {proposedJournalEvents.map((ev, i) => (
                <li key={i}>
                  <strong>{ev.title}</strong> ({ev.startTime} – {ev.endTime})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ProposalCard>
  );
}
