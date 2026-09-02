import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks, differenceInMinutes
} from 'date-fns';
import { listTasks } from '../api/tasks';
import { getPlan, getLatestPlanId, getPlans } from '../api/plans';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateComponents';
import { DeptBadge } from '../components/ui/Badges';
import { durationLabel } from '../utils';
import type { PlanItemResponse, MaintenanceTask } from '../types';
import { clsx } from '../utils/clsx';

const DEPT_COLORS: Record<string, string> = { ENGG: '#3b82f6', TRD: '#f59e0b', ST: '#8b5cf6' };
type ViewMode = 'month' | 'week';

export function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: tasks = [], isLoading: tLoading, error: tErr } = useQuery({ queryKey: ['tasks'], queryFn: listTasks });

  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: getPlans });
  const plan = plans.length > 0 ? plans[0] : null;

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

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

  const days = useMemo(() => {
    if (viewMode === 'month') {
      return eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
    }
    return eachDayOfInterval({ start: startOfWeek(viewDate), end: endOfWeek(viewDate) });
  }, [viewDate, viewMode]);

  const navigate = (dir: -1 | 1) => {
    if (viewMode === 'month') setViewDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    else setViewDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
  };

  const goToToday = () => setViewDate(new Date());

  const viewLabel = viewMode === 'month'
    ? format(viewDate, 'MMMM yyyy')
    : format(startOfWeek(viewDate), 'dd MMM') + ' – ' + format(endOfWeek(viewDate), 'dd MMM yyyy');

  if (tLoading) return <div className="p-8"><LoadingState label="Loading calendar…" /></div>;
  if (tErr) return <div className="p-8"><ErrorState message="Failed to load data." /></div>;

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayOfWeek = viewMode === 'month' ? days[0].getDay() : 0;
  const selectedDayItems = selectedDay ? (itemsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-start justify-between border-b border-surface-border pb-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar size={20} className="text-rail-blue" />
            Plans / Calendar
          </h1>
          <p className="page-subtitle mt-1">
            {viewMode === 'month' ? 'Monthly' : 'Weekly'} view of scheduled maintenance blocks · {plan?.items?.length ?? 0} blocks scheduled
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 bg-navy-800 border border-surface-border rounded-lg p-1">
            {(['month', 'week'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)} className={clsx('text-[10px] font-bold px-2.5 py-1 rounded transition-all', viewMode === v ? 'bg-rail-blue text-white' : 'text-gray-400 hover:text-gray-200')}>
                {v === 'month' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>
          <button onClick={goToToday} className="btn-secondary text-xs py-1.5 px-3">Today</button>
          <button onClick={() => navigate(-1)} className="btn-icon"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-200 w-48 text-center">{viewLabel}</span>
          <button onClick={() => navigate(1)} className="btn-icon"><ChevronRight size={16} /></button>
        </div>
      </div>

      {!plan ? (
        <div className="card"><EmptyState title="No plan to display" description="Run the Block Planner to generate a plan with scheduled blocks." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-surface-border">
            {weekdays.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={"empty-" + i} className="border-r border-b border-surface-border/50 min-h-[90px] bg-navy-900/30" />
            ))}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayItems = itemsByDay.get(key) ?? [];
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay === key;
              const totalMinutes = dayItems.reduce((sum, { item }) => sum + differenceInMinutes(parseISO(item.end_at), parseISO(item.start_at)), 0);
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={clsx(
                    'border-r border-b border-surface-border/50 min-h-[90px] p-1.5 transition-colors cursor-pointer',
                    isSelected ? 'bg-rail-blue/10 border-rail-blue/30' : isToday ? 'bg-rail-blue/5' : 'hover:bg-surface-raised/30'
                  )}
                >
                  <div className={clsx('text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full', isToday ? 'bg-rail-blue text-white' : 'text-gray-500')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, viewMode === 'week' ? 6 : 3).map(({ item, task }) => (
                      <div
                        key={item.task_id}
                        title={task.external_id + " — " + task.defect_type + "\n" + format(parseISO(item.start_at), 'HH:mm') + "–" + format(parseISO(item.end_at), 'HH:mm')}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded truncate"
                        style={{ backgroundColor: (DEPT_COLORS[task.department] ?? '#6b7280') + '20', borderLeft: "2px solid " + (DEPT_COLORS[task.department] ?? '#6b7280'), color: DEPT_COLORS[task.department] ?? '#9ca3af' }}
                      >
                        {task.external_id}
                      </div>
                    ))}
                    {dayItems.length > (viewMode === 'week' ? 6 : 3) && <div className="text-[9px] text-gray-600 px-1">+{dayItems.length - (viewMode === 'week' ? 6 : 3)} more</div>}
                    {totalMinutes > 0 && (
                      <div className="text-[9px] text-gray-600 px-1 mt-0.5">{durationLabel(totalMinutes)} track time</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day drill-down panel */}
      {selectedDay && selectedDayItems.length > 0 && (
        <div className="card p-4 space-y-3 animate-slide-up">
          <h3 className="text-sm font-bold text-gray-100">{format(parseISO(selectedDay), 'EEEE, dd MMMM yyyy')} — {selectedDayItems.length} scheduled block{selectedDayItems.length !== 1 ? 's' : ''}</h3>
          <div className="space-y-2">
            {selectedDayItems.map(({ item, task }) => (
              <div key={item.task_id} className="flex items-center gap-3 p-2.5 bg-navy-900 rounded border border-surface-border/50">
                <div style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: DEPT_COLORS[task.department] ?? '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-200">{task.defect_type}</p>
                  <p className="text-[10px] text-gray-500">{task.external_id} · {task.section_id}</p>
                </div>
                <DeptBadge dept={task.department} />
                <span className="text-[10px] font-mono text-gray-400">
                  {format(parseISO(item.start_at), 'HH:mm')}–{format(parseISO(item.end_at), 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap">
        {Object.entries(DEPT_COLORS).map(([dept, color]) => (
          <div key={dept} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color + '20', borderLeft: "2px solid " + color }} />
            {dept === 'ENGG' ? 'Engineering' : dept === 'TRD' ? 'Traction' : 'Signal & Telecom'}
          </div>
        ))}
        <span className="text-xs text-gray-600 ml-auto">Click a day to drill down · {plan?.items?.length ?? 0} blocks from Plan #{plan?.id}</span>
      </div>
    </div>
  );
}
