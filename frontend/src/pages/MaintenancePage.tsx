import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wrench, Plus, Filter } from 'lucide-react';
import { listTasks } from '../api/tasks';
import { getPlan, getLatestPlanId } from '../api/plans';
import { TaskTable } from '../components/tasks/TaskTable';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer';
import { LoadingState, ErrorState } from '../components/ui/StateComponents';
import type { MaintenanceTask, PlanItemResponse } from '../types';

export function MaintenancePage() {
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 60_000,
  });

  const latestPlanId = getLatestPlanId();
  const { data: plan } = useQuery({
    queryKey: ['plan', latestPlanId],
    queryFn: () => getPlan(latestPlanId!),
    enabled: latestPlanId !== null,
  });

  const planItems: PlanItemResponse[] = plan?.items ?? [];

  // Find plan item for selected task
  const selectedPlanItem = selectedTask
    ? planItems.find(i => i.task_id === selectedTask.id)
    : undefined;

  if (isLoading) return <div className="p-8"><LoadingState label="Loading maintenance tasks…" /></div>;
  if (error) return <div className="p-8"><ErrorState message="Failed to load maintenance tasks from backend." /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wrench size={20} className="text-rail-blue" />
            Maintenance Task Manager
          </h1>
          <p className="page-subtitle mt-1">
            All tasks ordered by AI-computed criticality score (highest first).
            Scores derived from severity, overdue status, traffic density and failure history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {planItems.length} scheduled
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Engineering (ENGG)"
          count={tasks.filter(t => t.department === 'ENGG').length}
          color="#3b82f6"
        />
        <SummaryCard
          label="Signal & Telecom (ST)"
          count={tasks.filter(t => t.department === 'ST').length}
          color="#8b5cf6"
        />
        <SummaryCard
          label="Traction (TRD)"
          count={tasks.filter(t => t.department === 'TRD').length}
          color="#f59e0b"
        />
        <SummaryCard
          label="Critical (Severity 5)"
          count={tasks.filter(t => t.severity === 5).length}
          color="#ef4444"
        />
      </div>

      {/* Task table */}
      <TaskTable
        tasks={tasks}
        planItems={planItems}
        onSelectTask={setSelectedTask}
        selectedTaskId={selectedTask?.id}
      />

      {/* Task detail drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        planItem={selectedPlanItem}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <div className="text-xl font-bold font-tabular text-gray-100">{count}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}
