import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange, Play, Plus, X, ChevronDown, CheckCircle2, XCircle,
  Cpu, Clock, Info, Lock, ThumbsUp, Send, AlertTriangle, Layers
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { createWindow } from '../api/windows';
import { generatePlan, getPlan, getLatestPlanId, savePlanIdToHistory, approvePlan, publishPlan } from '../api/plans';
import { listTasks } from '../api/tasks';
import { OptimizationProgress } from '../components/plans/OptimizationProgress';
import { StatusBadge, DeptBadge, ScoreBar } from '../components/ui/Badges';
import { LoadingState, ErrorState, EmptyState, AlertBanner } from '../components/ui/StateComponents';
import { formatDateTime, durationLabel, uniqueSections } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../api/client';
import type { PlanHorizon, WindowCreate, PlanResponse } from '../types';
import { CorridorTimeline } from '../components/timeline/CorridorTimeline';
import { clsx } from '../utils/clsx';

type OptSteps = Array<{ label: string; status: 'pending' | 'running' | 'done' | 'error' }>;

const INITIAL_STEPS: OptSteps = [
  { label: 'Loading maintenance tasks', status: 'pending' },
  { label: 'Filtering tasks by planning horizon', status: 'pending' },
  { label: 'Loading block windows', status: 'pending' },
  { label: 'Running CP-SAT constraint solver', status: 'pending' },
  { label: 'Applying section-match constraints', status: 'pending' },
  { label: 'Applying crew conflict constraints', status: 'pending' },
  { label: 'Maximizing priority coverage', status: 'pending' },
  { label: 'Generating recommended plan', status: 'pending' },
];

