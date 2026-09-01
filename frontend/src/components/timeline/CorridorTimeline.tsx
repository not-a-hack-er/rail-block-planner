import React, { useMemo } from 'react';
import { parseISO, format, addHours, startOfDay, differenceInMinutes } from 'date-fns';
import type { MaintenanceTask, PlanItemResponse } from '../../types';
import { uniqueSections, deptLabel } from '../../utils';
import { clsx } from '../../utils/clsx';
import { EmptyState } from '../ui/StateComponents';

interface CorridorTimelineProps {
  tasks: MaintenanceTask[];
  planItems: PlanItemResponse[];
}

const DEPT_COLORS: Record<string, string> = {
  ENGG: '#3b82f6',
  TRD: '#f59e0b',
  ST: '#8b5cf6',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CorridorTimeline({ tasks, planItems }: CorridorTimelineProps) {
  const sections = useMemo(() => uniqueSections(tasks), [tasks]);

  // Determine the reference date from plan items, or use today
  const refDate = useMemo(() => {
    if (planItems.length > 0) {
      return startOfDay(parseISO(planItems[0].start_at));
    }
    return startOfDay(new Date());
  }, [planItems]);

  const dayStart = refDate.getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  // Index plan items by task id
  const planByTask = useMemo(() => {
    const m = new Map<number, PlanItemResponse>();
    planItems.forEach(i => m.set(i.task_id, i));
    return m;
  }, [planItems]);

  if (tasks.length === 0) {
    return (
      <div className="card">
        <EmptyState
          title="No tasks to display"
          description="Add maintenance tasks to see the corridor timeline"
          icon="search"
        />
      </div>
    );
  }

  const toPercent = (ms: number) => ((ms - dayStart) / (dayEnd - dayStart)) * 100;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-surface-border">
        <p className="text-xs text-gray-400">
          Showing scheduled windows for {format(refDate, 'dd MMM yyyy')} •{' '}
          <span className="text-gray-500">Blocks derived from plan items</span>
        </p>
      </div>

      {/* Hour axis */}
      <div className="pl-32 pr-4 pt-2 pb-1 overflow-x-auto">
        <div className="relative min-w-[600px]">
          <div className="flex">
            {HOURS.filter(h => h % 3 === 0).map(h => (
              <div key={h} className="flex-1 text-[10px] text-gray-600 font-tabular">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Sections */}
          {sections.map(section => {
            const sectionTasks = tasks.filter(t => t.section_id === section);
            const sectionItems = sectionTasks
              .map(t => ({ task: t, item: planByTask.get(t.id) }))
              .filter(({ item }) => !!item);

            return (
              <div key={section} className="mt-3">
                {/* Section label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="absolute left-4 text-[10px] font-semibold text-gray-400 truncate"
                    style={{ width: 112 }}
                  >
                    {section}
                  </div>
                </div>

                {/* Timeline track */}
                <div className="relative h-9 bg-navy-900 rounded border border-surface-border/50 overflow-hidden">
                  {/* Hour grid lines */}
                  {HOURS.filter(h => h % 3 === 0 && h > 0).map(h => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px bg-surface-border/30"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}

                  {/* Unscheduled tasks — show as dim markers */}
                  {sectionTasks.filter(t => !planByTask.has(t.id)).map(task => (
                    <div
                      key={task.id}
                      className="absolute top-0.5 w-1.5 h-1.5 rounded-full opacity-30"
                      style={{
                        backgroundColor: DEPT_COLORS[task.department] ?? '#6b7280',
                        left: '2px',
                      }}
                      title={`${task.external_id} — Not scheduled`}
                    />
                  ))}

                  {/* Scheduled items — block bars */}
                  {sectionItems.map(({ task, item }) => {
                    if (!item) return null;
                    const startMs = parseISO(item.start_at).getTime();
                    const endMs = parseISO(item.end_at).getTime();
                    const left = Math.max(0, toPercent(startMs));
                    const width = Math.min(100 - left, toPercent(endMs) - left);
                    const color = DEPT_COLORS[task.department] ?? '#6b7280';
                    const durationMin = differenceInMinutes(parseISO(item.end_at), parseISO(item.start_at));

                    return (
                      <div
                        key={item.task_id}
                        className="absolute top-1 bottom-1 rounded group cursor-pointer flex items-center px-1.5"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 1)}%`,
                          backgroundColor: `${color}30`,
                          borderLeft: `2px solid ${color}`,
                          minWidth: 24,
                        }}
                        title={`${task.external_id} — ${task.defect_type}\n${format(parseISO(item.start_at), 'HH:mm')}–${format(parseISO(item.end_at), 'HH:mm')} (${durationMin}min)`}
                      >
                        <span className="text-[9px] font-semibold truncate" style={{ color }}>
                          {task.external_id}
                        </span>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 w-48">
                          <div className="bg-navy-700 border border-surface-border rounded p-2 shadow-lg">
                            <p className="text-xs font-semibold text-gray-200">{task.external_id}</p>
                            <p className="text-[10px] text-gray-400">{task.defect_type}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              {format(parseISO(item.start_at), 'HH:mm')} → {format(parseISO(item.end_at), 'HH:mm')}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: `${color}25`, color }}
                              >
                                {deptLabel(task.department)}
                              </span>
                              <span className="text-[9px] text-gray-500">{durationMin}min</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section task counts */}
                <div className="flex gap-3 mt-1">
                  {Object.entries(DEPT_COLORS).map(([dept, color]) => {
                    const count = sectionTasks.filter(t => t.department === dept).length;
                    if (count === 0) return null;
                    return (
                      <span key={dept} className="text-[10px] text-gray-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                        {deptLabel(dept)}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-surface-border/50 flex items-center gap-5 flex-wrap">
        {Object.entries(DEPT_COLORS).map(([dept, color]) => (
          <div key={dept} className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: `${color}30`, borderLeft: `2px solid ${color}` }} />
            {deptLabel(dept)}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-600 opacity-40" />
          Unscheduled
        </div>
        <p className="ml-auto text-[10px] text-gray-600">
          NOTE: Train timetable data not available in backend. Showing maintenance windows only.
        </p>
      </div>
    </div>
  );
}
