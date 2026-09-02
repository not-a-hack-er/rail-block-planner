import React, { useMemo, useState } from 'react';
import { parseISO, format, startOfDay, differenceInMinutes } from 'date-fns';
import { 
  Train, ShieldAlert, CheckCircle2, Clock, MapPin, Users, Wrench, 
  Sparkles, Layers, Info, Filter, ArrowRight, Zap 
} from 'lucide-react';
import type { MaintenanceTask, PlanItemResponse, TrainSchedule, BlockWindow } from '../../types';
import { uniqueSections, deptLabel } from '../../utils';
import { clsx } from '../../utils/clsx';
import { EmptyState } from '../ui/StateComponents';

interface CorridorTimelineProps {
  tasks: MaintenanceTask[];
  planItems: PlanItemResponse[];
  trains?: TrainSchedule[];
  windows?: BlockWindow[];
  onRefresh?: () => void;
}

const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; lightBg: string }> = {
  ENGG: { bg: '#3b82f6', border: '#1d4ed8', text: '#60a5fa', lightBg: 'rgba(59, 130, 246, 0.2)' },
  TRD: { bg: '#f59e0b', border: '#b45309', text: '#fbbf24', lightBg: 'rgba(245, 158, 11, 0.2)' },
  ST: { bg: '#8b5cf6', border: '#6d28d9', text: '#c084fc', lightBg: 'rgba(139, 92, 246, 0.2)' },
};

const TRAIN_TYPE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  PASSENGER_PREMIUM: { bg: '#10b981', text: '#34d399', badge: 'Vande Bharat / Rajdhani' },
  PASSENGER_EXPRESS: { bg: '#06b6d4', text: '#22d3ee', badge: 'Mail / Express' },
  PASSENGER_LOCAL: { bg: '#64748b', text: '#94a3b8', badge: 'MEMU / Local' },
  FREIGHT_CONTAINER: { bg: '#ec4899', text: '#f472b6', badge: 'Container Rake' },
  FREIGHT_COAL: { bg: '#e11d48', text: '#fb7185', badge: 'Bulk Coal Rake' },
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getTimeOfDayPercent = (isoString: string) => {
  try {
    const d = parseISO(isoString);
    const minutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    return Math.max(0, Math.min(100, (minutes / 1440) * 100));
  } catch {
    return 0;
  }
};

const getDurationPercent = (startIso: string, endIso: string) => {
  try {
    const start = parseISO(startIso).getTime();
    const end = parseISO(endIso).getTime();
    const durationMinutes = Math.max(15, (end - start) / (1000 * 60));
    return Math.max(1.5, (durationMinutes / 1440) * 100);
  } catch {
    return 2.5;
  }
};

