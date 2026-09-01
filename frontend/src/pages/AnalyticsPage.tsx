import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Cpu, TrendingDown, Award } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { listTasks } from '../api/tasks';
import { getPlan, getLatestPlanId } from '../api/plans';
import { LoadingState, ErrorState, EmptyState, AlertBanner } from '../components/ui/StateComponents';
import { deptLabel } from '../utils';

const COLORS = { ENGG: '#3b82f6', TRD: '#f59e0b', ST: '#8b5cf6' };

export function AnalyticsPage() {
  const { data: tasks = [], isLoading: tLoading, error: tErr } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 60_000,
  });

  const latestPlanId = getLatestPlanId();
  const { data: plan, isLoading: pLoading } = useQuery({
    queryKey: ['plan', latestPlanId],
    queryFn: () => getPlan(latestPlanId!),
    enabled: latestPlanId !== null,
  });

  const scheduledIds = useMemo(() => new Set(plan?.items.map(i => i.task_id) ?? []), [plan]);

  // Severity distribution
  const severityData = useMemo(() => [5, 4, 3, 2, 1].map(s => ({
    name: `Severity ${s}`,
    count: tasks.filter(t => t.severity === s).length,
  })), [tasks]);

  // Department breakdown
  const deptData = useMemo(() => (['ENGG', 'TRD', 'ST'] as const).map(d => ({
    name: deptLabel(d),
    total: tasks.filter(t => t.department === d).length,
    scheduled: tasks.filter(t => t.department === d && scheduledIds.has(t.id)).length,
    unscheduled: tasks.filter(t => t.department === d && !scheduledIds.has(t.id)).length,
    dept: d,
  })), [tasks, scheduledIds]);

  // Score distribution
  const scoreData = useMemo(() => {
    const buckets = [0, 20, 40, 60, 80, 100];
    return buckets.slice(0, -1).map((min, i) => ({
      range: `${min}–${buckets[i + 1]}`,
      count: tasks.filter(t => (t.criticality_score ?? 0) >= min && (t.criticality_score ?? 0) < buckets[i + 1]).length,
    }));
  }, [tasks]);

  // Before vs after
  const scheduledCount = plan?.scheduled_count ?? 0;
  const unscheduledCount = plan?.unscheduled_task_ids?.length ?? 0;
  const coveragePct = tasks.length > 0 ? Math.round((scheduledCount / tasks.length) * 100) : 0;

  if (tLoading || pLoading) return <div className="p-8"><LoadingState label="Loading analytics…" /></div>;
  if (tErr) return <div className="p-8"><ErrorState message="Failed to load task data." /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 size={20} className="text-rail-blue" />
          Planning Performance Analytics
        </h1>
        <p className="page-subtitle mt-1">
          Metrics derived from real backend data. All charts represent actual task and plan data.
        </p>
      </div>

      {!plan && (
        <AlertBanner
          type="info"
          title="No plan generated yet"
          message="Run the Block Planner to see before/after performance comparison."
        />
      )}

      {/* Before vs After hero */}
      {plan && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <Cpu size={14} className="text-rail-blue" />
            <h2 className="text-sm font-semibold text-gray-200">AI Planning Impact — Baseline vs Optimized</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-surface-border">
            <CompareMetric
              label="Scheduled Tasks"
              before={0}
              after={scheduledCount}
              unit=""
              betterBigger
            />
            <CompareMetric
              label="Unscheduled Tasks"
              before={tasks.length}
              after={unscheduledCount}
              unit=""
              betterBigger={false}
            />
            <CompareMetric
              label="Schedule Coverage"
              before={0}
              after={coveragePct}
              unit="%"
              betterBigger
            />
            <CompareMetric
              label="Critical Tasks Scheduled"
              before={0}
              after={tasks.filter(t => t.severity === 5 && scheduledIds.has(t.id)).length}
              unit=""
              betterBigger
            />
          </div>
        </div>
      )}

      {/* Charts row */}
      {tasks.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Department schedule coverage */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Department Schedule Coverage</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="scheduled" name="Scheduled" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="unscheduled" name="Unscheduled" fill="#374151" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Severity distribution */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Task Severity Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={severityData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="count" name="Tasks" radius={[3, 3, 0, 0]}>
                  {severityData.map((entry, index) => {
                    const severity = 5 - index;
                    const fill = severity === 5 ? '#ef4444' : severity === 4 ? '#f97316' : severity === 3 ? '#f59e0b' : '#3b82f6';
                    return <Cell key={index} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Score distribution */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Criticality Score Distribution</h3>
            <p className="text-[11px] text-gray-500">Number of tasks by priority score bracket</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="count" name="Tasks" radius={[3, 3, 0, 0]}>
                  {scoreData.map((_, i) => {
                    const fills = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
                    return <Cell key={i} fill={fills[i] ?? '#3b82f6'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Department pie */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Task Distribution by Department</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={deptData.filter(d => d.total > 0)}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                >
                  {deptData.map(d => (
                    <Cell key={d.dept} fill={COLORS[d.dept as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState title="No tasks to analyze" description="Add maintenance tasks to see analytics." />
        </div>
      )}
    </div>
  );
}

function CompareMetric({ label, before, after, unit, betterBigger }: {
  label: string; before: number; after: number; unit: string; betterBigger: boolean;
}) {
  const improved = betterBigger ? after > before : after < before;
  const afterColor = improved ? '#10b981' : after === before ? '#9ca3af' : '#f59e0b';

  return (
    <div className="p-4">
      <p className="text-[10px] text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <div className="text-center">
          <p className="text-[10px] text-gray-600">Baseline</p>
          <p className="text-lg font-bold font-tabular text-gray-500">{before}{unit}</p>
        </div>
        <p className="text-gray-600 pb-1">→</p>
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Optimized</p>
          <p className="text-2xl font-bold font-tabular" style={{ color: afterColor }}>{after}{unit}</p>
        </div>
      </div>
    </div>
  );
}
