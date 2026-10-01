import { Plus, ListTodo, Loader, CheckCircle2 } from 'lucide-react';
import type { WorkTask, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: WorkTask[];
  selectedDate: string;
  onAddTask?: () => void;
  onTaskClick: (task: WorkTask) => void;
  onEditTask: (task: WorkTask) => void;
  onDeleteTask: (task: WorkTask) => void;
  onStartTask: (task: WorkTask) => void;
  onPauseTask?: (task: WorkTask) => void;
  onResumeTask?: (task: WorkTask) => void;
  onCompleteTask: (task: WorkTask) => void;
  onRevertToInProgress: (task: WorkTask) => void;
  onRevertToTodo: (task: WorkTask) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  selectedDate,
  onAddTask,
  onTaskClick,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onResumeTask,
  onCompleteTask,
  onRevertToInProgress,
  onRevertToTodo,
}: KanbanColumnProps) {
  const columnConfig = {
    todo: {
      icon: <ListTodo className="w-4 h-4 text-text-secondary" />,
      badge: 'bg-surface text-text-secondary border-border',
      headerBorder: 'border-border',
      emptyText: 'No tasks to do for this day.',
    },
    in_progress: {
      icon: <Loader className="w-4 h-4 text-accent animate-spin" />,
      badge: 'bg-accent/20 text-accent border-accent',
      headerBorder: 'border-accent',
      emptyText: 'No tasks currently in progress.',
    },
    done: {
      icon: <CheckCircle2 className="w-4 h-4 text-accent" />,
      badge: 'bg-accent/20 text-accent border-accent',
      headerBorder: 'border-accent',
      emptyText: 'No tasks completed yet.',
    },
  }[status];

  return (
    <div className="flex-1 flex flex-col min-w-[290px] max-w-full bg-surface-2 border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-4 py-3.5 bg-surface border-b ${columnConfig.headerBorder}`}
      >
        <div className="flex items-center gap-2">
          {columnConfig.icon}
          <h2 className="text-sm font-bold text-text tracking-wide">{title}</h2>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold border ${columnConfig.badge}`}
          >
            {tasks.length}
          </span>
        </div>

        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            title="Add task to To Do"
            className="p-1 text-text-secondary hover:text-accent hover:bg-surface-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cards Scroll Container */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[320px]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4 border border-dashed border-border rounded-xl text-text-muted text-xs">
            <p>{columnConfig.emptyText}</p>
            {status === 'todo' && onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                className="mt-2 text-xs font-semibold text-accent hover:text-accent transition"
              >
                + Create a task
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              selectedDate={selectedDate}
              onClick={() => onTaskClick(task)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task)}
              onStart={() => onStartTask(task)}
              onPause={() => onPauseTask?.(task)}
              onResume={() => onResumeTask?.(task)}
              onComplete={() => onCompleteTask(task)}
              onRevertToInProgress={() => onRevertToInProgress(task)}
              onRevertToTodo={() => onRevertToTodo(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}
