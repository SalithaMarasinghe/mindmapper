import { Search, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import type { TaskPriority } from '../../types';
import type { TaskSortField } from '../../store/taskStore';

interface TaskFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  priorityFilter: 'all' | TaskPriority;
  onPriorityFilterChange: (p: 'all' | TaskPriority) => void;
  sortBy: TaskSortField;
  onSortByChange: (s: TaskSortField) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  includePastUnfinished: boolean;
  onToggleIncludePast: (include: boolean) => void;
}

export function TaskFilterBar({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  includePastUnfinished,
  onToggleIncludePast,
}: TaskFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface border-b border-border text-xs">
      {/* Left: Search input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          type="text"
          placeholder="Filter tasks by title or markdown description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-bg text-text border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent placeholder:text-text-muted transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
          >
            ×
          </button>
        )}
      </div>

      {/* Middle & Right: Filters and Sort controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-bg p-0.5 rounded-lg border border-border">
          <span className="px-2 text-text-muted text-[11px] font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3" /> Priority:
          </span>
          {(['all', 'high', 'medium', 'low'] as const).map((p) => {
            const active = priorityFilter === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPriorityFilterChange(p)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${
                  active
                    ? 'bg-surface text-accent shadow-sm border border-border'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1 bg-bg px-2 py-0.5 rounded-lg border border-border">
          <ArrowUpDown className="w-3 h-3 text-text-muted" />
          <span className="text-[11px] text-text-muted font-semibold">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as TaskSortField)}
            className="bg-transparent text-text-secondary text-[11px] font-semibold focus:outline-none cursor-pointer py-1 pr-1"
          >
            <option value="order" className="bg-surface">Custom / Order</option>
            <option value="created_at" className="bg-surface">Created Time</option>
            <option value="planned_date" className="bg-surface">Planned Date</option>
            <option value="priority" className="bg-surface">Priority</option>
            <option value="started_at" className="bg-surface">Started Time</option>
            <option value="duration" className="bg-surface">Duration</option>
            <option value="title" className="bg-surface">Title (A-Z)</option>
          </select>
          <button
            type="button"
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'} (click to flip)`}
            className="p-1 text-text-secondary hover:text-accent rounded transition"
          >
            {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Include Past Unfinished Tasks Toggle */}
        <label className="flex items-center gap-2 text-text-secondary hover:text-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePastUnfinished}
            onChange={(e) => onToggleIncludePast(e.target.checked)}
            className="rounded bg-bg border-border text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px]">Include past unfinished</span>
        </label>
      </div>
    </div>
  );
}
