import { useState, useMemo } from 'react';
import {
  Calendar,
  Users,
  Clock,
  Tag,
  CheckSquare,
  Sparkles,
  FileText,
  Briefcase,
  User,
  Link2,
  Video,
  ExternalLink,
} from 'lucide-react';
import type {
  CreateWorkEventProposal,
  CreateMeetingEventProposal,
  UpdateMeetingEventProposal,
  TaskItem,
  MeetingActionItem,
} from '../../../types';
import { ProposalCard } from './ProposalCard';
import { MarkdownViewer } from '../../common/MarkdownViewer';
import { useTimelineStore } from '../../../store/timelineStore';

type JournalProposal = CreateWorkEventProposal | CreateMeetingEventProposal | UpdateMeetingEventProposal;

interface WorkJournalCardProps {
  proposal: JournalProposal;
  onApprove: (updatedProposal?: JournalProposal) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function WorkJournalCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: WorkJournalCardProps) {
  const isUpdateMeeting = proposal.type === 'update_meeting_event';
  const isMeeting = proposal.type === 'create_meeting_event' || isUpdateMeeting;

  // Candidate events for disambiguation
  const updatePayload = isUpdateMeeting ? (proposal as UpdateMeetingEventProposal).payload : null;
  const candidateEvents = updatePayload?.candidateEvents || [];
  const [selectedEventId, setSelectedEventId] = useState(updatePayload?.targetEventId || '');

  const selectedCandidate = useMemo(() => {
    if (!isUpdateMeeting) return null;
    return candidateEvents.find((c) => c.id === selectedEventId) || candidateEvents[0] || null;
  }, [isUpdateMeeting, candidateEvents, selectedEventId]);

  const [isEditing, setIsEditing] = useState(false);

  // Common editable state
  const initialTitle = proposal.payload.title || selectedCandidate?.title || '';
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(
    ('date' in proposal.payload ? proposal.payload.date : null) ||
      selectedCandidate?.date ||
      new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(
    ('startTime' in proposal.payload ? proposal.payload.startTime : null) ||
      selectedCandidate?.startTime ||
      ''
  );
  const [endTime, setEndTime] = useState(
    ('endTime' in proposal.payload ? proposal.payload.endTime : null) ||
      selectedCandidate?.endTime ||
      ''
  );
  const [projectTag, setProjectTag] = useState(
    ('projectTag' in proposal.payload ? proposal.payload.projectTag : null) ||
      selectedCandidate?.projectTag ||
      ''
  );

  const handleSelectCandidate = (candId: string) => {
    setSelectedEventId(candId);
    const cand = candidateEvents.find((c) => c.id === candId);
    if (cand) {
      if (cand.title) setTitle(cand.title);
      if (cand.date) setDate(cand.date);
      if (cand.startTime) setStartTime(cand.startTime || '');
      if (cand.endTime) setEndTime(cand.endTime || '');
      if (cand.projectTag) setProjectTag(cand.projectTag);
    }
  };

  // Lineage / Chaining state
  const eventsByDate = useTimelineStore((state) => state.eventsByDate);
  const availableEvents = useMemo(() => {
    return Object.values(eventsByDate)
      .flat()
      .filter((ev) => ev.id !== (proposal.payload as { id?: string }).id)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.startTime || '').localeCompare(a.startTime || '');
      });
  }, [eventsByDate, proposal]);

  const [previousEventId, setPreviousEventId] = useState<string | null>(
    (proposal.payload as { previousEventId?: string | null }).previousEventId ?? null
  );
  const [previousEventTitle, setPreviousEventTitle] = useState<string | null>(
    (proposal.payload as { previousEventTitle?: string | null }).previousEventTitle ?? null
  );

  const resolvedPreviousTitle = useMemo(() => {
    if (previousEventTitle) return previousEventTitle;
    if (!previousEventId) return null;
    const found = availableEvents.find((e) => e.id === previousEventId);
    return found ? found.title : null;
  }, [previousEventTitle, previousEventId, availableEvents]);

  // Meeting specific editable state
  const meetingPayload = isMeeting
    ? (proposal as CreateMeetingEventProposal | UpdateMeetingEventProposal).payload
    : null;
  const [discussionSummary, setDiscussionSummary] = useState(
    meetingPayload?.discussionSummary || ''
  );
  const [decisions, setDecisions] = useState(meetingPayload?.decisions || '');
  const [actionItemsText, setActionItemsText] = useState(() =>
    meetingPayload?.tasksAssigned?.map((t) => t.text).join('\n') || ''
  );
  const [addTasksToKanban, setAddTasksToKanban] = useState(
    meetingPayload?.addTasksToKanban ?? true
  );

  const rawActionItems: MeetingActionItem[] =
    meetingPayload?.actionItems && meetingPayload.actionItems.length > 0
      ? meetingPayload.actionItems
      : (meetingPayload?.tasksAssigned || []).map((t) => {
          const text = t.text;
          const isSalitha = /salitha|you|trainee/i.test(text);
          const matchOther = text.match(/^\[(.*?)\]/);
          const assignee = isSalitha ? 'Salitha Marasinghe' : matchOther ? matchOther[1] : undefined;
          return {
            text,
            assignee,
            isForUser: isSalitha || !matchOther,
            deadlineDate: ('date' in (meetingPayload || {})) ? (meetingPayload as any).date : date,
            done: false,
          };
        });

  const salithaTasksCount = rawActionItems.filter((i) => i.isForUser !== false).length;

  // Work specific editable state
  const workPayload = !isMeeting ? (proposal as CreateWorkEventProposal).payload : null;
  const isLinkedToTask = !isMeeting && !!(workPayload?.linkedTaskId || workPayload?.sourceTaskId);
  const [description, setDescription] = useState(workPayload?.description || '');
  const [implementationNotes, setImplementationNotes] = useState(
    workPayload?.implementationNotes || ''
  );
  const [syncToTaskLog, setSyncToTaskLog] = useState(
    workPayload?.syncToTaskLog ?? isLinkedToTask
  );

  const handleApprove = () => {
    if (isUpdateMeeting) {
      const assignedTasks: TaskItem[] = actionItemsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text, done: false }));

      const updatedActionItems: MeetingActionItem[] = assignedTasks.map((t) => {
        const existing = rawActionItems.find((a) => a.text === t.text);
        if (existing) return existing;

        const text = t.text;
        const isSalitha = /salitha|you|trainee/i.test(text);
        const matchOther = text.match(/^\[(.*?)\]/);
        const assignee = isSalitha ? 'Salitha Marasinghe' : matchOther ? matchOther[1] : undefined;
        return {
          text,
          assignee,
          isForUser: isSalitha || !matchOther,
          deadlineDate: date,
          done: false,
        };
      });

      const updateProp = proposal as UpdateMeetingEventProposal;
      const updated: UpdateMeetingEventProposal = {
        ...updateProp,
        payload: {
          ...updateProp.payload,
          targetEventId: selectedEventId || updateProp.payload.targetEventId,
          title: title || selectedCandidate?.title || updateProp.payload.title,
          discussionSummary,
          decisions,
          tasksAssigned: assignedTasks,
          actionItems: updatedActionItems,
          addTasksToKanban,
        },
      };
      onApprove(updated);
      return;
    }

    if (isMeeting) {
      const assignedTasks: TaskItem[] = actionItemsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text, done: false }));

      const updatedActionItems: MeetingActionItem[] = assignedTasks.map((t) => {
        const existing = rawActionItems.find((a) => a.text === t.text);
        if (existing) return existing;

        const text = t.text;
        const isSalitha = /salitha|you|trainee/i.test(text);
        const matchOther = text.match(/^\[(.*?)\]/);
        const assignee = isSalitha ? 'Salitha Marasinghe' : matchOther ? matchOther[1] : undefined;
        return {
          text,
          assignee,
          isForUser: isSalitha || !matchOther,
          deadlineDate: date,
          done: false,
        };
      });

      const updated: CreateMeetingEventProposal = {
        ...(proposal as CreateMeetingEventProposal),
        payload: {
          ...(proposal as CreateMeetingEventProposal).payload,
          title,
          date,
          startTime: startTime || null,
          endTime: endTime || null,
          projectTag: projectTag.trim() || null,
          discussionSummary,
          decisions,
          tasksAssigned: assignedTasks,
          actionItems: updatedActionItems,
          addTasksToKanban,
          links: meetingPayload?.links,
          meetingUrl: meetingPayload?.meetingUrl,
          previousEventId: previousEventId || null,
          previousEventTitle: resolvedPreviousTitle || null,
        },
      };
      onApprove(updated);
    } else {
      const updated: CreateWorkEventProposal = {
        ...(proposal as CreateWorkEventProposal),
        payload: {
          ...(proposal as CreateWorkEventProposal).payload,
          title,
          date,
          startTime: startTime || null,
          endTime: endTime || null,
          projectTag: projectTag.trim() || null,
          description,
          implementationNotes,
          syncToTaskLog,
          previousEventId: previousEventId || null,
          previousEventTitle: resolvedPreviousTitle || null,
        },
      };
      onApprove(updated);
    }
  };

  return (
    <ProposalCard
      proposal={proposal}
      title={
        isUpdateMeeting
          ? 'Update Meeting Entry (Zero Duplicates)'
          : isMeeting
          ? 'Proposed Meeting Entry'
          : 'Proposed Work Journal Entry'
      }
      approveLabel={isUpdateMeeting ? 'Approve & Update Entry' : undefined}
      icon={
        isMeeting ? (
          <Users className="w-4 h-4 text-purple-400" />
        ) : (
          <Briefcase className="w-4 h-4 text-text" />
        )
      }
      onApprove={handleApprove}
      onReject={onReject}
      onEdit={() => setIsEditing(!isEditing)}
      isSubmitting={isSubmitting}
    >
      <div className="flex flex-col gap-2.5">
        {/* Candidate Disambiguation Selector if multiple candidate meetings exist */}
        {isUpdateMeeting && candidateEvents.length > 1 && (
          <div className="p-3 bg-purple-950/20 rounded-xl border border-purple-800/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                Select Which Meeting to Update:
              </div>
              <span className="text-[10px] text-purple-400 font-mono px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/50">
                {candidateEvents.length} candidates found
              </span>
            </div>
            <p className="text-[11px] text-text-muted">
              Jarvis detected multiple recent meetings on your schedule. Choose which entry to populate with these notes:
            </p>
            <div className="space-y-1.5 mt-1">
              {candidateEvents.map((c) => {
                const isSelected = selectedEventId === c.id;
                return (
                  <label
                    key={c.id}
                    onClick={() => handleSelectCandidate(c.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-purple-900/40 border-purple-500 ring-1 ring-purple-500/50 text-purple-200'
                        : 'bg-[#000000] border-[#1a1a1a] text-text-secondary hover:border-[#333]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="candidateMeeting"
                        checked={isSelected}
                        onChange={() => handleSelectCandidate(c.id)}
                        className="rounded-full bg-surface-2 border-[#333] text-purple-600 focus:ring-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs text-text truncate">{c.title}</span>
                        <span className="text-[10px] text-text-muted">{c.date}</span>
                      </div>
                    </div>
                    {(c.startTime || c.endTime) && (
                      <span className="text-[11px] font-mono font-medium text-purple-300 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 shrink-0">
                        {c.startTime || '??'} – {c.endTime || '??'}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* In-Place Target Banner if single candidate or direct update */}
        {isUpdateMeeting && candidateEvents.length <= 1 && (
          <div className="flex items-center justify-between px-3 py-2 bg-purple-950/30 rounded-lg border border-purple-800/40 text-xs">
            <div className="flex items-center gap-2 text-purple-300">
              <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>
                Target Meeting: <strong className="text-bg">{title || selectedCandidate?.title || 'Existing Meeting Entry'}</strong>
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60">
              In-Place Update
            </span>
          </div>
        )}

        {/* View Mode */}
        {!isEditing ? (
          <div className="p-3.5 bg-[#000000] rounded-xl border border-[#161616] flex flex-col gap-2.5">
            {/* Header / Type & Title */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      isUpdateMeeting
                        ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                        : isMeeting
                        ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                        : 'bg-teal-950/60 text-text border-teal-800/60'
                    }`}
                  >
                    {isUpdateMeeting ? 'Update Meeting Log' : isMeeting ? 'Meeting Log' : 'Work Log'}
                  </span>
                  {projectTag && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-text-secondary border border-[#1a1a1a]">
                      <Tag className="w-3 h-3 text-text" />
                      {projectTag}
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-sm text-text">{title}</h4>
                {isMeeting && 'attendees' in (meetingPayload || {}) && (meetingPayload as any)?.attendees && (meetingPayload as any).attendees.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-muted">
                    <Users className="w-3 h-3 text-purple-400 shrink-0" />
                    <span>Attendees: {(meetingPayload as any).attendees.join(', ')}</span>
                  </div>
                )}
                {isMeeting && (meetingPayload?.meetingUrl || (meetingPayload?.links && meetingPayload.links.length > 0)) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <a
                      href={meetingPayload.meetingUrl || meetingPayload.links?.[0]?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-600/50 hover:border-emerald-500 text-text hover:text-bg text-xs font-medium transition group"
                    >
                      <Video className="w-3.5 h-3.5 text-text group-hover:animate-pulse" />
                      <span>Direct Join Link</span>
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    </a>
                  </div>
                )}
                {isLinkedToTask && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text">
                    <span className="px-1.5 py-0.5 rounded bg-teal-950/60 border border-teal-800/60 font-semibold">
                      Linked Task
                    </span>
                    <span className="text-text-muted">
                      {syncToTaskLog
                        ? '• Will update Task Log description on approval'
                        : '• Work Journal only'}
                    </span>
                  </div>
                )}
                {previousEventId && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 border border-teal-800/60 font-semibold">
                      <Link2 className="w-3 h-3 text-text" />
                      Chained from
                    </span>
                    <span className="text-text-secondary font-medium truncate max-w-xs sm:max-w-md">
                      {resolvedPreviousTitle || 'Predecessor Event'}
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Time pill */}
              <div className="flex flex-col items-end shrink-0 text-xs font-mono text-text-muted">
                <span className="flex items-center gap-1 text-text-secondary font-medium">
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                  {date}
                </span>
                {(startTime || endTime) && (
                  <span className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Clock className="w-3 h-3 text-text-muted" />
                    {startTime || '??'} – {endTime || '??'}
                  </span>
                )}
              </div>
            </div>

            {/* Meeting View */}
            {isMeeting && (
              <div className="flex flex-col gap-2.5 mt-1 text-xs">
                {discussionSummary && (
                  <div className="bg-surface-2 p-3 rounded-lg border border-[#111111]">
                    <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <FileText className="w-3 h-3 text-purple-400" />
                      Discussion Summary
                    </div>
                    <MarkdownViewer content={discussionSummary} className="text-xs" />
                  </div>
                )}

                {decisions && (
                  <div className="bg-emerald-950/25 p-3 rounded-lg border border-emerald-800/40 text-emerald-200">
                    <div className="flex items-center gap-1.5 text-text text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <Sparkles className="w-3 h-3 text-text" />
                      Key Decisions
                    </div>
                    <MarkdownViewer content={decisions} className="text-xs text-emerald-200" />
                  </div>
                )}

                {actionItemsText && (
                  <div className="bg-surface-2 p-3 rounded-lg border border-[#111111]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-bold uppercase tracking-wider">
                        <CheckSquare className="w-3 h-3 text-text" />
                        Action Items ({rawActionItems.length})
                      </div>
                      {salithaTasksCount > 0 && (
                        <span className="text-[10px] font-semibold text-text bg-surface-2 border border-teal-800/60 px-2 py-0.5 rounded">
                          {salithaTasksCount} assigned to Salitha
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2 pl-0.5">
                      {rawActionItems.map((item, i) => (
                        <li key={i} className="flex flex-col gap-1 text-text-secondary text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-text mt-0.5">•</span>
                            <span className="flex-1 text-slate-200">
                              {item.text.replace(/^\[.*?\]\s*/, '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 pl-3.5 flex-wrap">
                            {item.isForUser ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-2 text-text border border-teal-800/60">
                                <User className="w-2.5 h-2.5 text-text" />
                                Salitha (You)
                              </span>
                            ) : item.assignee ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60">
                                <User className="w-2.5 h-2.5 text-purple-400" />
                                {item.assignee}
                              </span>
                            ) : null}

                            {(item.deadlineDisplay || item.deadlineDate) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/50">
                                <Calendar className="w-2.5 h-2.5 text-amber-400" />
                                Due: {item.deadlineDisplay || item.deadlineDate}
                              </span>
                            )}

                            {item.priority === 'high' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-rose-300 bg-rose-950/50 border border-rose-800/60">
                                High Priority
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    {salithaTasksCount > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer pt-2.5 mt-2.5 border-t border-[#111111] text-text-secondary select-none">
                        <input
                          type="checkbox"
                          checked={addTasksToKanban}
                          onChange={(e) => setAddTasksToKanban(e.target.checked)}
                          className="rounded bg-surface-2 border-[#1a1a1a] text-teal-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-[11px] text-text font-medium">
                          Automatically add Salitha's action items ({salithaTasksCount}) to Kanban To Do upon approval
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Work View */}
            {!isMeeting && (
              <div className="flex flex-col gap-2 mt-1 text-xs">
                {description && (
                  <div className="bg-surface-2 p-3 rounded-lg border border-[#111111]">
                    <div className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      Description
                    </div>
                    <MarkdownViewer content={description} className="text-xs" />
                  </div>
                )}
                {implementationNotes && (
                  <div className="bg-surface-2 p-3 rounded-lg border border-[#111111]">
                    <div className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      Implementation Notes
                    </div>
                    <MarkdownViewer content={implementationNotes} className="text-xs font-mono" />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Edit Mode Form */
          <div className="p-3.5 bg-[#000000] rounded-xl border border-teal-800/50 flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#111111]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text">
                Edit {isMeeting ? 'Meeting' : 'Work'} Entry
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-text-muted hover:text-slate-200"
              >
                Close Form
              </button>
            </div>

            {/* Title & Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[10px] text-text-muted font-semibold uppercase">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-text-muted font-semibold uppercase">
                  Project Tag
                </label>
                <input
                  type="text"
                  value={projectTag}
                  placeholder="e.g. Auth, Frontend"
                  onChange={(e) => setProjectTag(e.target.value)}
                  className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Date, Start, End */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-text-muted font-semibold uppercase">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2 py-1.5 focus:outline-none focus:border-teal-500 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-text-muted font-semibold uppercase">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2 py-1.5 focus:outline-none focus:border-teal-500 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-text-muted font-semibold uppercase">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2 py-1.5 focus:outline-none focus:border-teal-500 font-mono text-xs"
                />
              </div>
            </div>

            {/* Chained Predecessor Event Selector */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-surface-2 rounded-lg border border-[#161616]">
              <label className="text-[10px] text-text font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-text" />
                Chained from Previous Event (Lineage & Audit Trail)
              </label>
              <select
                value={previousEventId || ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setPreviousEventId(id);
                  const match = availableEvents.find((ev) => ev.id === id);
                  setPreviousEventTitle(match ? match.title : null);
                }}
                className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">None (Independent / Standalone)</option>
                {availableEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    [{ev.type === 'meeting' ? 'Meeting' : 'Work'}] {ev.date} {ev.startTime ? `(${ev.startTime}) ` : ''}— {ev.title}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-text-muted">
                {previousEventId
                  ? 'This event will be visually chained to the selected predecessor in your timeline.'
                  : 'Connect this event to an earlier meeting or workload for complete audit lineage.'}
              </p>
            </div>

            {/* Content Fields for Meeting */}
            {isMeeting && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted font-semibold uppercase">
                    Discussion Summary
                  </label>
                  <textarea
                    rows={6}
                    value={discussionSummary}
                    onChange={(e) => setDiscussionSummary(e.target.value)}
                    className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 resize-y text-xs leading-relaxed font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted font-semibold uppercase">
                    Key Decisions
                  </label>
                  <textarea
                    rows={3}
                    value={decisions}
                    onChange={(e) => setDecisions(e.target.value)}
                    className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 resize-y text-xs leading-relaxed font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted font-semibold uppercase">
                    Action Items (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={actionItemsText}
                    onChange={(e) => setActionItemsText(e.target.value)}
                    className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 resize-y text-xs leading-relaxed"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1 text-text-secondary select-none">
                  <input
                    type="checkbox"
                    checked={addTasksToKanban}
                    onChange={(e) => setAddTasksToKanban(e.target.checked)}
                    className="rounded bg-surface-2 border-[#1a1a1a] text-teal-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-text">
                    Also add Salitha's action items to Kanban To Do upon approval
                  </span>
                </label>
              </>
            )}

            {/* Content Fields for Work */}
            {!isMeeting && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted font-semibold uppercase">
                    Description
                  </label>
                  <textarea
                    rows={7}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 resize-y text-xs leading-relaxed font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted font-semibold uppercase">
                    Implementation Notes
                  </label>
                  <textarea
                    rows={3}
                    value={implementationNotes}
                    onChange={(e) => setImplementationNotes(e.target.value)}
                    className="bg-surface-2 text-text border border-[#1a1a1a] rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 resize-y text-xs leading-relaxed font-mono"
                  />
                </div>

                {isLinkedToTask && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-text-secondary select-none">
                    <input
                      type="checkbox"
                      checked={syncToTaskLog}
                      onChange={(e) => setSyncToTaskLog(e.target.checked)}
                      className="rounded bg-surface-2 border-[#1a1a1a] text-teal-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs">
                      Also update completed task description in Task Log upon approval
                    </span>
                  </label>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </ProposalCard>
  );
}
