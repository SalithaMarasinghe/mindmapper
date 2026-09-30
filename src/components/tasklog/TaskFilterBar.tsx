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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#161b26] border-b border-[#2d3748] text-xs">
      {/* Left: Search input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter tasks by title or markdown description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#0f1117] text-slate-200 border border-[#2d3748] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 placeholder:text-slate-500 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        )}
      </div>

      {/* Middle & Right: Filters and Sort controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-[#0f1117] p-0.5 rounded-lg border border-[#2d3748]">
          <span className="px-2 text-slate-500 text-[11px] font-semibold flex items-center gap-1">
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
                    ? 'bg-[#1e2433] text-teal-300 shadow-sm border border-[#2d3748]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1 bg-[#0f1117] px-2 py-0.5 rounded-lg border border-[#2d3748]">
          <ArrowUpDown className="w-3 h-3 text-slate-500" />
          <span className="text-[11px] text-slate-500 font-semibold">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as TaskSortField)}
            className="bg-transparent text-slate-300 text-[11px] font-semibold focus:outline-none cursor-pointer py-1 pr-1"
          >
            <option value="order" className="bg-[#1e2433]">Custom / Order</option>
            <option value="created_at" className="bg-[#1e2433]">Created Time</option>
            <option value="planned_date" className="bg-[#1e2433]">Planned Date</option>
            <option value="priority" className="bg-[#1e2433]">Priority</option>
            <option value="started_at" className="bg-[#1e2433]">Started Time</option>
            <option value="duration" className="bg-[#1e2433]">Duration</option>
            <option value="title" className="bg-[#1e2433]">Title (A-Z)</option>
          </select>
          <button
            type="button"
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'} (click to flip)`}
            className="p-1 text-slate-400 hover:text-teal-300 rounded transition"
          >
            {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Include Past Unfinished Tasks Toggle */}
        <label className="flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePastUnfinished}
            onChange={(e) => onToggleIncludePast(e.target.checked)}
            className="rounded bg-[#0f1117] border-[#2d3748] text-teal-600 focus:ring-teal-500 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px]">Include past unfinished</span>
        </label>
      </div>
    </div>
  );
}
