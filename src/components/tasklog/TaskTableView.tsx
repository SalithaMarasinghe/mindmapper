import { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Coffee,
  Edit2,
  Trash2,
  RotateCcw,
  ArrowLeft,
  Layers,
  Table as TableIcon,
} from 'lucide-react';
import type { WorkTask } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { MarkdownViewer } from '../common/MarkdownViewer';
import {
  formatDateTime,
  formatTime,
  formatDuration,
  analyzeTaskTimeAndBreaks,
} from '../../utils/taskTime';

interface TaskTableViewProps {
  tasks: WorkTask[];
  selectedDate: string;
  onTaskClick: (task: WorkTask) => void;
  onEditTask: (task: WorkTask) => void;
  onDeleteTask: (task: WorkTask) => void;
  onStartTask: (task: WorkTask) => void;
  onPauseTask: (task: WorkTask) => void;
  onResumeTask: (task: WorkTask) => void;
  onCompleteTask: (task: WorkTask) => void;
  onRevertToInProgress: (task: WorkTask) => void;
  onRevertToTodo: (task: WorkTask) => void;
}

export function TaskTableView({
  tasks,
  selectedDate,
  onTaskClick,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onResumeTask,
  onCompleteTask,
  onRevertToInProgress,
  onRevertToTodo,
}: TaskTableViewProps) {
  const { segmentsByTaskId } = useTaskStore();

  const [filterMode, setFilterMode] = useState<'all' | 'completed'>('all');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  // Live timer tick for tasks that are currently running or paused
  useEffect(() => {
    const hasActive = tasks.some(
      (t) => t.status === 'in_progress' && (Boolean(t.activeSegmentStartedAt) || t.isPaused)
    );
    if (!hasActive) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  const toggleExpand = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTaskIds(new Set(tasks.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedTaskIds(new Set());
  };

  // Filter tasks based on toggle
  const displayedTasks = useMemo(() => {
    if (filterMode === 'completed') {
      return tasks.filter((t) => t.status === 'done');
    }
    return tasks;
  }, [tasks, filterMode]);

  // Pre-calculate time and break analysis for all displayed tasks
  const analyses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof analyzeTaskTimeAndBreaks>>();
    for (const t of displayedTasks) {
      const segs = segmentsByTaskId[t.id] || [];
      map.set(t.id, analyzeTaskTimeAndBreaks(t, segs));
    }
    return map;
  }, [displayedTasks, segmentsByTaskId]);

  // Total metrics across displayed tasks
  const { totalWorkSeconds, totalBreakSeconds, totalCompletedCount } = useMemo(() => {
    let work = 0;
    let breaks = 0;
    let completed = 0;
    for (const t of tasks) {
      if (t.status === 'done') completed++;
      const segs = segmentsByTaskId[t.id] || [];
      const analysis = analyzeTaskTimeAndBreaks(t, segs);
      work += analysis.totalWorkSeconds;
      breaks += analysis.totalBreakSeconds;
    }
    return {
      totalWorkSeconds: work,
      totalBreakSeconds: breaks,
      totalCompletedCount: completed,
    };
  }, [tasks, segmentsByTaskId]);

  return (
    <div className="flex flex-col bg-surface-2 border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Table Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-surface border-b border-border">
        {/* Left: Title & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-text">
            <div className="p-1.5 rounded-lg bg-accent/20 text-accent border border-accent">
              <TableIcon className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold tracking-wide">Tasks & Break Analysis</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface text-text-secondary border border-border">
              {displayedTasks.length}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-surface-2 mx-1 hidden sm:block" />

          {/* Filter Toggle Buttons */}
          <div className="flex items-center bg-bg p-0.5 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                filterMode === 'all'
                  ? 'bg-surface text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('completed')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                filterMode === 'completed'
                  ? 'bg-surface text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              Completed ({totalCompletedCount})
            </button>
          </div>
        </div>

        {/* Right: Summary Metrics & Expand/Collapse All */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-bg px-3 py-1.5 rounded-xl border border-border">
            <div className="flex items-center gap-1.5 text-accent font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Work: {formatDuration(totalWorkSeconds)}</span>
            </div>
            <span className="text-text-muted">•</span>
            <div className="flex items-center gap-1.5 text-text-secondary font-mono font-bold">
              <Coffee className="w-3.5 h-3.5 text-text-secondary" />
              <span>Breaks: {formatDuration(totalBreakSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-text-secondary">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-1 hover:text-text hover:bg-surface rounded transition"
            >
              Expand All
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-1 hover:text-text hover:bg-surface rounded transition"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-surface-2 text-text-secondary uppercase text-[10px] font-bold tracking-wider border-b border-border select-none">
              <th className="py-3 px-3 w-10 text-center"></th>
              <th className="py-3 px-4 min-w-[200px]">Task</th>
              <th className="py-3 px-3 min-w-[110px]">Status</th>
              <th className="py-3 px-3 min-w-[130px]">Time Span</th>
              <th className="py-3 px-3 min-w-[90px]">Work Time</th>
              <th className="py-3 px-3 min-w-[90px]">Break Time</th>
              <th className="py-3 px-3 min-w-[110px]">Breaks</th>
              <th className="py-3 px-4 min-w-[120px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]/50">
            {displayedTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-text-muted">
                  {filterMode === 'completed'
                    ? `No tasks completed yet for ${selectedDate}.`
                    : `No tasks found for ${selectedDate}.`}
                </td>
              </tr>
            ) : (
              displayedTasks.map((task) => {
                const analysis = analyses.get(task.id) || {
                  totalWorkSeconds: task.trackedSeconds,
                  totalBreakSeconds: 0,
                  totalSpanSeconds: task.trackedSeconds,
                  breaks: [],
                  timeline: [],
                  segmentCount: 0,
                };

                const isExpanded = expandedTaskIds.has(task.id);
                const isRunning =
                  task.status === 'in_progress' &&
                  !task.isPaused &&
                  Boolean(task.activeSegmentStartedAt);
                const isPaused = task.status === 'in_progress' && task.isPaused;

                const priorityBadge = {
                  high: 'bg-surface-2 text-text border-border-strong',
                  medium: 'bg-surface-2 text-text-secondary border-border-strong',
                  low: 'bg-surface-2 text-text-secondary border-border-strong',
                }[task.priority];

                const statusBadge = {
                  todo: 'bg-surface text-text-secondary border-border',
                  in_progress: isRunning
                    ? 'bg-accent/20 text-accent border-accent'
                    : 'bg-surface-2 text-text-secondary border-border-strong',
                  done: 'bg-accent/20 text-accent border-accent',
                }[task.status];

                const statusText = {
                  todo: 'To Do',
                  in_progress: isRunning ? 'Running' : isPaused ? 'Paused' : 'In Progress',
                  done: 'Done',
                }[task.status];

                return (
                  <tr
                    key={task.id}
                    className={`group transition-colors ${
                      isExpanded
                        ? 'bg-surface'
                        : isRunning
                        ? 'bg-accent/20 hover:bg-surface'
                        : 'hover:bg-surface'
                    }`}
                  >
                    <td colSpan={8} className="p-0">
                      {/* Main Task Row */}
                      <div
                        onClick={() => toggleExpand(task.id)}
                        className="flex items-center py-3 px-3 cursor-pointer select-none"
                      >
                        {/* 1. Chevron */}
                        <div className="w-8 flex items-center justify-center flex-shrink-0 text-text-secondary group-hover:text-text">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-accent" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>

                        {/* 2. Task Title & Meta */}
                        <div className="flex-1 min-w-[200px] pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text group-hover:text-text truncate">
                              {task.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider border ${priorityBadge}`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-text-secondary truncate mt-0.5 max-w-md">
                              {task.description.split('\n')[0]}
                            </p>
                          )}
                        </div>

                        {/* 3. Status */}
                        <div className="w-[110px] flex-shrink-0 pr-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}
                          >
                            {isRunning && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/20 animate-ping" />
                            )}
                            {isPaused && <Pause className="w-2.5 h-2.5 fill-current" />}
                            {task.status === 'done' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {statusText}
                          </span>
                        </div>

                        {/* 4. Time Span */}
                        <div
                          className="w-[130px] flex-shrink-0 pr-3 text-text-secondary font-mono text-[11px]"
                          title={task.startedAt ? `Started: ${formatDateTime(task.startedAt)}` : undefined}
                        >
                          {task.startedAt ? (
                            <div className="flex flex-col">
                              <span>{formatTime(task.startedAt)}</span>
                              <span className="text-[10px] text-text-muted">
                                ➔ {task.completedAt ? formatTime(task.completedAt) : isRunning ? 'Now (running)' : 'Paused'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-muted italic text-[11px]">Not started</span>
                          )}
                        </div>

                        {/* 5. Work Time */}
                        <div className="w-[90px] flex-shrink-0 pr-3 font-mono font-bold text-accent">
                          {formatDuration(analysis.totalWorkSeconds)}
                        </div>

                        {/* 6. Break Time */}
                        <div className="w-[90px] flex-shrink-0 pr-3 font-mono font-semibold">
                          {analysis.totalBreakSeconds > 0 ? (
                            <span className="text-text-secondary flex items-center gap-1">
                              <Coffee className="w-3 h-3 text-text-secondary" />
                              {formatDuration(analysis.totalBreakSeconds)}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </div>

                        {/* 7. Breaks Count */}
                        <div className="w-[110px] flex-shrink-0 pr-3">
                          {analysis.breaks.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border-strong">
                              {analysis.breaks.length}{' '}
                              {analysis.breaks.length === 1 ? 'break' : 'breaks'}
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px]">0 breaks</span>
                          )}
                        </div>

                        {/* 8. Actions */}
                        <div
                          className="w-[120px] flex items-center justify-end gap-1 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.status === 'todo' && (
                            <button
                              type="button"
                              onClick={() => onStartTask(task)}
                              title="Start Task"
                              className="p-1.5 text-accent hover:text-accent hover:bg-accent/20 rounded-md transition"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}

                          {task.status === 'in_progress' && (
                            <>
                              {isRunning ? (
                                <button
                                  type="button"
                                  onClick={() => onPauseTask(task)}
                                  title="Pause Task"
                                  className="p-1.5 text-text-secondary hover:text-text-secondary hover:bg-surface-2 rounded-md transition"
                                >
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onResumeTask(task)}
                                  title="Resume Task"
                                  className="p-1.5 text-accent hover:text-accent hover:bg-accent/20 rounded-md transition"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onCompleteTask(task)}
                                title="Complete Task"
                                className="p-1.5 text-accent hover:text-accent hover:bg-accent/20 rounded-md transition"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onRevertToTodo(task)}
                                title="Move back to To Do"
                                className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-md transition"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {task.status === 'done' && (
                            <button
                              type="button"
                              onClick={() => onRevertToInProgress(task)}
                              title="Reopen to In Progress"
                              className="p-1.5 text-text-secondary hover:text-text-secondary hover:bg-surface-2 rounded-md transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onEditTask(task)}
                            title="Edit Task"
                            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-md transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteTask(task)}
                            title="Delete Task"
                            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-md transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Accordion Panel */}
                      {isExpanded && (
                        <div className="px-8 pb-5 pt-1 bg-surface-2 border-t border-border animate-in fade-in duration-150">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
                            {/* Panel 1: Full Description */}
                            <div className="p-3.5 bg-bg rounded-xl border border-border flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                                  Task Description
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onTaskClick(task)}
                                  className="text-[10px] text-accent hover:text-accent font-semibold"
                                >
                                  Open Detail Modal ➔
                                </button>
                              </div>
                              <div className="text-xs text-text-secondary min-h-[60px] max-h-56 overflow-y-auto pr-1">
                                <MarkdownViewer
                                  content={task.description}
                                  emptyPlaceholder="No detailed description recorded for this task."
                                />
                              </div>
                            </div>

                            {/* Panel 2: Work Segments & Break Breakdown */}
                            <div className="p-3.5 bg-bg rounded-xl border border-border flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-accent" /> Work & Break
                                  Sequence
                                </span>
                                <span className="text-[10px] font-mono text-text-secondary">
                                  Span: {formatDuration(analysis.totalSpanSeconds)}
                                </span>
                              </div>

                              {analysis.timeline.length === 0 ? (
                                <div className="text-xs text-text-muted py-4 text-center">
                                  No work segments recorded yet.
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {analysis.timeline.map((item, idx) => {
                                    if (item.type === 'work') {
                                      return (
                                        <div
                                          key={`work-${idx}`}
                                          className="flex items-center justify-between p-2 rounded-lg bg-surface border border-accent text-xs"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-accent/20" />
                                            <span className="font-semibold text-text">
                                              Work Stretch #{item.index}
                                            </span>
                                            {item.isOngoing && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent">
                                                running
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 font-mono text-[11px]">
                                            <span className="text-text-secondary">
                                              {formatTime(item.startedAt)} –{' '}
                                              {item.endedAt ? formatTime(item.endedAt) : 'Now'}
                                            </span>
                                            <span className="font-bold text-accent">
                                              ({formatDuration(item.durationSeconds)})
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div
                                          key={`break-${idx}`}
                                          className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-border-strong text-xs"
                                        >
                                          <div className="flex items-center gap-2 text-text-secondary">
                                            <Coffee className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
                                            <span className="font-semibold">
                                              Break #{item.index}
                                              {item.isOngoing ? ' (Ongoing)' : ''}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 font-mono text-[11px]">
                                            <span className="text-text-secondary">
                                              {formatTime(item.startedAt)} –{' '}
                                              {item.endedAt ? formatTime(item.endedAt) : 'Now'}
                                            </span>
                                            <span className="font-bold text-text-secondary">
                                              ({formatDuration(item.durationSeconds)})
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
