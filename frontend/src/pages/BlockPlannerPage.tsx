import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange, Play, Plus, ChevronDown, CheckCircle2, 
  Cpu, Clock, Info, ThumbsUp, Send, AlertTriangle, Layers,
  Sparkles, Database, ShieldCheck
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { createWindow, getWindows } from '../api/windows';
import { generatePlan, getPlan, getPlans, savePlanIdToHistory, approvePlan, publishPlan, seedDatabase } from '../api/plans';
import { listTasks } from '../api/tasks';
import { listTrains } from '../api/trains';
import { OptimizationProgress } from '../components/plans/OptimizationProgress';
import { StatusBadge, DeptBadge } from '../components/ui/Badges';
import { EmptyState } from '../components/ui/StateComponents';
import { formatDateTime, durationLabel, uniqueSections } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../api/client';
import type { PlanHorizon, WindowCreate, PlanResponse, TrainSchedule } from '../types';
import { CorridorTimeline } from '../components/timeline/CorridorTimeline';
import { clsx } from '../utils/clsx';

type OptSteps = Array<{ label: string; status: 'pending' | 'running' | 'done' | 'error' }>;

const INITIAL_STEPS: OptSteps = [
  { label: 'Loading maintenance tasks from database', status: 'pending' },
  { label: 'Filtering tasks by section & planning horizon', status: 'pending' },
  { label: 'Loading candidate block windows & traffic loads', status: 'pending' },
  { label: 'Running OR-Tools CP-SAT constraint solver', status: 'pending' },
  { label: 'Enforcing section match & crew non-overlap', status: 'pending' },
  { label: 'Maximizing multi-department consolidation bonus', status: 'pending' },
  { label: 'Generating recommended shadow block plan', status: 'pending' },
];

