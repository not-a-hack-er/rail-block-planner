import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import type { MaintenanceTask, PlanItemResponse, Department } from '../../types';
import { SeverityBadge, RiskBadge, DeptBadge, ScoreBar, OverdueBadge } from '../ui/Badges';
import { formatDate, durationLabel, daysUntilDue, isOverdue } from '../../utils';
import { EmptyState } from '../ui/StateComponents';
import { clsx } from '../../utils/clsx';

interface TaskTableProps {
  tasks: MaintenanceTask[];
  planItems?: PlanItemResponse[];
  onSelectTask: (task: MaintenanceTask) => void;
  selectedTaskId?: number;
}

type SortField = 'criticality_score' | 'severity' | 'due_by' | 'estimated_minutes';
type SortDir = 'asc' | 'desc';

export function TaskTable({ tasks, planItems = [], onSelectTask, selectedTaskId }: TaskTableProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<Department | ''>('');
  const [severityFilter, setSeverityFilter] = useState<number | ''>('');
  const [scheduledFilter, setScheduledFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [sortField, setSortField] = useState<SortField>('criticality_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const scheduledIds = useMemo(() => new Set(planItems.map(i => i.task_id)), [planItems]);

  const filtered = useMemo(() => {
    let result = tasks;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.external_id.toLowerCase().includes(q) ||
        t.asset_id.toLowerCase().includes(q) ||
        t.defect_type.toLowerCase().includes(q) ||
        t.section_id.toLowerCase().includes(q)
      );
    }

    if (deptFilter) result = result.filter(t => t.department === deptFilter);
    if (severityFilter) result = result.filter(t => t.severity === severityFilter);
    if (scheduledFilter === 'scheduled') result = result.filter(t => scheduledIds.has(t.id));
    if (scheduledFilter === 'unscheduled') result = result.filter(t => !scheduledIds.has(t.id));

    return [...result].sort((a, b) => {
      let av = (a[sortField] ?? 0) as number;
      let bv = (b[sortField] ?? 0) as number;
      if (sortField === 'due_by') {
        av = new Date(a.due_by).getTime();
        bv = new Date(b.due_by).getTime();
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [tasks, search, deptFilter, severityFilter, scheduledFilter, sortField, sortDir, scheduledIds]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="opacity-20">↕</span>;
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 w-52"
          />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value as Department | '')} className="select w-40">
          <option value="">All Departments</option>
          <option value="ENGG">Engineering</option>
          <option value="TRD">Traction (TRD)</option>
          <option value="ST">Signal & Telecom</option>
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value ? Number(e.target.value) : '')} className="select w-36">
          <option value="">All Severities</option>
          <option value="5">5 — Critical</option>
          <option value="4">4 — High</option>
          <option value="3">3 — Medium</option>
          <option value="2">2 — Low</option>
          <option value="1">1 — Minimal</option>
        </select>
        <select value={scheduledFilter} onChange={e => setScheduledFilter(e.target.value as typeof scheduledFilter)} className="select w-36">
          <option value="all">All Tasks</option>
          <option value="scheduled">Scheduled</option>
          <option value="unscheduled">Unscheduled</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Dept.</th>
                <th>Asset / Section</th>
                <th>Defect</th>
                <th>Severity</th>
                <th className="cursor-pointer hover:text-gray-200" onClick={() => toggleSort('criticality_score')}>
                  <span className="flex items-center gap-1">Score <SortIcon field="criticality_score" /></span>
                </th>
                <th className="cursor-pointer hover:text-gray-200" onClick={() => toggleSort('estimated_minutes')}>
                  <span className="flex items-center gap-1">Duration <SortIcon field="estimated_minutes" /></span>
                </th>
                <th className="cursor-pointer hover:text-gray-200" onClick={() => toggleSort('due_by')}>
                  <span className="flex items-center gap-1">Due By <SortIcon field="due_by" /></span>
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-0">
                    <EmptyState title="No tasks found" description="Adjust your filters or add tasks via the seed button." />
                  </td>
                </tr>
              ) : (
                filtered.map(task => {
                  const isScheduled = scheduledIds.has(task.id);
                  const days = daysUntilDue(task);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={clsx(
                        selectedTaskId === task.id && 'bg-rail-blue/10 border-l-2 border-rail-blue'
                      )}
                    >
                      <td className="font-mono text-xs text-gray-300">{task.external_id}</td>
                      <td><DeptBadge dept={task.department} /></td>
                      <td>
                        <div className="text-xs font-medium text-gray-200">{task.asset_id}</div>
                        <div className="text-[10px] text-gray-500">{task.section_id}</div>
                      </td>
                      <td className="text-xs max-w-[140px] truncate">{task.defect_type}</td>
                      <td><SeverityBadge severity={task.severity} /></td>
                      <td className="w-28">
                        {task.criticality_score !== null ? (
                          <ScoreBar score={task.criticality_score} />
                        ) : '—'}
                      </td>
                      <td className="text-xs font-tabular">{durationLabel(task.estimated_minutes)}</td>
                      <td>
                        <div className="text-xs text-gray-300">{formatDate(task.due_by)}</div>
                        <OverdueBadge daysUntil={days} />
                      </td>
                      <td>
                        {isScheduled ? (
                          <span className="badge-green text-[10px]">Scheduled</span>
                        ) : (
                          <span className="badge-gray text-[10px]">Pending</span>
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
    </div>
  );
}
