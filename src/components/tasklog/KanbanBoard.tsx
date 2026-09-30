import type { WorkTask } from '../../types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  tasks: WorkTask[];
  selectedDate: string;
  onAddTask: () => void;
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

export function KanbanBoard({
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
}: KanbanBoardProps) {
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-x-auto min-h-0 pb-4">
      <KanbanColumn
        status="todo"
        title="To Do"
        tasks={todoTasks}
        selectedDate={selectedDate}
        onAddTask={onAddTask}
        onTaskClick={onTaskClick}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        onStartTask={onStartTask}
        onPauseTask={onPauseTask}
        onResumeTask={onResumeTask}
        onCompleteTask={onCompleteTask}
        onRevertToInProgress={onRevertToInProgress}
        onRevertToTodo={onRevertToTodo}
      />

      <KanbanColumn
        status="in_progress"
        title="In Progress"
        tasks={inProgressTasks}
        selectedDate={selectedDate}
        onTaskClick={onTaskClick}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        onStartTask={onStartTask}
        onPauseTask={onPauseTask}
        onResumeTask={onResumeTask}
        onCompleteTask={onCompleteTask}
        onRevertToInProgress={onRevertToInProgress}
        onRevertToTodo={onRevertToTodo}
      />

      <KanbanColumn
        status="done"
        title="Done"
        tasks={doneTasks}
        selectedDate={selectedDate}
        onTaskClick={onTaskClick}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        onStartTask={onStartTask}
        onPauseTask={onPauseTask}
        onResumeTask={onResumeTask}
        onCompleteTask={onCompleteTask}
        onRevertToInProgress={onRevertToInProgress}
        onRevertToTodo={onRevertToTodo}
      />
    </div>
  );
}