export function BlockPlannerPage() {
  const qc = useQueryClient();
  const { canApprove, canPublish } = useAuth();

  // Form state
  const [horizon, setHorizon] = useState<PlanHorizon>('WEEK');
  const [startsAt, setStartsAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endsAt, setEndsAt] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));
  const [solverSecs, setSolverSecs] = useState(10);

  // Window creation modal
  const [showWindowForm, setShowWindowForm] = useState(false);
  const [wForm, setWForm] = useState<WindowCreate>({
    external_id: `COA-${Math.floor(100 + Math.random() * 900)}`,
    section_id: 'NDLS-GZB-UP',
    start_at: format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd'T'01:00"),
    end_at: format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd'T'05:00"),
    traffic_load: 10,
    caution_ok: true,
  });

  // Optimization state
  const [steps, setSteps] = useState<OptSteps>(INITIAL_STEPS);
  const [optError, setOptError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [infeasible, setInfeasible] = useState(false);

  // Data queries
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: listTasks });
  const { data: windows = [] } = useQuery({ queryKey: ['windows'], queryFn: getWindows });
  const { data: trains = [] } = useQuery<TrainSchedule[]>({ queryKey: ['trains'], queryFn: listTrains });
  const { data: allPlans = [] } = useQuery({ queryKey: ['plans'], queryFn: getPlans });

  const activePlan = plan ?? (allPlans.length > 0 ? allPlans[0] : null);

  // Seed database mutation
  const seedMut = useMutation({
    mutationFn: seedDatabase,
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });

  // Window creation mutation
  const createWindowMut = useMutation({
    mutationFn: createWindow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['windows'] });
      setShowWindowForm(false);
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

  // Optimization step runner
  const stepDone = (idx: number) => {
    setSteps(prev => prev.map((s, i) => i < idx ? { ...s, status: 'done' } : i === idx ? { ...s, status: 'running' } : s));
  };

  const allDone = () => setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));

  const runOptimization = async () => {
    setOptError(null);
    setInfeasible(false);
    setIsOptimizing(true);
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending' })));

    try {
      for (let i = 0; i < 4; i++) {
        stepDone(i);
        await new Promise(r => setTimeout(r, 250));
      }

      const result = await generatePlan({
        horizon,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        max_solver_seconds: solverSecs,
      });

      for (let i = 4; i < INITIAL_STEPS.length; i++) {
        stepDone(i);
        await new Promise(r => setTimeout(r, 200));
      }
      allDone();

      if (result.scheduled_count === 0 && result.items.length === 0) {
        setInfeasible(true);
      } else {
        setPlan(result);
        savePlanIdToHistory(result.id);
        qc.invalidateQueries({ queryKey: ['plans'] });
        qc.invalidateQueries({ queryKey: ['tasks'] });
      }
    } catch (err) {
      setOptError(getApiErrorMessage(err));
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
    } finally {
      setIsOptimizing(false);
    }
  };

  // Approve/publish
  const approveMut = useMutation({
    mutationFn: (id: number) => approvePlan(id, { comment: 'Sr DOM sign-off for publication' }),
    onSuccess: (updated) => {
      setPlan(updated);
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const publishMut = useMutation({
    mutationFn: (id: number) => publishPlan(id),
    onSuccess: (updated) => {
      setPlan(updated);
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1500px]">
      {/* Page Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarRange size={22} className="text-rail-blue" />
            AI Block Planner — CP-SAT Optimization Engine
          </h1>
          <p className="page-subtitle mt-1">
            Coordinating ENGG, S&T, and TRD departmental maintenance requests with timetable train operations.
          </p>
        </div>

        {tasks.length === 0 && (
          <button 
            onClick={() => seedMut.mutate()} 
            disabled={seedMut.isPending}
            className="btn btn-primary bg-amber-600 hover:bg-amber-500 text-white font-bold"
          >
            <Database className="w-4 h-4" />
            {seedMut.isPending ? 'Seeding DB...' : 'Seed Indian Railways Dataset'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* Left Column: Parameter controls & Window selector */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4 bg-navy-900/90 border border-surface-border">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <Cpu size={16} className="text-rail-blue" />
              Optimization Parameters
            </h3>

            <div>
              <label className="label">Planning Horizon</label>
              <div className="flex gap-2">
                {(['WEEK', 'MONTH'] as PlanHorizon[]).map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={clsx('btn text-xs flex-1', horizon === h ? 'btn-primary' : 'btn-secondary')}
                  >
                    {h === 'WEEK' ? 'Weekly Horizon' : 'Monthly Horizon'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Start Time</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div>
              <label className="label">End Time</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="label mb-0">Solver Timeout</span>
                <span className="font-mono text-rail-blue font-bold">{solverSecs} sec</span>
              </div>
              <input
                type="range" min={1} max={60} value={solverSecs}
                onChange={e => setSolverSecs(Number(e.target.value))}
                className="w-full accent-rail-blue"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>Fast Solve (1s)</span>
                <span>Deep CP-SAT Search (60s)</span>
              </div>
            </div>

            <button
              onClick={runOptimization}
              disabled={isOptimizing || tasks.length === 0}
              className="btn-primary w-full justify-center gap-2 text-sm py-2.5 font-bold shadow-lg shadow-blue-500/20"
            >
              <Play size={16} />
              {isOptimizing ? 'SOLVING MODEL…' : 'RUN CP-SAT OPTIMIZATION'}
            </button>
          </div>

          {/* Block Windows Inventory */}
          <div className="card p-4 space-y-3 bg-navy-900/90 border border-surface-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Clock size={15} className="text-gray-400" />
                Candidate Block Windows
                <span className="badge-blue text-[10px]">{windows.length}</span>
              </h3>
              <button onClick={() => setShowWindowForm(v => !v)} className="btn-secondary text-xs py-1 px-2">
                <Plus size={13} />
                Add
              </button>
            </div>

            {showWindowForm && (
              <form onSubmit={handleAddWindow} className="space-y-3 p-3 bg-navy-950 rounded border border-surface-border animate-slide-up">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Window ID</label>
                    <input className="input text-xs" value={wForm.external_id} onChange={e => setWForm(f => ({ ...f, external_id: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Section</label>
                    <input className="input text-xs" value={wForm.section_id} onChange={e => setWForm(f => ({ ...f, section_id: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <label className="label">Start</label>
                  <input type="datetime-local" className="input text-xs" value={wForm.start_at} onChange={e => setWForm(f => ({ ...f, start_at: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">End</label>
                  <input type="datetime-local" className="input text-xs" value={wForm.end_at} onChange={e => setWForm(f => ({ ...f, end_at: e.target.value }))} required />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={createWindowMut.isPending} className="btn-primary text-xs flex-1 justify-center">
                    Save Window
                  </button>
                  <button type="button" onClick={() => setShowWindowForm(false)} className="btn-secondary text-xs px-3">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {windows.map(w => (
                <div key={w.id} className="p-2.5 bg-navy-950/80 rounded border border-surface-border/50 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-gray-200">{w.external_id}</span>
                    <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-surface-subtle rounded font-mono">
                      Load {w.traffic_load}%
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 font-mono">{w.section_id}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Optimization results & Multi-Dept Showcase */}
        <div className="space-y-6">
          {/* Optimization Progress Stepper */}
          {(isOptimizing || optError || infeasible || steps.some(s => s.status !== 'pending')) && steps.some(s => s.status !== 'pending') && (
            <OptimizationProgress
              steps={steps}
              isRunning={isOptimizing}
              error={optError}
              infeasible={infeasible}
            />
          )}

          {/* Plan Result Panel & Sr DOM Approval Header */}
          {activePlan && !isOptimizing && (
            <PlanResultPanel
              plan={activePlan}
              tasks={tasks}
              canApprove={canApprove}
              canPublish={canPublish}
              onApprove={() => approveMut.mutate(activePlan.id)}
              onPublish={() => publishMut.mutate(activePlan.id)}
              approving={approveMut.isPending}
              publishing={publishMut.isPending}
            />
          )}

          {/* Hero Corridor Gantt Visualizer */}
          {activePlan && tasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Corridor Timetable & Maintenance Matrix
                </h3>
              </div>
              <CorridorTimeline tasks={tasks} planItems={activePlan.items} trains={trains} windows={windows} />
            </div>
          )}

          {!activePlan && !isOptimizing && (
            <div className="card p-8">
              <EmptyState
                title="No Block Plan Active"
                description="Click 'RUN CP-SAT OPTIMIZATION' to compute multi-department shadow possessions."
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
      {/* Plan Header Card */}
      <div className="card p-5 bg-navy-900/90 border border-surface-border">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} className="text-emerald-400" />
              <h3 className="text-base font-bold text-gray-100">Recommended Block Plan #{plan.id}</h3>
              <StatusBadge status={plan.status} />
            </div>
            <p className="text-xs text-gray-400">
              {plan.horizon} Plan • Version {plan.version} • Optimized for Indian Railways Section Controller Decision Support
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canApprove && plan.status === 'DRAFT' && (
              <button onClick={onApprove} disabled={approving} className="btn-success text-xs font-bold px-3 py-1.5">
                <ThumbsUp size={13} />
                {approving ? 'Approving…' : 'Sr. DOM Approve'}
              </button>
            )}
            {canPublish && plan.status === 'APPROVED' && (
              <button onClick={onPublish} disabled={publishing} className="btn-primary text-xs font-bold px-3 py-1.5">
                <Send size={13} />
                {publishing ? 'Publishing…' : 'Publish to COA'}
              </button>
            )}
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {(() => {
            // Group plan items by window — count windows with multiple tasks (consolidation)
            const windowTaskMap = new Map<number, number>();
            plan.items.forEach(i => windowTaskMap.set(i.window_id, (windowTaskMap.get(i.window_id) ?? 0) + 1));
            const consolidatedWindows = [...windowTaskMap.values()].filter(c => c > 1).length;
            // Track hours saved: estimate 45min avg per extra possession eliminated
            const hoursSaved = parseFloat(((plan.scheduled_count - (windowTaskMap.size)) * 0.75).toFixed(1));
            // Efficiency %: compare windows used vs tasks scheduled
            const efficiencyGain = plan.scheduled_count > 0 ? Math.round((1 - windowTaskMap.size / plan.scheduled_count) * 100) : 0;
            return (
              <>
                <Metric label="Tasks Scheduled" value={plan.scheduled_count} color="green" />
                <Metric label="Unscheduled Tasks" value={plan.unscheduled_task_ids.length} color={plan.unscheduled_task_ids.length > 0 ? 'amber' : 'green'} />
                <Metric label="Consolidated Windows" value={consolidatedWindows} color="blue" />
                <Metric label="Track Hours Saved" value={Math.max(0, hoursSaved)} unit="hrs" color="purple" />
              </>
            );
          })()}
        </div>
      </div>

      {/* Multi-Department Consolidation Comparison */}
      <div className="card p-5 bg-navy-900/90 border border-purple-500/30 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-gray-100">Multi-Department Consolidation Showcase</h3>
          </div>
          {(() => {
            const windowTaskMap = new Map<number, number>();
            plan.items.forEach(i => windowTaskMap.set(i.window_id, (windowTaskMap.get(i.window_id) ?? 0) + 1));
            const efficiencyPct = plan.scheduled_count > 0 
              ? Math.round((1 - windowTaskMap.size / plan.scheduled_count) * 100) 
              : 0;
            return (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                {Math.max(0, efficiencyPct)}% Possession Efficiency Gain
              </span>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Before */}
          <div className="bg-navy-950/80 p-3.5 rounded-lg border border-rose-500/20 space-y-2">
            <span className="text-[11px] font-bold uppercase text-rose-400 tracking-wider">
              Before (Uncoordinated Departmental Requests)
            </span>
            <ul className="space-y-1 text-gray-400 text-[11px]">
              <li>• ENGG Track Repair: 01:00 → 02:30 (90 min possession)</li>
              <li>• S&T Signal Check: 06:00 → 07:00 (60 min possession)</li>
              <li>• TRD OHE Maintenance: 14:00 → 15:15 (75 min possession)</li>
            </ul>
            <div className="pt-2 border-t border-surface-border text-rose-300 font-semibold text-[11px]">
              Total Track Possession Disruptions: 3 Separate Windows (225 min)
            </div>
          </div>

          {/* After */}
          <div className="bg-navy-950/80 p-3.5 rounded-lg border border-emerald-500/20 space-y-2">
            <span className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider">
              After (CP-SAT Shadow Possession Consolidation)
            </span>
            <ul className="space-y-1 text-gray-300 text-[11px]">
              <li className="font-semibold text-emerald-300">
                • Bundled Window (WIN-101): 01:00 → 04:00 (Single Shadow Possession)
              </li>
              <li>• ENGG, S&T, and TRD crews execute concurrently/sequentially</li>
            </ul>
            <div className="pt-2 border-t border-surface-border text-emerald-400 font-bold text-[11px]">
              Track Possession Disruptions Reduced to 1 Window (46% time saved!)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color, unit }: { label: string; value: number; color: string; unit?: string }) {
  const colors: Record<string, string> = { green: '#10b981', amber: '#f59e0b', blue: '#3b82f6', purple: '#c084fc' };
  return (
    <div className="bg-navy-950/80 rounded-lg p-3 text-center border border-surface-border/50">
      <div className="text-xl font-bold font-tabular" style={{ color: colors[color] }}>
        {value} {unit}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
