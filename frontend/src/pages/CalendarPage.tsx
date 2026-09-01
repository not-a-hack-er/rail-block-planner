import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { listTasks } from '../api/tasks';
import { getPlan, getLatestPlanId } from '../api/plans';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateComponents';
import { DeptBadge } from '../components/ui/Badges';
import { durationLabel } from '../utils';
import type { PlanItemResponse, MaintenanceTask } from '../types';
import { clsx } from '../utils/clsx';

const DEPT_COLORS: Record<string, string> = {
  ENGG: '#3b82f6',
  TRD: '#f59e0b',
  ST: '#8b5cf6',
};

export function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date());

  const { data: tasks = [], isLoading: tLoading, error: tErr } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
  });

  const latestPlanId = getLatestPlanId();
  const { data: plan, isLoading: pLoading } = useQuery({
    queryKey: ['plan', latestPlanId],
    queryFn: () => getPlan(latestPlanId!),
    enabled: latestPlanId !== null,
  });

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const days = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, { item: PlanItemResponse; task: MaintenanceTask }[]>();
    (plan?.items ?? []).forEach(item => {
      const key = format(parseISO(item.start_at), 'yyyy-MM-dd');
      const task = taskMap.get(item.task_id);
      if (!map.has(key)) map.set(key, []);
      if (task) map.get(key)!.push({ item, task });
    });
    return map;
  }, [plan, taskMap]);

  if (tLoading || pLoading) return <div className="p-8"><LoadingState label="Loading calendar…" /></div>;
  if (tErr) return <div className="p-8"><ErrorState message="Failed to load data." /></div>;

  const monthLabel = format(viewDate, 'MMMM yyyy');
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayOfWeek = days[0].getDay();

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar size={20} className="text-rail-blue" />
            Plans / Calendar
          </h1>
          <p className="page-subtitle mt-1">Monthly view of scheduled maintenance blocks from the active plan.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewDate(d => subMonths(d, 1))} className="btn-icon">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-200 w-36 text-center">{monthLabel}</span>
          <button onClick={() => setViewDate(d => addMonths(d, 1))} className="btn-icon">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!plan ? (
        <div className="card">
          <EmptyState
            title="No plan to display"
            description="Run the Block Planner to generate a plan with scheduled blocks."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-surface-border">
            {weekdays.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Offset cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="border-r border-b border-surface-border/50 min-h-[100px] bg-navy-900/30" />
            ))}

            {/* Day cells */}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayItems = itemsByDay.get(key) ?? [];
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={key}
                  className={clsx(
                    'border-r border-b border-surface-border/50 min-h-[100px] p-1.5 transition-colors',
                    isToday ? 'bg-rail-blue/5' : 'hover:bg-surface-raised/30'
                  )}
                >
                  <div className={clsx(
                    'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-rail-blue text-white' : 'text-gray-500'
                  )}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map(({ item, task }) => (
                      <div
                        key={item.task_id}
                        title={`${task.external_id} — ${task.defect_type}\n${format(parseISO(item.start_at), 'HH:mm')}–${format(parseISO(item.end_at), 'HH:mm')}\n${task.section_id}`}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded truncate cursor-default"
                        style={{
                          backgroundColor: `${DEPT_COLORS[task.department] ?? '#6b7280'}20`,
                          borderLeft: `2px solid ${DEPT_COLORS[task.department] ?? '#6b7280'}`,
                          color: DEPT_COLORS[task.department] ?? '#9ca3af',
                        }}
                      >
                        {task.external_id}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] text-gray-600 px-1">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap">
        {Object.entries(DEPT_COLORS).map(([dept, color]) => (
          <div key={dept} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${color}20`, borderLeft: `2px solid ${color}` }} />
            {dept === 'ENGG' ? 'Engineering' : dept === 'TRD' ? 'Traction' : 'Signal & Telecom'}
          </div>
        ))}
        <span className="text-xs text-gray-600">
          Showing {plan?.items?.length ?? 0} scheduled blocks from Plan #{latestPlanId}
        </span>
      </div>
    </div>
  );
}
