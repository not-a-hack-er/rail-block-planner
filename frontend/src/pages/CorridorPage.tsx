import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Route, BarChart2, AlertTriangle, Info, Compass } from 'lucide-react';
import { listTasks } from '../api/tasks';
import { listTrains } from '../api/trains';
import { getPlans } from '../api/plans';
import { getStations } from '../api/gis';
import { GisCorridorMap } from '../components/gis/GisCorridorMap';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateComponents';
import { DeptBadge } from '../components/ui/Badges';
import { uniqueSections } from '../utils';
import { clsx } from '../utils/clsx';
import type { TrainSchedule } from '../types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
  const { data: tasks = [], isLoading: tLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    staleTime: 60_000,
  });

  const { data: trains = [] } = useQuery<TrainSchedule[]>({
    queryKey: ['trains'],
    queryFn: listTrains,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
  });

  const { data: stations = [] } = useQuery({
    queryKey: ['stations'],
    queryFn: getStations,
  });

  const activePlan = plans.length > 0 ? plans[0] : null;
  const sections = uniqueSections(tasks);

  const heatmap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    sections.forEach(s => {
      map[s] = {};
      HOURS.forEach(h => { map[s][h] = 0; });
    });
    tasks.forEach(task => {
      const section = task.section_id;
      if (!map[section]) return;
      HOURS.forEach(h => {
        const isPeak = h >= 6 && h <= 22;
        const contribution = isPeak ? task.traffic_density * 0.8 : task.traffic_density * 0.15;
        map[section][h] = Math.min(100, map[section][h] + contribution);
      });
    });
    return map;
  }, [tasks, sections]);

  if (tLoading) return <div className="p-8"><LoadingState label="Loading GIS Corridor Intelligence…" /></div>;
  if (error) return <div className="p-8"><ErrorState message="Failed to load task data." /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[1500px]">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Route size={22} className="text-rail-blue" />
          Traffic & Geographic GIS Corridor Intelligence
        </h1>
        <p className="page-subtitle mt-1">
          Geographic Indian Railways track topology with live train GPS coordinates & section-level capacity heatmaps.
        </p>
      </div>

      {/* Hero Geographic GIS Map Overlay */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
          <Compass className="w-5 h-5 text-cyan-400" />
          Interactive GIS Track Topography & Live GPS Network
        </h2>
        <GisCorridorMap 
          stations={stations} 
          trains={trains} 
          tasks={tasks} 
          planItems={activePlan?.items ?? []} 
        />
      </div>

      {sections.length > 0 && (
        <>
          {/* Section summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sections.map(section => {
              const sectionTasks = tasks.filter(t => t.section_id === section);
              const depts = [...new Set(sectionTasks.map(t => t.department))];
              const avgDensity = sectionTasks.length > 0
                ? Math.round(sectionTasks.reduce((s, t) => s + t.traffic_density, 0) / sectionTasks.length)
                : 0;
              const criticalCount = sectionTasks.filter(t => t.severity === 5).length;

              return (
                <div key={section} className="card p-4 space-y-3 bg-navy-900/90 border border-surface-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 font-mono">{section}</h3>
                      <p className="text-xs text-gray-400">{sectionTasks.length} maintenance task{sectionTasks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className={clsx(
                      'px-2 py-1 rounded text-xs font-bold',
                      avgDensity >= 70 ? 'bg-rail-red/15 text-rail-red' :
                      avgDensity >= 40 ? 'bg-rail-amber/15 text-rail-amber' :
                      'bg-rail-green/15 text-rail-green'
                    )}>
                      {avgDensity >= 70 ? 'HIGH' : avgDensity >= 40 ? 'MEDIUM' : 'LOW'} TRAFFIC
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Traffic Capacity Load</span>
                      <span className="font-mono">{avgDensity}/100</span>
                    </div>
                    <div className="score-bar-bg">
                      <div
                        className={clsx('score-bar-fill', avgDensity >= 70 ? 'bg-rail-red' : avgDensity >= 40 ? 'bg-rail-amber' : 'bg-rail-green')}
                        style={{ width: `${avgDensity}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {depts.map(d => (
                      <div key={d} className="flex items-center gap-1">
                        <DeptBadge dept={d} />
                        <span className="text-[10px] text-gray-400">
                          ({sectionTasks.filter(t => t.department === d).length})
                        </span>
                      </div>
                    ))}
                  </div>

                  {criticalCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-rail-red font-semibold">
                      <AlertTriangle size={12} />
                      {criticalCount} critical task{criticalCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Traffic heatmap */}
          <div className="card overflow-hidden bg-navy-900/90 border border-surface-border">
            <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
              <BarChart2 size={16} className="text-rail-blue" />
              <h2 className="text-sm font-bold text-gray-100">Traffic Density Heatmap by Section × Time-of-Day</h2>
            </div>
            <div className="overflow-x-auto p-4">
              <div className="min-w-[700px]">
                <div className="flex mb-2 pl-32">
                  {HOURS.filter(h => h % 2 === 0).map(h => (
                    <div key={h} className="flex-1 text-[10px] text-gray-400 font-tabular text-center">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {sections.map(section => (
                  <div key={section} className="flex items-center mb-1.5">
                    <div className="w-32 text-[10px] font-mono text-gray-300 truncate pr-2">{section}</div>
                    <div className="flex flex-1 gap-px">
                      {HOURS.map(h => {
                        const load = Math.round(heatmap[section]?.[h] ?? 0);
                        return (
                          <div
                            key={h}
                            title={`${section} ${String(h).padStart(2,'0')}:00 — Traffic Load: ${load}`}
                            className={clsx('flex-1 h-8 rounded-sm text-[8px] flex items-center justify-center font-semibold', trafficColor(load))}
                          >
                            {h % 4 === 0 ? trafficLabel(load) : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
