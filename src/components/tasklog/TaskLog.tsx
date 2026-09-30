import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import type { WorkTask, TaskPriority, TaskTimeEntry } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { calculateLiveTrackedSeconds } from '../../utils/taskTime';

import { TaskLogHeader } from './TaskLogHeader';
import { DailySummaryBar } from './DailySummaryBar';
import { TaskFilterBar } from './TaskFilterBar';
import { KanbanBoard } from './KanbanBoard';
import { TaskTableView } from './TaskTableView';

import { TaskFormModal } from './modals/TaskFormModal';
import { TaskDetailModal } from './modals/TaskDetailModal';
import { TaskTimeConfirmModal, type TaskConfirmAction } from './modals/TaskTimeConfirmModal';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { CarryoverModal } from './modals/CarryoverModal';
import { StaleSegmentModal } from './modals/StaleSegmentModal';

export function TaskLog() {
  const {
    tasks,
    selectedDate,
    isLoading,
    pastUnfinishedCount,
    includePastUnfinished,
    runningTaskId,
    lastPausedTaskId,
    searchQuery,
    priorityFilter,
    sortBy,
    sortOrder,

    setSelectedDate,
    setIncludePastUnfinished,
    setSearchQuery,
    setPriorityFilter,
    setSortBy,
    setSortOrder,

    fetchTasks,
    fetchPastUnfinishedCount,
    fetchPastUnfinishedTasks,
    createTask,
    updateTask,
    deleteTask,
    startTask,
    pauseTask,
    resumeTask,
    finishTask,
    revertToInProgress,
    revertToTodo,
    carryoverTasksToDate,
    checkStaleRunningSegment,
    closeStaleSegment,
  } = useTaskStore();

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchPastUnfinishedCount();
  }, [fetchTasks, fetchPastUnfinishedCount]);

  // Stale segment check on mount
  const [staleSegmentData, setStaleSegmentData] = useState<{
    task: WorkTask;
    entry: TaskTimeEntry;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    checkStaleRunningSegment().then((res) => {
      if (isMounted && res) {
        setStaleSegmentData(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [checkStaleRunningSegment]);

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkTask | undefined>();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [timeConfirmAction, setTimeConfirmAction] = useState<{
    task: WorkTask;
    action: TaskConfirmAction;
  } | null>(null);
  const [deletingTask, setDeletingTask] = useState<WorkTask | undefined>();
  const [isCarryoverOpen, setIsCarryoverOpen] = useState(false);
  const [pastTasksList, setPastTasksList] = useState<WorkTask[]>([]);

  // Derived current detail task from live store
  const detailTask = useMemo(() => {
    if (!detailTaskId) return undefined;
    return tasks.find((t) => t.id === detailTaskId);
  }, [detailTaskId, tasks]);

  // Currently running and last paused tasks
  const runningTask = useMemo(() => {
    if (!runningTaskId) return null;
    return tasks.find((t) => t.id === runningTaskId) || null;
  }, [runningTaskId, tasks]);

  const lastPausedTask = useMemo(() => {
    if (!lastPausedTaskId) return null;
    return tasks.find((t) => t.id === lastPausedTaskId) || null;
  }, [lastPausedTaskId, tasks]);

  // Filtered and Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Search query filter (title or description)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = task.title.toLowerCase().includes(q);
          const matchDesc = task.description.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        }

        // Priority filter
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'created_at':
            cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'planned_date':
            cmp = a.plannedDate.localeCompare(b.plannedDate);
            break;
          case 'priority': {
            const weights: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
            cmp = weights[a.priority] - weights[b.priority];
            break;
          }
          case 'started_at': {
            const tA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const tB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            cmp = tA - tB;
            break;
          }
          case 'duration': {
            const dA = calculateLiveTrackedSeconds(a.trackedSeconds, a.activeSegmentStartedAt);
            const dB = calculateLiveTrackedSeconds(b.trackedSeconds, b.activeSegmentStartedAt);
            cmp = dA - dB;
            break;
          }
          case 'title':
            cmp = a.title.localeCompare(b.title);
            break;
          case 'order':
          default:
            cmp = a.orderIndex - b.orderIndex;
            break;
        }

        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [tasks, searchQuery, priorityFilter, sortBy, sortOrder]);

  // Handlers
  const handleOpenNewTask = () => {
    setEditingTask(undefined);
    setIsFormOpen(true);
  };

  const handleEditTask = (task: WorkTask) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: {
    title: string;
    description: string;
    priority: TaskPriority;
    plannedDate: string;
  }) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data);
        toast.success('Task updated');
      } else {
        await createTask(data);
        toast.success('Task created in To Do');
      }
    } catch {
      toast.error('Failed to save task');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    try {
      await deleteTask(deletingTask.id);
      toast.success('Task deleted');
      setDeletingTask(undefined);
      if (detailTaskId === deletingTask.id) {
        setDetailTaskId(null);
      }
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleStartPrompt = (task: WorkTask) => {
    setTimeConfirmAction({ task, action: 'start' });
  };

  const handlePausePrompt = (task: WorkTask) => {
    setTimeConfirmAction({ task, action: 'pause' });
  };

  const handleResumePrompt = (task: WorkTask) => {
    setTimeConfirmAction({ task, action: 'resume' });
  };

  const handleCompletePrompt = (task: WorkTask) => {
    setTimeConfirmAction({ task, action: 'complete' });
  };

  const handleConfirmTime = async (isoTimestamp: string) => {
    if (!timeConfirmAction) return;
    const { task, action } = timeConfirmAction;
    try {
      if (action === 'start') {
        await startTask(task.id, isoTimestamp);
        toast.success('Task moved to In Progress');
      } else if (action === 'pause') {
        await pauseTask(task.id, isoTimestamp);
        toast.success('Task paused');
      } else if (action === 'resume') {
        await resumeTask(task.id, isoTimestamp);
        toast.success('Task resumed and running');
      } else {
        await finishTask(task.id, isoTimestamp);
        toast.success('Task moved to Done! 🎉');
      }
    } catch (err: unknown) {
      toast.error(`Failed to ${action} task: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleRevertToTodo = async (task: WorkTask) => {
    try {
      await revertToTodo(task.id);
      toast.success('Moved back to To Do');
    } catch {
      toast.error('Failed to move task');
    }
  };

  const handleRevertToInProgress = async (task: WorkTask) => {
    try {
      await revertToInProgress(task.id);
      toast.success('Reopened to In Progress');
    } catch {
      toast.error('Failed to reopen task');
    }
  };

  const handleOpenCarryover = useCallback(async () => {
    const list = await fetchPastUnfinishedTasks();
    setPastTasksList(list);
    setIsCarryoverOpen(true);
  }, [fetchPastUnfinishedTasks]);

  const handleCarryoverConfirm = async (taskIds: string[], targetDate: string) => {
    try {
      await carryoverTasksToDate(taskIds, targetDate);
      toast.success(`Carried over ${taskIds.length} tasks to ${targetDate}`);
    } catch {
      toast.error('Failed to carryover tasks');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-[#0f1117] overflow-hidden">
      {/* 1. Header with date navigation & New Task & Break/Resume */}
      <TaskLogHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onNewTask={handleOpenNewTask}
        pastUnfinishedCount={pastUnfinishedCount}
        onOpenCarryover={handleOpenCarryover}
        runningTask={runningTask}
        lastPausedTask={lastPausedTask}
        onPauseRunningTask={() => runningTask && handlePausePrompt(runningTask)}
        onResumeLastTask={() => lastPausedTask && handleResumePrompt(lastPausedTask)}
      />

      {/* 2. Daily Summary Bar */}
      <DailySummaryBar tasks={tasks} />

      {/* 3. Filter and Sort Bar */}
      <TaskFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        includePastUnfinished={includePastUnfinished}
        onToggleIncludePast={setIncludePastUnfinished}
      />

      {/* 4. Scrollable Work Area: Kanban Board on top, Task Table right beneath */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6 relative">
        {isLoading && (
          <div className="fixed inset-0 bg-[#0f1117]/60 backdrop-blur-[1px] flex items-center justify-center z-20 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#1e2433] rounded-xl border border-[#2d3748] text-teal-400 text-xs font-semibold shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading tasks...</span>
            </div>
          </div>
        )}

        {/* 4a. Kanban Board */}
        <section>
          <KanbanBoard
            tasks={filteredTasks}
            selectedDate={selectedDate}
            onAddTask={handleOpenNewTask}
            onTaskClick={(task) => setDetailTaskId(task.id)}
            onEditTask={handleEditTask}
            onDeleteTask={(task) => setDeletingTask(task)}
            onStartTask={handleStartPrompt}
            onPauseTask={handlePausePrompt}
            onResumeTask={handleResumePrompt}
            onCompleteTask={handleCompletePrompt}
            onRevertToInProgress={handleRevertToInProgress}
            onRevertToTodo={handleRevertToTodo}
          />
        </section>

        {/* 4b. Task & Break Analysis Table */}
        <section className="pt-2 pb-6">
          <TaskTableView
            tasks={filteredTasks}
            selectedDate={selectedDate}
            onTaskClick={(task) => setDetailTaskId(task.id)}
            onEditTask={handleEditTask}
            onDeleteTask={(task) => setDeletingTask(task)}
            onStartTask={handleStartPrompt}
            onPauseTask={handlePausePrompt}
            onResumeTask={handleResumePrompt}
            onCompleteTask={handleCompletePrompt}
            onRevertToInProgress={handleRevertToInProgress}
            onRevertToTodo={handleRevertToTodo}
          />
        </section>
      </div>

      {/* Modals */}
      {isFormOpen && (
        <TaskFormModal
          initialTask={editingTask}
          defaultPlannedDate={selectedDate}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTask(undefined);
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onEdit={() => {
            setEditingTask(detailTask);
            setIsFormOpen(true);
          }}
          onDelete={() => {
            setDeletingTask(detailTask);
          }}
          onStart={() => handleStartPrompt(detailTask)}
          onPause={() => handlePausePrompt(detailTask)}
          onResume={() => handleResumePrompt(detailTask)}
          onComplete={() => handleCompletePrompt(detailTask)}
        />
      )}

      {timeConfirmAction && (
        <TaskTimeConfirmModal
          task={timeConfirmAction.task}
          action={timeConfirmAction.action}
          runningTaskTitle={
            runningTask && runningTask.id !== timeConfirmAction.task.id
              ? runningTask.title
              : null
          }
          onClose={() => setTimeConfirmAction(null)}
          onConfirm={handleConfirmTime}
        />
      )}

      {deletingTask && (
        <ConfirmDeleteModal
          title={deletingTask.title}
          onClose={() => setDeletingTask(undefined)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {isCarryoverOpen && (
        <CarryoverModal
          tasks={pastTasksList}
          onClose={() => setIsCarryoverOpen(false)}
          onCarryover={handleCarryoverConfirm}
        />
      )}

      {staleSegmentData && (
        <StaleSegmentModal
          task={staleSegmentData.task}
          entry={staleSegmentData.entry}
          onClose={() => setStaleSegmentData(null)}
          onConfirm={async (stopTimeISO) => {
            await closeStaleSegment(
              staleSegmentData.entry.id,
              staleSegmentData.task.id,
              stopTimeISO
            );
            setStaleSegmentData(null);
            toast.success('Stale work timer closed');
          }}
        />
      )}
    </div>
  );
}
