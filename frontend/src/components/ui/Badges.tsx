import React from 'react';
import type { PlanStatus, Department } from '../../types';
import { getSeverityLabel, getSeverityColor, getRiskLabel, getScoreColor, deptLabel } from '../../utils';
import { clsx } from '../../utils/clsx';

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: PlanStatus }) {
  const map: Record<PlanStatus, string> = {
    DRAFT: 'badge-amber',
    APPROVED: 'badge-blue',
    PUBLISHED: 'badge-green',
  };
  return <span className={map[status]}>{status}</span>;
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: number }) {
  const color = getSeverityColor(severity);
  const label = getSeverityLabel(severity);
  const map = { red: 'badge-red', amber: 'badge-amber', green: 'badge-green' };
  return (
    <span className={map[color as keyof typeof map] ?? 'badge-gray'}>
      {severity} — {label}
    </span>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────
export function RiskBadge({ score }: { score: number }) {
  const color = getScoreColor(score);
  const label = getRiskLabel(score);
  const map = { red: 'badge-red', amber: 'badge-amber', green: 'badge-green' };
  return (
    <span className={map[color as keyof typeof map] ?? 'badge-gray'}>
      {label}
    </span>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
export function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = score >= 70 ? 'bg-rail-red' : score >= 40 ? 'bg-rail-amber' : 'bg-rail-green';
  return (
    <div className="flex items-center gap-2">
      <div className="score-bar-bg flex-1">
        <div className={clsx('score-bar-fill', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-tabular text-gray-300 w-8 text-right">{score}</span>
    </div>
  );
}

// ─── Department Badge ─────────────────────────────────────────────────────────
export function DeptBadge({ dept }: { dept: Department | string }) {
  const cls = `dept-${dept}`;
  return <span className={clsx('badge', cls)}>{deptLabel(dept)}</span>;
}

// ─── Score Breakdown ──────────────────────────────────────────────────────────
interface ScoreBreakdownProps {
  explanation: string | null;
  score: number | null;
}

export function ScoreBreakdown({ explanation, score }: ScoreBreakdownProps) {
  if (!explanation || !score) return null;

  const extract = (key: string) => {
    const m = explanation.match(new RegExp(`${key}=(\\d+(?:\\.\\d+)?)`));
    return m ? parseFloat(m[1]) : 0;
  };

  const components = [
    { label: 'Severity', value: extract('severity'), max: 60, desc: 'Asset criticality (severity × 12)' },
    { label: 'Overdue', value: extract('overdue'), max: 30, desc: 'Days past deadline (×3, max 30)' },
    { label: 'Traffic Impact', value: extract('traffic'), max: 20, desc: 'Section traffic density (×0.2)' },
    { label: 'Failure History', value: extract('failure-history'), max: 10, desc: 'Historical failure rate (×0.1)' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">Priority Score Breakdown</span>
        <div className="flex items-center gap-1.5">
          <RiskBadge score={score} />
          <span className="text-lg font-bold font-tabular" style={{ color: score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981' }}>
            {score}
            <span className="text-xs text-gray-500 font-normal">/100</span>
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {components.map(c => (
          <div key={c.label} title={c.desc}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">{c.label}</span>
              <span className="font-tabular text-gray-300">{c.value}/{c.max}</span>
            </div>
            <div className="score-bar-bg">
              <div
                className={clsx('score-bar-fill', c.value >= c.max * 0.7 ? 'bg-rail-red' : c.value >= c.max * 0.4 ? 'bg-rail-amber' : 'bg-rail-blue')}
                style={{ width: `${(c.value / c.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overdue Indicator ────────────────────────────────────────────────────────
export function OverdueBadge({ daysUntil }: { daysUntil: number }) {
  if (daysUntil < 0) {
    return <span className="badge-red">{Math.abs(daysUntil)}d overdue</span>;
  }
  if (daysUntil <= 2) {
    return <span className="badge-amber">Due in {daysUntil}d</span>;
  }
  return <span className="badge-gray">Due in {daysUntil}d</span>;
}
