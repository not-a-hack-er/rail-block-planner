import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Wrench, CalendarCheck, AlertTriangle, ShieldAlert, Cpu,
  RefreshCw, Zap, TrendingUp, Train, BarChart2
} from 'lucide-react';
import { listTasks } from '../api/tasks';
import { getPlans } from '../api/plans';
import { listTrains } from '../api/trains';
import { KpiCard } from '../components/ui/KpiCard';
import { AlertBanner } from '../components/ui/StateComponents';
import { LoadingState, ErrorState } from '../components/ui/StateComponents';
import { DeptBadge } from '../components/ui/Badges';
import { daysUntilDue, isOverdue, uniqueSections } from '../utils';
import { CorridorTimeline } from '../components/timeline/CorridorTimeline';
import type { MaintenanceTask, TrainSchedule } from '../types';

const REFRESH_INTERVAL_S = 60;

export function CommandCenter() {
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_S);

  const { data: tasks = [], isLoading: tasksLoading, error: tasksError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL_S * 1000,
  });

  const { data: plans = [], isLoading: planLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL_S * 1000,
  });

  const plan = plans.length > 0 ? plans[0] : null;
  const latestPlanId = plan?.id ?? null;

  const { data: trains = [] } = useQuery<TrainSchedule[]>({
    queryKey: ['trains'],
    queryFn: listTrains,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_S);
    const timer = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL_S : c - 1), 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  const criticalTasks = tasks.filter(t => t.severity === 5);
  const highTasks = tasks.filter(t => t.severity === 4);
  const overdueTasks = tasks.filter(t => isOverdue(t));
  const scheduledCount = plan?.scheduled_count ?? 0;
  const unscheduledCount = plan?.unscheduled_task_ids?.length ?? 0;
  const coveragePct = tasks.length > 0 ? Math.round((scheduledCount / tasks.length) * 100) : 0;

  if (tasksLoading) return <div className="p-8"><LoadingState label="Loading command center…" /></div>;
  if (tasksError) return <div className="p-8"><ErrorState message="Failed to load task data from backend." /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      <div className="flex items-start justify-between border-b border-surface-border pb-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Activity size={20} className="text-rail-blue" />
            Railway Operations Command Center
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded ml-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </h1>
          <p className="page-subtitle mt-1">AI-assisted multi-department maintenance block planning and corridor capacity coordination</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-gray-600 font-mono">
            Refresh in <span className="text-gray-400 font-bold">{countdown}s</span>
          </div>
          <button onClick={() => { refetch(); setCountdown(REFRESH_INTERVAL_S); }} className="btn-icon" title="Refresh data">
            <RefreshCw size={13} />
          </button>
          <div className="badge badge-gray text-[10px]">Human-in-the-loop</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Total Tasks" value={tasks.length} icon={Wrench} subtitle={highTasks.length + " high priority"} loading={tasksLoading} />
        <KpiCard title="Critical Tasks" value={criticalTasks.length} icon={ShieldAlert} color={criticalTasks.length > 0 ? "red" : "green"} subtitle="Severity 5" loading={tasksLoading} />
        <KpiCard title="Overdue" value={overdueTasks.length} icon={AlertTriangle} color={overdueTasks.length > 0 ? "amber" : "green"} subtitle="Past due date" loading={tasksLoading} />
        <KpiCard title="Scheduled Blocks" value={scheduledCount} icon={CalendarCheck} color="blue" subtitle={latestPlanId ? "Plan #" + latestPlanId : "No plan yet"} loading={planLoading} />
        <KpiCard title="Coverage" value={coveragePct + "%"} icon={TrendingUp} color={coveragePct >= 80 ? "green" : coveragePct >= 50 ? "amber" : "red"} subtitle="Tasks scheduled" loading={planLoading} />
        <KpiCard title="Active Trains" value={trains.length} icon={Train} color="blue" subtitle="On network" loading={false} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-200">Corridor Operations Timeline</h2>
              <p className="text-xs text-gray-500 mt-0.5">Maintenance tasks by section and time window</p>
            </div>
            <div className="badge badge-gray text-[10px]">{uniqueSections(tasks).length} sections</div>
          </div>
          <CorridorTimeline tasks={tasks} planItems={plan?.items ?? []} trains={trains} />
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-200">Operational Attention</h2>
          <div className="space-y-2">
            {criticalTasks.map(t => (
              <AlertBanner key={t.id} type="critical"
                title={t.defect_type + " — " + t.asset_id}
                message={"Section " + t.section_id + " • Severity 5 • " + (isOverdue(t) ? "OVERDUE" : "Due in " + daysUntilDue(t) + "d")}
              />
            ))}
            {overdueTasks.filter(t => t.severity < 5).map(t => (
              <AlertBanner key={t.id} type="warning" title={"Overdue: " + t.external_id} message={t.defect_type + " on " + t.section_id} />
            ))}
            {unscheduledCount > 0 && (
              <AlertBanner type="warning" title={unscheduledCount + " task" + (unscheduledCount > 1 ? "s" : "") + " unscheduled"} message="Run Block Planner to assign maintenance windows" />
            )}
            {plan?.status === "DRAFT" && (
              <AlertBanner type="info" title="Plan awaiting approval" message={"Plan #" + plan.id + " is a draft. Senior DOM approval required."} />
            )}
            {plan?.status === "PUBLISHED" && (
              <AlertBanner type="success" title="Block plan published" message={"Plan #" + plan.id + " — " + plan.scheduled_count + " tasks scheduled"} />
            )}
            {tasks.length === 0 && (
              <AlertBanner type="info" title="No maintenance tasks in system" message="Use System Status → Seed Demo Data to populate sample tasks." />
            )}
          </div>

          {tasks.length > 0 && (
            <div className="card overflow-hidden mt-4">
              <div className="px-4 py-3 border-b border-surface-border">
                <p className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                  <Zap size={12} className="text-rail-amber" />
                  Highest Priority Tasks
                </p>
              </div>
              <div className="divide-y divide-surface-border/50">
                {tasks.slice(0, 5).map(t => <PriorityTaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {plan && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-200">Planning Impact Dashboard</h2>
          <BeforeAfterPanel tasks={tasks} plan={plan} />
        </div>
      )}
    </div>
  );
}

function PriorityTaskRow({ task }: { task: MaintenanceTask }) {
  const overdue = isOverdue(task);
  return (
    <div className="px-4 py-2.5 hover:bg-surface-raised/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate">{task.defect_type}</p>
          <p className="text-[10px] text-gray-500">{task.external_id} · {task.section_id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {overdue && <span className="text-[9px] font-bold text-rail-red bg-rail-red/10 px-1.5 py-0.5 rounded">OVERDUE</span>}
          <DeptBadge dept={task.department} />
          {task.criticality_score !== null && (
            <span className="text-xs font-tabular font-bold" style={{ color: task.criticality_score >= 70 ? "#ef4444" : task.criticality_score >= 40 ? "#f59e0b" : "#10b981" }}>
              {task.criticality_score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BeforeAfterPanel({ tasks, plan }: { tasks: MaintenanceTask[]; plan: any }) {
  const coverage = tasks.length > 0 ? Math.round((plan.scheduled_count / tasks.length) * 100) : 0;
  const estimatedHoursSaved = plan.scheduled_count > 0 ? parseFloat((plan.scheduled_count * 0.5).toFixed(1)) : 0;
  const metrics = [
    { label: "Scheduled Tasks", before: "0", after: String(plan.scheduled_count) },
    { label: "Unscheduled Tasks", before: String(tasks.length), after: String(plan.unscheduled_task_ids?.length ?? 0) },
    { label: "Coverage Rate", before: "0%", after: coverage + "%" },
    { label: "Track Hours Saved", before: "0h", after: estimatedHoursSaved + "h" },
  ];
  return (
    <div className="card overflow-hidden border border-surface-border">
      <div className="px-4 py-2 bg-navy-800/60 border-b border-surface-border flex items-center gap-2">
        <BarChart2 size={13} className="text-rail-blue" />
        <span className="text-xs font-bold text-gray-200">Before (Manual) vs After (AI CP-SAT Optimized)</span>
        <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{coverage}% Coverage</span>
      </div>
      <div className="grid grid-cols-[1fr_2px_1fr]">
        <div className="p-4 bg-surface-raised/30">
          <p className="section-title text-[10px] text-rose-400 mb-3 font-bold">MANUAL / BASELINE</p>
          {metrics.map(m => (
            <div key={m.label} className="flex justify-between text-xs py-1.5 border-b border-surface-border/50 last:border-0">
              <span className="text-gray-400">{m.label}</span>
              <span className="font-tabular text-gray-500 line-through">{m.before}</span>
            </div>
          ))}
        </div>
        <div className="w-px bg-surface-border" />
        <div className="p-4 bg-rail-blue/5">
          <p className="section-title text-[10px] text-rail-blue mb-3 flex items-center gap-1.5 font-bold">
            <Cpu size={9} /> AI CP-SAT OPTIMIZED
          </p>
          {metrics.map(m => (
            <div key={m.label} className="flex justify-between text-xs py-1.5 border-b border-surface-border/50 last:border-0">
              <span className="text-gray-400">{m.label}</span>
              <span className="font-tabular font-bold text-rail-green">{m.after}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
