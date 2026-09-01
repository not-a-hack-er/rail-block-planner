import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Route, BarChart2, AlertTriangle, Info } from 'lucide-react';
import { listTasks } from '../api/tasks';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateComponents';
import { DeptBadge } from '../components/ui/Badges';
import { uniqueSections, deptLabel } from '../utils';
import { clsx } from '../utils/clsx';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Traffic load color
function trafficColor(load: number): string {
  if (load >= 70) return 'bg-rail-red/70 text-red-200';
  if (load >= 40) return 'bg-rail-amber/60 text-amber-200';
  if (load >= 20) return 'bg-rail-blue/40 text-blue-200';
  return 'bg-rail-green/30 text-green-300';
}

function trafficLabel(load: number): string {
  if (load >= 70) return 'HIGH';
  if (load >= 40) return 'MED';
  if (load >= 20) return 'LOW';
  return 'MIN';
}

export function CorridorPage() {
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 60_000,
  });

  const sections = uniqueSections(tasks);

  // Build a synthetic traffic heatmap from task traffic_density values
  // Grouped by section and estimated hour-of-day impact
  const heatmap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    sections.forEach(s => {
      map[s] = {};
      HOURS.forEach(h => { map[s][h] = 0; });
    });
    tasks.forEach(task => {
      // Use traffic_density as a baseline pressure value
      // Maintenance tasks are typically scheduled in low-traffic windows (00:00–06:00)
      // We simulate demand using traffic_density as peak-hour pressure
      const section = task.section_id;
      if (!map[section]) return;
      // Peak hours 06:00–22:00, off-peak 22:00–06:00
      HOURS.forEach(h => {
        const isPeak = h >= 6 && h <= 22;
        const contribution = isPeak ? task.traffic_density * 0.8 : task.traffic_density * 0.15;
        map[section][h] = Math.min(100, map[section][h] + contribution);
      });
    });
    return map;
  }, [tasks, sections]);

  if (isLoading) return <div className="p-8"><LoadingState label="Loading corridor data…" /></div>;
  if (error) return <div className="p-8"><ErrorState message="Failed to load task data." /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Route size={20} className="text-rail-blue" />
          Traffic & Corridor Intelligence
        </h1>
        <p className="page-subtitle mt-1">
          Section-level traffic density derived from maintenance task data.
          The optimizer selects block windows in low-traffic periods.
        </p>
      </div>

      {/* Info callout */}
      <div className="alert-info">
        <Info size={14} className="text-rail-blue mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-rail-blue">Note on Traffic Data</p>
          <p className="text-xs text-gray-400 mt-0.5">
            This heatmap is derived from the <code>traffic_density</code> field on maintenance tasks.
            The backend does not have a separate train timetable or live traffic API.
            The optimizer uses this same field when minimizing traffic impact during block assignment.
          </p>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="card"><EmptyState title="No sections found" description="Add maintenance tasks to see section data." /></div>
      ) : (
        <>
          {/* Section cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sections.map(section => {
              const sectionTasks = tasks.filter(t => t.section_id === section);
              const depts = [...new Set(sectionTasks.map(t => t.department))];
              const avgDensity = sectionTasks.length > 0
                ? Math.round(sectionTasks.reduce((s, t) => s + t.traffic_density, 0) / sectionTasks.length)
                : 0;
              const criticalCount = sectionTasks.filter(t => t.severity === 5).length;

              return (
                <div key={section} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-200">{section}</h3>
                      <p className="text-xs text-gray-500">{sectionTasks.length} maintenance task{sectionTasks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className={clsx(
                      'px-2 py-1 rounded text-xs font-semibold',
                      avgDensity >= 70 ? 'bg-rail-red/15 text-rail-red' :
                      avgDensity >= 40 ? 'bg-rail-amber/15 text-rail-amber' :
                      'bg-rail-green/15 text-rail-green'
                    )}>
                      {avgDensity >= 70 ? 'HIGH' : avgDensity >= 40 ? 'MEDIUM' : 'LOW'} TRAFFIC
                    </div>
                  </div>

                  {/* Traffic bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Avg Traffic Density</span>
                      <span>{avgDensity}/100</span>
                    </div>
                    <div className="score-bar-bg">
                      <div
                        className={clsx('score-bar-fill', avgDensity >= 70 ? 'bg-rail-red' : avgDensity >= 40 ? 'bg-rail-amber' : 'bg-rail-green')}
                        style={{ width: `${avgDensity}%` }}
                      />
                    </div>
                  </div>

                  {/* Department breakdown */}
                  <div className="flex flex-wrap gap-1.5">
                    {depts.map(d => (
                      <div key={d} className="flex items-center gap-1">
                        <DeptBadge dept={d} />
                        <span className="text-[10px] text-gray-500">
                          ({sectionTasks.filter(t => t.department === d).length})
                        </span>
                      </div>
                    ))}
                  </div>

                  {criticalCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-rail-red">
                      <AlertTriangle size={11} />
                      {criticalCount} critical task{criticalCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Traffic heatmap */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
              <BarChart2 size={14} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-200">Traffic Density Heatmap by Section × Time-of-Day</h2>
            </div>
            <div className="overflow-x-auto p-4">
              <div className="min-w-[700px]">
                {/* Hour labels */}
                <div className="flex mb-2 pl-32">
                  {HOURS.filter(h => h % 2 === 0).map(h => (
                    <div key={h} className="flex-1 text-[10px] text-gray-600 font-tabular text-center">
                      {String(h).padStart(2, '0')}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {sections.map(section => (
                  <div key={section} className="flex items-center mb-1.5">
                    <div className="w-32 text-[10px] text-gray-400 truncate pr-2">{section}</div>
                    <div className="flex flex-1 gap-px">
                      {HOURS.map(h => {
                        const load = Math.round(heatmap[section]?.[h] ?? 0);
                        return (
                          <div
                            key={h}
                            title={`${section} ${String(h).padStart(2,'0')}:00 — Traffic: ${load}`}
                            className={clsx('flex-1 h-8 rounded-sm text-[8px] flex items-center justify-center font-semibold', trafficColor(load))}
                          >
                            {h % 4 === 0 ? trafficLabel(load) : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-border">
                  {[
                    { label: 'MINIMAL', cls: 'bg-rail-green/30' },
                    { label: 'LOW', cls: 'bg-rail-blue/40' },
                    { label: 'MEDIUM', cls: 'bg-rail-amber/60' },
                    { label: 'HIGH', cls: 'bg-rail-red/70' },
                  ].map(({ label, cls }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={clsx('w-4 h-4 rounded-sm', cls)} />
                      <span className="text-[10px] text-gray-500">{label}</span>
                    </div>
                  ))}
                  <span className="text-[10px] text-gray-600 ml-auto">
                    Derived from task traffic_density field
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
