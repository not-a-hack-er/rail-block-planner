import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Search, X, RefreshCw } from 'lucide-react';
import { listTasks, createTask } from '../api/tasks';
import { getPlan, getLatestPlanId } from '../api/plans';
import { TaskTable } from '../components/tasks/TaskTable';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer';
import { LoadingState, ErrorState } from '../components/ui/StateComponents';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../api/client';
import { isOverdue } from '../utils';
import { format, addDays } from 'date-fns';
import { clsx } from '../utils/clsx';
import type { MaintenanceTask, PlanItemResponse, Department } from '../types';

type SortKey = 'score' | 'severity' | 'due_by' | 'raised_on';
type DeptFilter = 'ALL' | Department;
type SevFilter = 'ALL' | '5' | '4' | '3' | '2' | '1';

const SECTION_OPTIONS = ['NDLS-GZB-UP', 'GZB-NDLS-DN', 'GZB-ALJN-UP', 'ALJN-TDL-UP', 'TDL-CNB-UP'];

export function MaintenancePage() {
  const qc = useQueryClient();
  const { isPlanner } = useAuth();

  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('ALL');
  const [sevFilter, setSevFilter] = useState<SevFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState('');
  const [addForm, setAddForm] = useState({
    external_id: 'TMS-' + Math.floor(1000 + Math.random() * 9000),
    department: 'ENGG' as Department,
    source: 'TMS',
    asset_id: '',
    section_id: 'NDLS-GZB-UP',
    defect_type: '',
    severity: 3,
    raised_on: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    due_by: format(addDays(new Date(), 3), "yyyy-MM-dd'T'HH:mm"),
    estimated_minutes: 60,
    crew_id: '',
    traffic_density: 60,
    failure_history: 10,
  });

  const { data: tasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const latestPlanId = getLatestPlanId();
  const { data: plan } = useQuery({
    queryKey: ['plan', latestPlanId],
    queryFn: () => getPlan(latestPlanId!),
    enabled: latestPlanId !== null,
  });
  const planItems: PlanItemResponse[] = plan?.items ?? [];

  const addMut = useMutation({
    mutationFn: () => createTask({
      ...addForm,
      raised_on: new Date(addForm.raised_on).toISOString(),
      due_by: new Date(addForm.due_by).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowAddModal(false);
      setAddError('');
    },
    onError: (err) => setAddError(getApiErrorMessage(err)),
  });

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (deptFilter !== 'ALL') result = result.filter(t => t.department === deptFilter);
    if (sevFilter !== 'ALL') result = result.filter(t => t.severity === parseInt(sevFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.external_id.toLowerCase().includes(q) ||
        t.defect_type.toLowerCase().includes(q) ||
        t.asset_id.toLowerCase().includes(q) ||
        t.section_id.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortKey === 'score') return (b.criticality_score ?? 0) - (a.criticality_score ?? 0);
      if (sortKey === 'severity') return b.severity - a.severity;
      if (sortKey === 'due_by') return new Date(a.due_by).getTime() - new Date(b.due_by).getTime();
      return new Date(b.raised_on).getTime() - new Date(a.raised_on).getTime();
    });
    return result;
  }, [tasks, deptFilter, sevFilter, search, sortKey]);

  const selectedPlanItem = selectedTask ? planItems.find(i => i.task_id === selectedTask.id) : undefined;

  if (isLoading) return <div className="p-8"><LoadingState label="Loading maintenance tasks…" /></div>;
  if (error) return <div className="p-8"><ErrorState message="Failed to load maintenance tasks from backend." /></div>;

  const overdueCnt = tasks.filter(t => isOverdue(t)).length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between border-b border-surface-border pb-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wrench size={20} className="text-rail-blue" />
            Maintenance Task Manager
          </h1>
          <p className="page-subtitle mt-1">
            {tasks.length} tasks · ordered by AI-computed criticality score · auto-refreshes every 60s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPlanner && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs gap-1.5 py-2 font-bold">
              <Plus size={13} /> Add Task
            </button>
          )}
          <button onClick={() => refetch()} className="btn-icon" title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <SummaryCard label="Engineering (ENGG)" count={tasks.filter(t => t.department === 'ENGG').length} color="#3b82f6" />
        <SummaryCard label="Signal & Telecom (ST)" count={tasks.filter(t => t.department === 'ST').length} color="#8b5cf6" />
        <SummaryCard label="Traction (TRD)" count={tasks.filter(t => t.department === 'TRD').length} color="#f59e0b" />
        <SummaryCard label="Critical (Sev 5)" count={tasks.filter(t => t.severity === 5).length} color="#ef4444" />
        <SummaryCard label="Overdue Tasks" count={overdueCnt} color={overdueCnt > 0 ? '#ef4444' : '#10b981'} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by ID, defect, asset, section…"
            className="input pl-8 text-xs py-1.5"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="flex gap-1">
          {(['ALL', 'ENGG', 'ST', 'TRD'] as DeptFilter[]).map(d => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={clsx(
                'text-[10px] px-2.5 py-1.5 rounded font-bold border transition-all',
                deptFilter === d
                  ? 'bg-rail-blue text-white border-rail-blue'
                  : 'border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500'
              )}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['ALL', '5', '4', '3'] as SevFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={clsx(
                'text-[10px] px-2.5 py-1.5 rounded font-bold border transition-all',
                sevFilter === s
                  ? 'bg-surface-subtle text-gray-100 border-gray-500'
                  : 'border-surface-border text-gray-500 hover:text-gray-300'
              )}
            >
              {s === 'ALL' ? 'All Sev' : 'Sev ' + s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-500">Sort:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="bg-navy-800 border border-surface-border rounded px-2 py-1 text-[10px] text-gray-300"
          >
            <option value="score">AI Score</option>
            <option value="severity">Severity</option>
            <option value="due_by">Due Date</option>
            <option value="raised_on">Created</option>
          </select>
          <span className="text-[10px] text-gray-500">{filteredTasks.length} shown</span>
        </div>
      </div>

      <TaskTable tasks={filteredTasks} planItems={planItems} onSelectTask={setSelectedTask} selectedTaskId={selectedTask?.id} />

      <TaskDetailDrawer task={selectedTask} planItem={selectedPlanItem} onClose={() => setSelectedTask(null)} />

      {showAddModal && (
        <div className="drawer-overlay flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-surface-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="font-bold text-gray-100 flex items-center gap-2"><Wrench size={16} className="text-rail-blue" /> Add Maintenance Task</h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Task ID</label><input className="input text-xs" value={addForm.external_id} onChange={e => setAddForm(f => ({ ...f, external_id: e.target.value }))} /></div>
              <div>
                <label className="label">Department</label>
                <select className="select text-xs" value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value as Department }))}>
                  <option value="ENGG">Engineering (ENGG)</option>
                  <option value="ST">Signal & Telecom (ST)</option>
                  <option value="TRD">Traction (TRD)</option>
                </select>
              </div>
              <div><label className="label">Asset ID</label><input className="input text-xs" placeholder="e.g. TRACK-77" value={addForm.asset_id} onChange={e => setAddForm(f => ({ ...f, asset_id: e.target.value }))} /></div>
              <div>
                <label className="label">Section</label>
                <select className="select text-xs" value={addForm.section_id} onChange={e => setAddForm(f => ({ ...f, section_id: e.target.value }))}>
                  {SECTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Defect Type</label><input className="input text-xs" placeholder="e.g. Rail Crack, OHE Tension Loss…" value={addForm.defect_type} onChange={e => setAddForm(f => ({ ...f, defect_type: e.target.value }))} /></div>
              <div>
                <label className="label">Severity (1-5)</label>
                <select className="select text-xs" value={addForm.severity} onChange={e => setAddForm(f => ({ ...f, severity: parseInt(e.target.value) }))}>
                  {[5, 4, 3, 2, 1].map(s => <option key={s} value={s}>{s} — {s === 5 ? 'Critical' : s === 4 ? 'High' : s === 3 ? 'Medium' : 'Low'}</option>)}
                </select>
              </div>
              <div><label className="label">Est. Minutes</label><input type="number" className="input text-xs" value={addForm.estimated_minutes} onChange={e => setAddForm(f => ({ ...f, estimated_minutes: parseInt(e.target.value) || 0 }))} /></div>
              <div><label className="label">Raised On</label><input type="datetime-local" className="input text-xs" value={addForm.raised_on} onChange={e => setAddForm(f => ({ ...f, raised_on: e.target.value }))} /></div>
              <div><label className="label">Due By</label><input type="datetime-local" className="input text-xs" value={addForm.due_by} onChange={e => setAddForm(f => ({ ...f, due_by: e.target.value }))} /></div>
              <div><label className="label">Crew ID (optional)</label><input className="input text-xs" placeholder="e.g. ENGG-CREW-1" value={addForm.crew_id} onChange={e => setAddForm(f => ({ ...f, crew_id: e.target.value }))} /></div>
              <div>
                <label className="label">Traffic Density (0-100)</label>
                <input type="range" min={0} max={100} value={addForm.traffic_density} onChange={e => setAddForm(f => ({ ...f, traffic_density: parseInt(e.target.value) }))} className="w-full accent-rail-blue mt-1" />
                <div className="text-[10px] text-rail-blue font-bold text-right">{addForm.traffic_density}%</div>
              </div>
            </div>
            {addError && <p className="text-xs text-rail-red">{addError}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => addMut.mutate()} disabled={addMut.isPending || !addForm.defect_type || !addForm.asset_id} className="btn-primary flex-1 justify-center text-xs font-bold py-2">
                {addMut.isPending ? 'Creating…' : 'Create Task'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="btn-secondary text-xs px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="card p-3 flex items-center gap-3 hover:bg-surface-raised transition-colors">
      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <div className="text-xl font-bold font-tabular text-gray-100">{count}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}