export function BlockPlannerPage() {
  const qc = useQueryClient();
  const { canApprove, canPublish } = useAuth();

  // Form state
  const [horizon, setHorizon] = useState<PlanHorizon>('WEEK');
  const [startsAt, setStartsAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endsAt, setEndsAt] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));
  const [solverSecs, setSolverSecs] = useState(10);

  // Window form
  const [showWindowForm, setShowWindowForm] = useState(false);
  const [windows, setWindows] = useState<Array<WindowCreate & { tempId: string }>>([]);
  const [wForm, setWForm] = useState<WindowCreate>({
    external_id: '',
    section_id: '',
    start_at: format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd'T'01:00"),
    end_at: format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd'T'03:00"),
    traffic_load: 10,
    caution_ok: true,
  });

  // Optimization state
  const [steps, setSteps] = useState<OptSteps>(INITIAL_STEPS);
  const [optError, setOptError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [infeasible, setInfeasible] = useState(false);

  // Load tasks
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: listTasks });

  // Latest plan (for reference)
  const latestPlanId = getLatestPlanId();
  const { data: latestPlan } = useQuery({
    queryKey: ['plan', latestPlanId],
    queryFn: () => getPlan(latestPlanId!),
    enabled: latestPlanId !== null && !plan,
  });

  const displayPlan = plan ?? latestPlan;

  // Window creation mutation
  const createWindowMut = useMutation({
    mutationFn: createWindow,
    onSuccess: (data) => {
      setWindows(prev => [...prev, { ...wForm, tempId: String(data.id) }]);
      setWForm(f => ({
        ...f,
        external_id: `COA-${Date.now()}`,
      }));
    },
  });

  const handleAddWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wForm.external_id || !wForm.section_id) return;
    try {
      await createWindowMut.mutateAsync(wForm);
    } catch (err) {
      setOptError(getApiErrorMessage(err));
    }
  };

  // Optimization
  const stepDone = (idx: number) => {
    setSteps(prev => prev.map((s, i) => i < idx ? { ...s, status: 'done' } : i === idx ? { ...s, status: 'running' } : s));
  };

  const allDone = () => setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));

  const runOptimization = async () => {
    setOptError(null);
    setInfeasible(false);
    setPlan(null);
    setIsOptimizing(true);
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending' })));

    try {
      // Animate steps
      for (let i = 0; i < 4; i++) {
        stepDone(i);
        await new Promise(r => setTimeout(r, 400));
      }

      const result = await generatePlan({
        horizon,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        max_solver_seconds: solverSecs,
      });

      for (let i = 4; i < INITIAL_STEPS.length; i++) {
        stepDone(i);
        await new Promise(r => setTimeout(r, 300));
      }
      allDone();

      if (result.scheduled_count === 0 && result.items.length === 0) {
        setInfeasible(true);
      } else {
        setPlan(result);
        savePlanIdToHistory(result.id);
        qc.invalidateQueries({ queryKey: ['tasks'] });
      }
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setOptError(msg);
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
    } finally {
      setIsOptimizing(false);
    }
  };

  // Approve/publish
  const approveMut = useMutation({
    mutationFn: (id: number) => approvePlan(id, {}),
    onSuccess: (updated) => setPlan(updated),
  });

  const publishMut = useMutation({
    mutationFn: (id: number) => publishPlan(id),
    onSuccess: (updated) => setPlan(updated),
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <CalendarRange size={20} className="text-rail-blue" />
          AI Block Planner
        </h1>
        <p className="page-subtitle mt-1">
          Generate a constraint-optimized maintenance block plan that minimizes operational disruption.
          The CP-SAT solver assigns tasks to low-traffic windows, respecting section and crew constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* ─── Left: controls ─────────────────────────── */}
        <div className="space-y-4">
          {/* Planning parameters */}
          <div className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Cpu size={14} className="text-rail-blue" />
              Planning Parameters
            </h3>
            <div>
              <label className="label">Horizon</label>
              <div className="flex gap-2">
                {(['WEEK', 'MONTH'] as PlanHorizon[]).map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={clsx('btn text-xs flex-1', horizon === h ? 'btn-primary' : 'btn-secondary')}
                  >
                    {h === 'WEEK' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Starts At</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Ends At</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Solver Time Limit: {solverSecs}s</label>
              <input
                type="range" min={1} max={60} value={solverSecs}
                onChange={e => setSolverSecs(Number(e.target.value))}
                className="w-full accent-rail-blue"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>1s (fast)</span><span>60s (thorough)</span>
              </div>
            </div>

            <button
              onClick={runOptimization}
              disabled={isOptimizing || windows.length === 0}
              className="btn-primary w-full justify-center gap-2"
            >
              <Play size={14} />
              {isOptimizing ? 'Optimizing…' : 'RUN OPTIMIZATION'}
            </button>
            {windows.length === 0 && (
              <p className="text-[11px] text-rail-amber flex items-center gap-1.5">
                <AlertTriangle size={11} />
                Add block windows below before running
              </p>
            )}
          </div>

          {/* Block windows */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                Block Windows
                <span className="badge-blue text-[10px]">{windows.length}</span>
              </h3>
              <button onClick={() => setShowWindowForm(v => !v)} className="btn-secondary text-xs py-1 px-2">
                <Plus size={12} />
                Add
              </button>
            </div>

            {showWindowForm && (
              <form onSubmit={handleAddWindow} className="space-y-3 p-3 bg-navy-900 rounded border border-surface-border animate-slide-up">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">ID</label>
                    <input className="input" value={wForm.external_id} onChange={e => setWForm(f => ({ ...f, external_id: e.target.value }))} placeholder="COA-901" required />
                  </div>
                  <div>
                    <label className="label">Section</label>
                    <input className="input" value={wForm.section_id} onChange={e => setWForm(f => ({ ...f, section_id: e.target.value }))} placeholder="NDLS-GZB-UP" list="sections-list" required />
                    <datalist id="sections-list">
                      {uniqueSections(tasks).map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="label">Start</label>
                  <input type="datetime-local" className="input" value={wForm.start_at} onChange={e => setWForm(f => ({ ...f, start_at: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">End</label>
                  <input type="datetime-local" className="input" value={wForm.end_at} onChange={e => setWForm(f => ({ ...f, end_at: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Traffic Load (0–100)</label>
                    <input type="number" min={0} max={100} className="input" value={wForm.traffic_load} onChange={e => setWForm(f => ({ ...f, traffic_load: Number(e.target.value) }))} />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={wForm.caution_ok} onChange={e => setWForm(f => ({ ...f, caution_ok: e.target.checked }))} className="accent-rail-blue" />
                      Caution OK
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={createWindowMut.isPending} className="btn-primary text-xs flex-1 justify-center">
                    {createWindowMut.isPending ? 'Creating…' : 'Add Window'}
                  </button>
                  <button type="button" onClick={() => setShowWindowForm(false)} className="btn-secondary text-xs px-3">Cancel</button>
                </div>
                {createWindowMut.isError && (
                  <p className="text-xs text-rail-red">{getApiErrorMessage(createWindowMut.error)}</p>
                )}
              </form>
            )}

            {windows.length === 0 ? (
              <EmptyState title="No windows added" description="Add available block windows before running the optimizer" icon="search" />
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {windows.map(w => (
                  <div key={w.tempId} className="flex items-start justify-between p-2.5 bg-navy-900 rounded border border-surface-border/50 text-xs">
                    <div>
                      <p className="font-medium text-gray-200 font-mono">{w.external_id}</p>
                      <p className="text-gray-500">{w.section_id}</p>
                      <p className="text-gray-600">{new Date(w.start_at).toLocaleTimeString()} → {new Date(w.end_at).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="badge-gray">Load: {w.traffic_load}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: results ─────────────────────────── */}
        <div className="space-y-4">
          {/* Progress */}
          {(isOptimizing || optError || infeasible || steps.some(s => s.status !== 'pending')) && steps.some(s => s.status !== 'pending') && (
            <OptimizationProgress
              steps={steps}
              isRunning={isOptimizing}
              error={optError}
              infeasible={infeasible}
            />
          )}

          {/* Plan result */}
          {displayPlan && !isOptimizing && !optError && !infeasible && (
            <PlanResultPanel
              plan={displayPlan}
              tasks={tasks}
              canApprove={canApprove}
              canPublish={canPublish}
              onApprove={() => approveMut.mutate(displayPlan.id)}
              onPublish={() => publishMut.mutate(displayPlan.id)}
              approving={approveMut.isPending}
              publishing={publishMut.isPending}
            />
          )}

          {/* Corridor timeline of result */}
          {displayPlan && tasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-200">Scheduled Block Timeline</h3>
              <CorridorTimeline tasks={tasks} planItems={displayPlan.items} />
            </div>
          )}

          {/* Empty */}
          {!displayPlan && !isOptimizing && !optError && !infeasible && (
            <div className="card">
              <EmptyState
                title="No plan generated yet"
                description="Add block windows and run the optimizer to generate a recommended maintenance block plan."
                icon="search"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanResultPanel({
  plan, tasks, canApprove, canPublish, onApprove, onPublish, approving, publishing
}: {
  plan: PlanResponse;
  tasks: any[];
  canApprove: boolean;
  canPublish: boolean;
  onApprove: () => void;
  onPublish: () => void;
  approving: boolean;
  publishing: boolean;
}) {
  const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
  const sections = [...new Set(plan.items.map(i => taskMap.get(i.task_id)?.section_id).filter(Boolean))];

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="card p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-rail-green" />
              <h3 className="text-sm font-bold text-gray-200">Recommended Block Plan #{plan.id}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <StatusBadge status={plan.status} />
              <span>{plan.horizon} plan</span>
              <span>v{plan.version}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canApprove && plan.status === 'DRAFT' && (
              <button onClick={onApprove} disabled={approving} className="btn-success text-xs">
                <ThumbsUp size={12} />
                {approving ? 'Approving…' : 'Approve'}
              </button>
            )}
            {canPublish && plan.status === 'APPROVED' && (
              <button onClick={onPublish} disabled={publishing} className="btn-primary text-xs">
                <Send size={12} />
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Metric label="Scheduled" value={plan.scheduled_count} color="green" />
          <Metric label="Unscheduled" value={plan.unscheduled_task_ids.length} color={plan.unscheduled_task_ids.length > 0 ? 'amber' : 'green'} />
          <Metric label="Sections" value={sections.length} color="blue" />
        </div>

        {plan.unscheduled_task_ids.length > 0 && (
          <div className="mt-3 alert-warning">
            <AlertTriangle size={13} className="text-rail-amber mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-300">
              {plan.unscheduled_task_ids.length} task{plan.unscheduled_task_ids.length > 1 ? 's' : ''} could not be scheduled.
              Add more block windows or extend the planning horizon.
            </p>
          </div>
        )}
      </div>

      {/* Consolidation view */}
      {sections.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-rail-purple" />
            <h3 className="text-sm font-semibold text-gray-200">Multi-Department Consolidation</h3>
          </div>
          <p className="text-xs text-gray-500">
            Tasks from different departments assigned to the same section window represent consolidated possessions.
          </p>
          {sections.map((sectionId: any) => {
            const sectionItems = plan.items.filter(i => taskMap.get(i.task_id)?.section_id === sectionId);
            const depts = [...new Set(sectionItems.map(i => taskMap.get(i.task_id)?.department).filter(Boolean))];
            return (
              <div key={sectionId} className="p-3 bg-navy-900 rounded border border-surface-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-300">{sectionId}</span>
                  {depts.length > 1 && (
                    <span className="badge-purple text-[10px]">{depts.length} departments</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sectionItems.map(item => {
                    const task = taskMap.get(item.task_id);
                    if (!task) return null;
                    return (
                      <div key={item.task_id} className="flex items-center gap-2 text-xs bg-surface p-2 rounded">
                        <DeptBadge dept={task.department} />
                        <span className="text-gray-300 font-mono">{task.external_id}</span>
                        <span className="text-gray-500">{durationLabel(task.estimated_minutes)}</span>
                      </div>
                    );
                  })}
                </div>
                {depts.length > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-rail-green">
                    <CheckCircle2 size={11} />
                    {sectionItems.length} tasks consolidated → 1 possession block
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plan items */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
          <Info size={13} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-200">Scheduled Items</h3>
        </div>
        <div className="divide-y divide-surface-border/50">
          {plan.items.map(item => {
            const task = taskMap.get(item.task_id);
            return (
              <div key={item.task_id} className="px-4 py-3 hover:bg-surface-raised/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task && <DeptBadge dept={task.department} />}
                      <span className="text-xs font-mono text-gray-300">{task?.external_id ?? `Task #${item.task_id}`}</span>
                      {task?.criticality_score !== undefined && (
                        <span className="text-xs text-gray-500">Score: {task.criticality_score}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{task?.defect_type} · {task?.section_id}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">{item.rationale}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-200">{formatDateTime(item.start_at)}</p>
                    <p className="text-xs text-gray-500">→ {formatDateTime(item.end_at)}</p>
                    {task && <p className="text-[10px] text-gray-600 mt-0.5">{durationLabel(task.estimated_minutes)}</p>}
                  </div>
                </div>
              </div>
            );
          })}
          {plan.items.length === 0 && (
            <div className="py-6">
              <EmptyState title="No items in plan" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = { green: '#10b981', amber: '#f59e0b', blue: '#3b82f6', red: '#ef4444' };
  return (
    <div className="bg-navy-900 rounded p-3 text-center">
      <div className="text-2xl font-bold font-tabular" style={{ color: colors[color] }}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
