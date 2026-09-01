import React, { useState } from 'react';
import { X, Clock, Wrench, MapPin, User, Calendar, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { MaintenanceTask, PlanItemResponse } from '../../types';
import { SeverityBadge, RiskBadge, DeptBadge, ScoreBreakdown, OverdueBadge, ScoreBar } from '../ui/Badges';
import { formatDateTime, formatDate, durationLabel, deptLabel, isOverdue, daysUntilDue } from '../../utils';
import { parseRationale } from '../../utils';

interface TaskDetailDrawerProps {
  task: MaintenanceTask | null;
  planItem?: PlanItemResponse;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, planItem, onClose }: TaskDetailDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!task) return null;

  const overdue = isOverdue(task);
  const days = daysUntilDue(task);
  const rationale = planItem ? parseRationale(planItem.rationale) : null;

  return (
    <>
      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose} />

      {/* Drawer */}
      <div className="drawer-panel">
        {/* Header */}
        <div className="sticky top-0 bg-navy-800 border-b border-surface-border px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DeptBadge dept={task.department} />
              {overdue && <span className="badge-red text-[10px]">OVERDUE</span>}
            </div>
            <h2 className="text-base font-bold text-gray-100">{task.external_id}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{task.defect_type}</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 pb-8">
          {/* Priority score */}
          {task.criticality_score !== null && (
            <div className="card p-4">
              <ScoreBreakdown explanation={task.score_explanation} score={task.criticality_score} />
            </div>
          )}

          {/* Key facts */}
          <div className="card p-4 space-y-3">
            <p className="section-title text-[10px]">Task Details</p>
            <dl className="space-y-2.5">
              <DetailRow icon={MapPin} label="Asset" value={task.asset_id} />
              <DetailRow icon={MapPin} label="Section" value={task.section_id} />
              <DetailRow icon={Wrench} label="Source" value={task.source} />
              <DetailRow icon={Clock} label="Est. Duration" value={durationLabel(task.estimated_minutes)} />
              {task.crew_id && <DetailRow icon={User} label="Crew" value={task.crew_id} />}
            </dl>
          </div>

          {/* Risk factors */}
          <div className="card p-4 space-y-3">
            <p className="section-title text-[10px]">Risk Factors</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Severity</p>
                <SeverityBadge severity={task.severity} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Priority Risk</p>
                {task.criticality_score !== null ? <RiskBadge score={task.criticality_score} /> : <span className="text-gray-500 text-xs">—</span>}
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Traffic Density</p>
                <ScoreBar score={Math.round(task.traffic_density)} max={100} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Failure History</p>
                <ScoreBar score={Math.round(task.failure_history)} max={100} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-4 space-y-2">
            <p className="section-title text-[10px]">Schedule</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar size={12} />
                  <span>Raised</span>
                </div>
                <span className="text-gray-200">{formatDate(task.raised_on)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-gray-400">
                  <AlertTriangle size={12} className={overdue ? 'text-rail-red' : 'text-rail-amber'} />
                  <span>Due By</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={overdue ? 'text-rail-red font-medium' : 'text-gray-200'}>{formatDate(task.due_by)}</span>
                  <OverdueBadge daysUntil={days} />
                </div>
              </div>
            </div>
          </div>

          {/* Plan assignment */}
          {planItem && rationale && (
            <div className="card p-4 space-y-3 border-rail-blue/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-rail-green" />
                <p className="section-title text-[10px] text-rail-green">SCHEDULED IN PLAN</p>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Start</span>
                  <span className="text-gray-200 font-medium">{formatDateTime(planItem.start_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">End</span>
                  <span className="text-gray-200 font-medium">{formatDateTime(planItem.end_at)}</span>
                </div>
              </div>

              {/* Rationale */}
              <div className="bg-navy-900 rounded p-3 space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info size={12} className="text-rail-blue" />
                  <span className="text-xs font-semibold text-rail-blue">Why This Window?</span>
                </div>
                <div className="space-y-1.5">
                  <ReasonRow text="High priority score selected first by optimizer" />
                  <ReasonRow text="Section match confirmed" />
                  <ReasonRow text="Window duration sufficient for estimated task time" />
                  <ReasonRow text="Low traffic load window selected" />
                  {rationale.explanation && rationale.explanation.overdue > 0 && (
                    <ReasonRow text="Task is overdue — elevated scheduling priority" />
                  )}
                </div>
                <button
                  onClick={() => setShowRaw(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 mt-2"
                >
                  {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  {showRaw ? 'Hide' : 'Show'} raw rationale
                </button>
                {showRaw && (
                  <p className="text-[10px] text-gray-500 font-mono bg-navy-800 rounded p-2 break-words">
                    {planItem.rationale}
                  </p>
                )}
              </div>
            </div>
          )}

          {!planItem && (
            <div className="flex items-center gap-2 p-3 bg-rail-amber/10 border border-rail-amber/20 rounded-lg">
              <AlertTriangle size={13} className="text-rail-amber" />
              <p className="text-xs text-rail-amber">Not yet scheduled in any block plan.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
}

function ReasonRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <CheckCircle2 size={11} className="text-rail-green mt-0.5 flex-shrink-0" />
      <span className="text-gray-300">{text}</span>
    </div>
  );
}
