import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  Flag,
  History,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  AlertCircle,
  Save,
  Layers,
} from 'lucide-react';
import type { WorkTask, TaskStatusHistory, TaskTimeEntry, SegmentEndReason } from '../../../types';
import { MarkdownViewer } from '../../common/MarkdownViewer';
import { useTaskStore } from '../../../store/taskStore';
import {
  formatDateTime,
  formatDuration,
  calculateDurationSeconds,
  toLocalInputValue,
  fromLocalInputValue,
  validateSegmentTimes,
  validateSegmentOverlap,
  calculateLiveTrackedSeconds,
} from '../../../utils/taskTime';

interface TaskDetailModalProps {
  task: WorkTask;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onComplete: () => void;
}

export function TaskDetailModal({
  task,
  onClose,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onResume,
  onComplete,
}: TaskDetailModalProps) {
  const {
    fetchTaskHistory,
    fetchTaskSegments,
    updateSegment,
    deleteSegment,
    revertToInProgress,
    revertToTodo,
  } = useTaskStore();

  const [history, setHistory] = useState<TaskStatusHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Time Segments state
  const [segments, setSegments] = useState<TaskTimeEntry[]>([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(true);

  // Inline Segment Editor state
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editSegStart, setEditSegStart] = useState('');
  const [editSegEnd, setEditSegEnd] = useState('');
  const [editSegReason, setEditSegReason] = useState<SegmentEndReason>('manual');
  const [segError, setSegError] = useState<string | null>(null);
  const [isSavingSegment, setIsSavingSegment] = useState(false);
  const [confirmDeleteSegId, setConfirmDeleteSegId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [histItems, segItems] = await Promise.all([
        fetchTaskHistory(task.id),
        fetchTaskSegments(task.id),
      ]);
      setHistory(histItems);
      setSegments(segItems);
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingSegments(false);
    }
  }, [task.id, fetchTaskHistory, fetchTaskSegments]);

  useEffect(() => {
    loadData();
  }, [loadData, task.trackedSeconds]);

  const handleStartEditSegment = (seg: TaskTimeEntry) => {
    setEditingSegId(seg.id);
    setEditSegStart(toLocalInputValue(seg.startedAt));
    setEditSegEnd(seg.endedAt ? toLocalInputValue(seg.endedAt) : '');
    setEditSegReason(seg.endReason || 'manual');
    setSegError(null);
  };

  const handleSaveSegment = async () => {
    if (!editingSegId) return;
    setSegError(null);

    const startIso = fromLocalInputValue(editSegStart);
    const endIso = editSegEnd ? fromLocalInputValue(editSegEnd) : null;

    if (!startIso) {
      setSegError('Start time is required.');
      return;
    }

    const timeValidation = validateSegmentTimes(startIso, endIso, false);
    if (!timeValidation.valid) {
      setSegError(timeValidation.error || 'Invalid segment timestamps.');
      return;
    }

    const proposedSegments = segments.map((s) =>
      s.id === editingSegId ? { ...s, startedAt: startIso, endedAt: endIso } : s
    );
    const overlapValidation = validateSegmentOverlap(proposedSegments);
    if (!overlapValidation.valid) {
      setSegError(overlapValidation.error || 'Segment overlaps with another segment.');
      return;
    }

    try {
      setIsSavingSegment(true);
      await updateSegment(editingSegId, task.id, startIso, endIso, editSegReason);
      setEditingSegId(null);
      await loadData();
    } catch (err: unknown) {
      setSegError(err instanceof Error ? err.message : 'Failed to update segment.');
    } finally {
      setIsSavingSegment(false);
    }
  };

  const handleDeleteSegment = async (segId: string) => {
    try {
      await deleteSegment(segId, task.id);
      setConfirmDeleteSegId(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete segment.');
    }
  };

  const isRunning = task.status === 'in_progress' && !task.isPaused && Boolean(task.activeSegmentStartedAt);
  const isPaused = task.status === 'in_progress' && task.isPaused;

  const priorityStyles = {
    high: 'bg-surface-2 text-text border-border-strong',
    medium: 'bg-surface-2 text-text-secondary border-border-strong',
    low: 'bg-surface-2 text-text-secondary border-border-strong',
  }[task.priority];

  const statusStyles = {
    todo: 'bg-surface text-text-secondary border-border',
    in_progress: 'bg-accent/20 text-accent border-accent',
    done: 'bg-accent/20 text-accent border-accent',
  }[task.status];

  const statusLabels = {
    todo: 'To Do',
    in_progress: isRunning ? 'In Progress (Running)' : isPaused ? 'In Progress (Paused)' : 'In Progress',
    done: 'Done',
  }[task.status];

  // Last closed segment can be deleted
  const lastClosedSegment = segments.filter((s) => s.endedAt !== null).slice(-1)[0];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-surface flex-shrink-0">
          <div className="flex flex-col gap-2 max-w-[80%]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${statusStyles}`}>
                {statusLabels}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${priorityStyles}`}>
                <Flag className="w-3 h-3 inline mr-1" />
                {task.priority}
              </span>
              <span className="flex items-center gap-1 text-xs text-text-secondary bg-bg px-2.5 py-0.5 rounded-full border border-border">
                <Calendar className="w-3 h-3 text-text-muted" />
                {task.plannedDate}
              </span>
            </div>
            <h1 className="text-xl font-bold text-text break-words mt-1 leading-snug">
              {task.title}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={onEdit}
              title="Edit Task"
              className="p-2 text-text-secondary hover:text-accent hover:bg-surface-2 rounded-lg transition"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete Task"
              className="p-2 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl border border-border">
            <span className="text-xs font-semibold text-text-secondary">Quick Status Transition</span>
            <div className="flex items-center gap-2">
              {task.status === 'todo' && (
                <button
                  type="button"
                  onClick={onStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-accent bg-accent/20 hover:bg-accent/20 border border-accent rounded-lg transition active:scale-95 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Task
                </button>
              )}

              {task.status === 'in_progress' && (
                <>
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={onPause}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text-secondary bg-surface-2 hover:bg-surface-2 border border-border-strong rounded-lg transition active:scale-95 shadow-sm"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" /> Pause Task
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onResume}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-accent bg-accent/20 hover:bg-accent/20 border border-accent rounded-lg transition active:scale-95 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Resume Task
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onComplete}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-accent bg-accent/20 hover:bg-accent/20 border border-accent rounded-lg transition active:scale-95 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete Task
                  </button>

                  <button
                    type="button"
                    onClick={() => revertToTodo(task.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text bg-surface hover:bg-surface-2 border border-border rounded-lg transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Move to To Do
                  </button>
                </>
              )}

              {task.status === 'done' && (
                <button
                  type="button"
                  onClick={() => revertToInProgress(task.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-surface-2 hover:bg-surface-2 border border-border-strong rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reopen to In Progress
                </button>
              )}
            </div>
          </div>

          {/* Time Tracking Overview Panel */}
          <div className="bg-surface-2 rounded-xl border border-border p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" /> Tracked Time & Segments
              </span>
              <span className="text-xs text-text-muted font-medium">
                {segments.length} segment{segments.length === 1 ? '' : 's'} recorded
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-bg rounded-lg border border-border">
                <span className="text-[10px] uppercase font-bold text-text-muted">Total Effort</span>
                <p className="text-base font-bold text-accent font-mono mt-0.5">
                  {formatDuration(calculateLiveTrackedSeconds(task.trackedSeconds, task.activeSegmentStartedAt))}
                </p>
                {task.isPaused && (
                  <span className="text-[10px] text-text-secondary font-semibold block mt-0.5">
                    ❚❚ Paused
                  </span>
                )}
              </div>

              <div className="p-3 bg-bg rounded-lg border border-border">
                <span className="text-[10px] uppercase font-bold text-text-muted">First Started</span>
                <p className="text-xs font-semibold text-text mt-1">
                  {task.startedAt ? formatDateTime(task.startedAt) : 'Not started'}
                </p>
              </div>

              <div className="p-3 bg-bg rounded-lg border border-border">
                <span className="text-[10px] uppercase font-bold text-text-muted">Status Span</span>
                <p className="text-xs font-semibold text-text mt-1">
                  {task.completedAt
                    ? `Finished: ${formatDateTime(task.completedAt)}`
                    : task.startedAt
                    ? 'In Progress'
                    : 'Not started'}
                </p>
              </div>
            </div>

            {/* Segments Breakdown List */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-text-secondary" /> Work Segments
              </span>

              {isLoadingSegments ? (
                <div className="text-xs text-text-muted py-3 text-center">Loading segments...</div>
              ) : segments.length === 0 ? (
                <div className="text-xs text-text-muted py-4 text-center bg-bg rounded-lg border border-dashed border-border">
                  No time segments recorded yet. Start working to log time.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {segments.map((seg, idx) => {
                    const isClosed = Boolean(seg.endedAt);
                    const segSeconds = calculateDurationSeconds(seg.startedAt, seg.endedAt);
                    const isLastClosed = lastClosedSegment?.id === seg.id;
                    const isEditingThis = editingSegId === seg.id;

                    const reasonBadge = {
                      paused: 'bg-surface-2 text-text-secondary border-border-strong',
                      done: 'bg-accent/20 text-accent border-accent',
                      manual: 'bg-surface text-text-secondary border-border',
                      auto_closed: 'bg-purple-950/50 text-purple-300 border-purple-800/60',
                    }[seg.endReason || 'manual'];

                    return (
                      <div
                        key={seg.id}
                        className={`p-3 rounded-lg border transition ${
                          isEditingThis
                            ? 'bg-surface border-accent ring-1 ring-accent'
                            : !isClosed
                            ? 'bg-accent/20 border-accent'
                            : 'bg-bg border-border hover:border-border-strong'
                        }`}
                      >
                        {!isEditingThis ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-text-muted text-[11px] w-6">
                                #{idx + 1}
                              </span>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 text-text font-mono">
                                  <span>{formatDateTime(seg.startedAt)}</span>
                                  <span className="text-text-muted">➔</span>
                                  {isClosed ? (
                                    <span>{formatDateTime(seg.endedAt!)}</span>
                                  ) : (
                                    <span className="text-accent font-semibold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent/20 animate-ping" />
                                      Running Now
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-text-secondary font-mono mt-0.5">
                                  Duration: <strong className="text-text">{formatDuration(segSeconds)}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {seg.endReason ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${reasonBadge}`}>
                                  {seg.endReason}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent">
                                  active
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleStartEditSegment(seg)}
                                title="Edit segment times"
                                className="p-1.5 text-text-secondary hover:text-accent hover:bg-surface-2 rounded transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {isLastClosed && (
                                <>
                                  {confirmDeleteSegId === seg.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSegment(seg.id)}
                                        className="px-2 py-0.5 text-[10px] font-bold text-text bg-surface-2 border border-border-strong rounded"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteSegId(null)}
                                        className="px-2 py-0.5 text-[10px] text-text-secondary hover:text-text"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteSegId(seg.id)}
                                      title="Delete last closed segment"
                                      className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Inline Segment Editor */
                          <div className="flex flex-col gap-3 py-1">
                            <span className="text-[11px] font-bold text-accent">
                              Editing Segment #{idx + 1}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div>
                                <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                                  Started At
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editSegStart}
                                  onChange={(e) => setEditSegStart(e.target.value)}
                                  className="w-full bg-bg text-text border border-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                                  Ended At {isClosed ? '' : '(Open segment)'}
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editSegEnd}
                                  onChange={(e) => setEditSegEnd(e.target.value)}
                                  placeholder={isClosed ? '' : 'Leave empty for running'}
                                  className="w-full bg-bg text-text border border-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                                  End Reason
                                </label>
                                <select
                                  value={editSegReason}
                                  onChange={(e) => setEditSegReason(e.target.value as SegmentEndReason)}
                                  className="w-full bg-bg text-text border border-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                                >
                                  <option value="paused">paused</option>
                                  <option value="done">done</option>
                                  <option value="manual">manual</option>
                                  <option value="auto_closed">auto_closed</option>
                                </select>
                              </div>
                            </div>

                            {segError && (
                              <div className="flex items-center gap-1.5 text-xs text-text">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{segError}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingSegId(null)}
                                className="px-3 py-1 text-xs text-text-secondary hover:text-text"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingSegment}
                                onClick={handleSaveSegment}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text bg-accent/20 hover:bg-accent/20 rounded transition disabled:opacity-50"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {isSavingSegment ? 'Saving...' : 'Save Segment'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Description & Specifications
            </span>
            <div className="p-4 rounded-xl bg-bg border border-border min-h-[120px]">
              <MarkdownViewer
                content={task.description}
                emptyPlaceholder="No description provided for this task."
              />
            </div>
          </div>

          {/* Audit History Timeline */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-text-secondary" /> Audit History & Changes
            </span>
            <div className="bg-surface-2 rounded-xl border border-border p-4">
              {isLoadingHistory ? (
                <div className="text-xs text-text-muted py-3 text-center">Loading audit log...</div>
              ) : history.length === 0 ? (
                <div className="text-xs text-text-muted py-3 text-center">No history recorded yet.</div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-2">
                  {history.map((item) => (
                    <div key={item.id} className="relative group">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-accent/20 ring-4 ring-[#080808]" />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text">
                            {item.fromStatus === 'created'
                              ? 'Task Created'
                              : `${item.fromStatus} → ${item.toStatus}`}
                          </span>
                          {item.isManualEdit && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-surface text-text-secondary border border-border">
                              Manual Edit
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                          <span>{formatDateTime(item.changedAt)}</span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span className="text-text-secondary italic">{item.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
