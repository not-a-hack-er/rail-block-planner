import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Wrench, CalendarCheck, AlertTriangle, ShieldAlert, Cpu,
  RefreshCw, Zap, TrendingDown, Clock
} from 'lucide-react';
import { listTasks } from '../api/tasks';
import { getPlan, getLatestPlanId } from '../api/plans';
import { KpiCard } from '../components/ui/KpiCard';
import { AlertBanner } from '../components/ui/StateComponents';
import { LoadingState, ErrorState } from '../components/ui/StateComponents';
import { DeptBadge, SeverityBadge, ScoreBar, StatusBadge } from '../components/ui/Badges';
import { formatDateTime, durationLabel, daysUntilDue, isOverdue, uniqueSections } from '../utils';
import { CorridorTimeline } from '../components/timeline/CorridorTimeline';
import type { MaintenanceTask } from '../types';

export function CommandCenter() {
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 60_000,
  });

  const latestPlanId = getLatestPlanId();
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['plan', latestPlanId],
    queryFn: () => getPlan(latestPlanId!),
    enabled: latestPlanId !== null,
    staleTime: 60_000,
  });

  const criticalTasks = tasks.filter(t => t.severity === 5);
  const highTasks = tasks.filter(t => t.severity === 4);
  const overdueTasks = tasks.filter(t => isOverdue(t));
  const scheduledCount = plan?.scheduled_count ?? 0;
  const unscheduledCount = plan?.unscheduled_task_ids?.length ?? 0;

  const isLoading = tasksLoading;

  if (isLoading) return <div className="p-8"><LoadingState label="Loading command center…" /></div>;
  if (tasksError) return <div className="p-8"><ErrorState message="Failed to load task data from backend." /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Railway Operations Command Center</h1>
          <p className="page-subtitle mt-1">AI-assisted maintenance block planning and capacity coordination</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="badge badge-gray text-[10px]">Decision Support • Human-in-the-loop</div>
          <button onClick={() => refetch()} className="btn-icon" title="Refresh data">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Total Tasks"
          value={tasks.length}
          icon={Wrench}
          subtitle={`${highTasks.length} high priority`}
          loading={tasksLoading}
        />
        <KpiCard
          title="Critical Tasks"
          value={criticalTasks.length}
          icon={ShieldAlert}
          color={criticalTasks.length > 0 ? 'red' : 'green'}
          subtitle="Severity 5"
          loading={tasksLoading}
        />
        <KpiCard
          title="Overdue"
          value={overdueTasks.length}
          icon={AlertTriangle}
          color={overdueTasks.length > 0 ? 'amber' : 'green'}
          subtitle="Past due date"
          loading={tasksLoading}
        />
        <KpiCard
          title="Scheduled Blocks"
          value={scheduledCount}
          icon={CalendarCheck}
          color="blue"
          subtitle={latestPlanId ? `Plan #${latestPlanId}` : 'No plan yet'}
          loading={planLoading}
        />
        <KpiCard
          title="Unscheduled"
          value={unscheduledCount}
          icon={Clock}
          color={unscheduledCount > 0 ? 'amber' : 'green'}
          subtitle="Tasks without block"
          loading={planLoading}
        />
        <KpiCard
          title="Optimizer"
          value={plan ? plan.status : 'NO PLAN'}
          icon={Cpu}
          color={plan?.status === 'PUBLISHED' ? 'green' : plan?.status === 'APPROVED' ? 'blue' : plan?.status === 'DRAFT' ? 'amber' : 'default'}
          loading={planLoading}
        />
      </div>

      {/* Alerts panel + Timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        {/* Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-200">Corridor Operations Timeline</h2>
              <p className="text-xs text-gray-500 mt-0.5">Maintenance tasks by section and time window</p>
            </div>
            <div className="badge badge-gray text-[10px]">
              {uniqueSections(tasks).length} section{uniqueSections(tasks).length !== 1 ? 's' : ''}
            </div>
          </div>
          <CorridorTimeline tasks={tasks} planItems={plan?.items ?? []} />
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-200">Operational Attention</h2>
          <div className="space-y-2">
            {criticalTasks.map(t => (
              <AlertBanner
                key={t.id}
                type="critical"
                title={`${t.defect_type} — ${t.asset_id}`}
                message={`Section ${t.section_id} • Severity 5 • ${isOverdue(t) ? 'OVERDUE' : `Due ${daysUntilDue(t)}d`}`}
              />
            ))}
            {overdueTasks.filter(t => t.severity < 5).map(t => (
              <AlertBanner
                key={t.id}
                type="warning"
                title={`Overdue: ${t.external_id}`}
                message={`${t.defect_type} on ${t.section_id}`}
              />
            ))}
            {unscheduledCount > 0 && (
              <AlertBanner
                type="warning"
                title={`${unscheduledCount} task${unscheduledCount > 1 ? 's' : ''} unscheduled`}
                message="Run Block Planner to assign maintenance windows"
              />
            )}
            {plan?.status === 'DRAFT' && (
              <AlertBanner
                type="info"
                title="Plan awaiting approval"
                message={`Plan #${plan.id} is a draft. Senior DOM approval required.`}
              />
            )}
            {plan?.status === 'PUBLISHED' && (
              <AlertBanner
                type="success"
                title="Block plan published"
                message={`Plan #${plan.id} — ${plan.scheduled_count} tasks scheduled`}
              />
            )}
            {tasks.length === 0 && (
              <AlertBanner
                type="info"
                title="No maintenance tasks in system"
                message="Use 'Seed Demo Data' in System Status to populate with sample tasks."
              />
            )}
          </div>

          {/* Top priority tasks */}
          {tasks.length > 0 && (
            <div className="card overflow-hidden mt-4">
              <div className="px-4 py-3 border-b border-surface-border">
                <p className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                  <Zap size={12} className="text-rail-amber" />
                  Highest Priority Tasks
                </p>
              </div>
              <div className="divide-y divide-surface-border/50">
                {tasks.slice(0, 5).map(t => (
                  <PriorityTaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Before vs After */}
      {plan && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-200">Planning Impact</h2>
          <BeforeAfterPanel tasks={tasks} plan={plan} />
        </div>
      )}
    </div>
  );
}

function PriorityTaskRow({ task }: { task: MaintenanceTask }) {
  return (
    <div className="px-4 py-2.5 hover:bg-surface-raised/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate">{task.defect_type}</p>
          <p className="text-[10px] text-gray-500">{task.external_id} · {task.section_id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DeptBadge dept={task.department} />
          {task.criticality_score !== null && (
            <span className="text-xs font-tabular font-bold" style={{ color: task.criticality_score >= 70 ? '#ef4444' : task.criticality_score >= 40 ? '#f59e0b' : '#10b981' }}>
              {task.criticality_score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BeforeAfterPanel({ tasks, plan }: { tasks: MaintenanceTask[]; plan: any }) {
  const metrics = [
    {
      label: 'Scheduled Tasks',
      before: 0,
      after: plan.scheduled_count,
      unit: '',
      betterWhenHigher: true,
    },
    {
      label: 'Unscheduled Tasks',
      before: tasks.length,
      after: plan.unscheduled_task_ids?.length ?? 0,
      unit: '',
      betterWhenHigher: false,
    },
    {
      label: 'Coverage',
      before: '0%',
      after: tasks.length > 0 ? `${Math.round((plan.scheduled_count / tasks.length) * 100)}%` : '0%',
      unit: '',
      betterWhenHigher: true,
      noCalc: true,
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[1fr_2px_1fr] divide-x-0">
        <div className="p-4 bg-surface-raised/50">
          <p className="section-title text-[10px] text-gray-500 mb-3">Manual / Baseline</p>
          {metrics.map(m => (
            <div key={m.label} className="flex justify-between text-xs py-1.5 border-b border-surface-border/50 last:border-0">
              <span className="text-gray-400">{m.label}</span>
              <span className="font-tabular text-gray-300">{typeof m.before === 'number' ? m.before : m.before}</span>
            </div>
          ))}
        </div>
        <div className="w-px bg-surface-border" />
        <div className="p-4 bg-rail-blue/5">
          <p className="section-title text-[10px] text-rail-blue mb-3 flex items-center gap-1.5">
            <Cpu size={9} />
            AI Optimized
          </p>
          {metrics.map(m => (
            <div key={m.label} className="flex justify-between text-xs py-1.5 border-b border-surface-border/50 last:border-0">
              <span className="text-gray-400">{m.label}</span>
              <span className="font-tabular font-semibold text-rail-green">{typeof m.after === 'number' ? m.after : m.after}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