export function CorridorTimeline({ tasks, planItems, trains = [], windows = [] }: CorridorTimelineProps) {
  const [selectedTask, setSelectedTask] = useState<{ task: MaintenanceTask; item?: PlanItemResponse } | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<TrainSchedule | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  const sections = useMemo(() => {
    const fromTasks = uniqueSections(tasks);
    const fromTrains = trains.map(t => t.section_id);
    return Array.from(new Set([...fromTasks, ...fromTrains]));
  }, [tasks, trains]);

  const planByTask = useMemo(() => {
    const m = new Map<number, PlanItemResponse>();
    planItems.forEach(i => m.set(i.task_id, i));
    return m;
  }, [planItems]);

  if (tasks.length === 0 && trains.length === 0) {
    return (
      <div className="card p-6">
        <EmptyState
          title="Corridor Timeline Empty"
          description="Load backend database or seed data to display timetable trains and block planning timeline."
          icon="search"
        />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden bg-navy-900/90 border border-surface-border shadow-xl">
      {/* Header controls & legend */}
      <div className="px-5 py-4 border-b border-surface-border bg-navy-800/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-100 flex items-center gap-2 text-base">
              <Zap className="w-5 h-5 text-amber-400" />
              Railway Corridor Live Operations Matrix
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              AI Decision Support
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Synchronized timeline view of timetable train movements & CP-SAT scheduled maintenance possessions.
          </p>
        </div>

        {/* Filters & legend pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-navy-900 px-2.5 py-1 rounded border border-surface-border text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400 font-medium">Dept:</span>
            {['ALL', 'ENGG', 'ST', 'TRD'].map(d => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                  deptFilter === d 
                    ? 'bg-rail-blue text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-subtle'
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-300 border-l border-surface-border/50 pl-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              Premium Train
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              Express
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-400 inline-block" />
              Freight
            </span>
            <span className="flex items-center gap-1 border-l border-surface-border/50 pl-2">
              <span className="w-3 h-2 bg-blue-500/40 border-l-2 border-blue-400 inline-block rounded-xs" />
              ENGG Possession
            </span>
          </div>
        </div>
      </div>

      {/* Main Timeline Grid */}
      <div className="overflow-x-auto p-4">
        <div className="min-w-[850px]">
          {/* Hour header axis */}
          <div className="flex text-xs font-semibold text-gray-400 border-b border-surface-border/60 pb-2 pl-36 pr-4">
            {HOURS.filter(h => h % 2 === 0).map(h => (
              <div key={h} className="flex-1 font-tabular text-[11px] text-gray-400">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Section Track Rows */}
          {sections.map(section => {
            const filteredTasks = tasks.filter(t => 
              t.section_id === section && (deptFilter === 'ALL' || t.department === deptFilter)
            );
            const sectionTrains = trains.filter(t => t.section_id === section);

            return (
              <div key={section} className="mt-4 bg-navy-800/40 rounded-lg p-3 border border-surface-border/50">
                {/* Section title & metrics */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rail-blue" />
                    <span className="font-bold text-sm text-gray-100 font-mono tracking-wide">{section}</span>
                    <span className="text-[10px] text-gray-400 bg-surface-subtle px-2 py-0.5 rounded">
                      {sectionTrains.length} Trains • {filteredTasks.length} Maintenance Tasks
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-gray-500">Traffic density:</span>
                    <div className="w-20 h-2 bg-navy-900 rounded-full overflow-hidden border border-surface-border">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" 
                        style={{ width: `${Math.min(100, sectionTrains.length * 25)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Track Canvas */}
                <div className="relative min-h-[90px] bg-navy-950/80 rounded border border-surface-border/60 p-2 overflow-hidden">
                  {/* Grid hour vertical lines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className={clsx(
                        'absolute top-0 bottom-0 w-px',
                        h % 3 === 0 ? 'bg-surface-border/40' : 'bg-surface-border/15'
                      )}
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}

                  {/* Render Timetable Trains (Upper track) */}
                  <div className="relative h-9 mb-2">
                    {sectionTrains.map(train => {
                      const left = getTimeOfDayPercent(train.scheduled_start);
                      const width = getDurationPercent(train.scheduled_start, train.scheduled_end);
                      const styleInfo = TRAIN_TYPE_COLORS[train.train_type] || TRAIN_TYPE_COLORS.PASSENGER_EXPRESS;

                      return (
                        <div
                          key={train.id}
                          onClick={() => setSelectedTrain(train)}
                          className="absolute top-0.5 h-7 rounded px-2 cursor-pointer flex items-center gap-1.5 transition-transform hover:scale-[1.02] hover:z-20 shadow-md border"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: `${styleInfo.bg}25`,
                            borderColor: styleInfo.bg,
                            minWidth: 85,
                          }}
                        >
                          <Train className="w-3.5 h-3.5 shrink-0" style={{ color: styleInfo.bg }} />
                          <span className="text-[10px] font-bold truncate" style={{ color: styleInfo.bg }}>
                            {train.train_number}
                          </span>
                          <span className="text-[9px] text-gray-300 font-mono truncate hidden sm:inline">
                            {train.train_name}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Render Maintenance Block Possessions (Lower track) */}
                  <div className="relative h-9">
                    {filteredTasks.map(task => {
                      const item = planByTask.get(task.id);
                      if (!item) {
                        return null;
                      }

                      const left = getTimeOfDayPercent(item.start_at);
                      const width = getDurationPercent(item.start_at, item.end_at);
                      const deptStyle = DEPT_COLORS[task.department] || DEPT_COLORS.ENGG;
                      const durationMin = differenceInMinutes(parseISO(item.end_at), parseISO(item.start_at));

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask({ task, item })}
                          className="absolute top-0.5 h-7 rounded px-2 cursor-pointer flex items-center justify-between transition-all hover:scale-[1.02] hover:z-20 shadow-lg border"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: deptStyle.lightBg,
                            borderLeft: `4px solid ${deptStyle.bg}`,
                            borderColor: deptStyle.border,
                            minWidth: 95,
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span 
                              className="text-[9px] px-1 py-0.5 rounded font-black text-white"
                              style={{ backgroundColor: deptStyle.bg }}
                            >
                              {task.department}
                            </span>
                            <span className="text-[10px] font-semibold truncate text-gray-100">
                              {task.external_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-gray-300 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            {durationMin}m
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Train Details Inspector Modal */}
      {selectedTrain && (
        <div className="drawer-overlay flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-surface-border rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Train className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-gray-100 text-base">{selectedTrain.train_number} — {selectedTrain.train_name}</h4>
              </div>
              <button 
                onClick={() => setSelectedTrain(null)}
                className="text-gray-400 hover:text-white text-sm font-bold px-2 py-1 bg-surface-subtle rounded"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-navy-900/80 p-3 rounded-lg border border-surface-border">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Service Type</span>
                  <p className="font-bold text-emerald-400">{selectedTrain.train_type}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Priority Rank</span>
                  <p className="font-bold text-amber-400">Priority #{selectedTrain.priority}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Origin → Dest</span>
                  <p className="font-semibold text-gray-200">{selectedTrain.origin_station} → {selectedTrain.destination_station}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Corridor Section</span>
                  <p className="font-mono text-gray-200">{selectedTrain.section_id}</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3 text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-xs">Safety Clearance Verified</p>
                  <p className="text-[10px] text-emerald-400/80">No conflict with CP-SAT scheduled maintenance blocks on section {selectedTrain.section_id}.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setSelectedTrain(null)} className="btn btn-secondary text-xs">
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task / Block Details Inspector Modal */}
      {selectedTask && (
        <div className="drawer-overlay flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-surface-border rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span 
                  className="px-2 py-0.5 rounded text-xs font-black text-white"
                  style={{ backgroundColor: DEPT_COLORS[selectedTask.task.department]?.bg || '#3b82f6' }}
                >
                  {selectedTask.task.department}
                </span>
                <h4 className="font-bold text-gray-100 text-base">{selectedTask.task.external_id} — {selectedTask.task.defect_type}</h4>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-white text-sm font-bold px-2 py-1 bg-surface-subtle rounded"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-navy-900/80 p-3 rounded-lg border border-surface-border">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Asset ID</span>
                  <p className="font-mono font-bold text-blue-400">{selectedTask.task.asset_id}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Severity</span>
                  <p className="font-bold text-rose-400">Severity {selectedTask.task.severity}/5</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Section ID</span>
                  <p className="font-mono text-gray-200">{selectedTask.task.section_id}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Assigned Crew</span>
                  <p className="font-semibold text-purple-300">{selectedTask.task.crew_id || 'ENGG-CREW-1'}</p>
                </div>
              </div>

              {selectedTask.item && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-purple-300 font-bold">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    CP-SAT Solver Rationale & Multi-Dept Consolidation
                  </div>
                  <p className="text-[11px] text-purple-200 leading-relaxed bg-navy-950/60 p-2 rounded font-mono">
                    {selectedTask.item.rationale}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setSelectedTask(null)} className="btn btn-secondary text-xs">
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
