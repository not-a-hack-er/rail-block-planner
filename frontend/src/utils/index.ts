import type { MaintenanceTask, ParsedScoreExplanation, ParsedRationale, PlanItemResponse, BlockWindow } from '../types';
import { differenceInMinutes, parseISO, format, isAfter } from 'date-fns';

// ─── Score explanation parsing ───────────────────────────────────────────────
// Backend format: "severity=60, overdue=15, traffic=17, failure-history=10"
export function parseScoreExplanation(raw: string | null): ParsedScoreExplanation | null {
  if (!raw) return null;
  try {
    const extract = (key: string) => {
      const m = raw.match(new RegExp(`${key}=(\\d+(?:\\.\\d+)?)`));
      return m ? parseFloat(m[1]) : 0;
    };
    return {
      severity: extract('severity'),
      overdue: extract('overdue'),
      traffic: extract('traffic'),
      failureHistory: extract('failure-history'),
    };
  } catch {
    return null;
  }
}

// ─── Rationale parsing ───────────────────────────────────────────────────────
// Backend format: "Priority 87.0/100 (severity=60, overdue=15, traffic=10, failure-history=2); selected low-impact compatible block window."
export function parseRationale(raw: string): ParsedRationale {
  const scoreMatch = raw.match(/Priority\s+([\d.]+)\/100/);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const explanationMatch = raw.match(/\(([^)]+)\)/);
  const explanation = explanationMatch ? parseScoreExplanation(explanationMatch[1]) : null;
  return { score, explanation, message: raw };
}

// ─── Task utilities ──────────────────────────────────────────────────────────
export function getSeverityLabel(s: number): string {
  const map: Record<number, string> = { 1: 'LOW', 2: 'LOW', 3: 'MEDIUM', 4: 'HIGH', 5: 'CRITICAL' };
  return map[s] ?? 'UNKNOWN';
}

export function getSeverityColor(s: number): string {
  if (s >= 5) return 'red';
  if (s >= 4) return 'amber';
  if (s >= 3) return 'amber';
  return 'green';
}

export function isOverdue(task: MaintenanceTask): boolean {
  return isAfter(new Date(), parseISO(task.due_by));
}

export function daysUntilDue(task: MaintenanceTask): number {
  return Math.ceil((parseISO(task.due_by).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getScoreColor(score: number): string {
  if (score >= 70) return 'red';
  if (score >= 40) return 'amber';
  return 'green';
}

export function getRiskLabel(score: number): string {
  if (score >= 70) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

// ─── Department display ──────────────────────────────────────────────────────
export const DEPT_LABELS: Record<string, string> = {
  ENGG: 'Engineering',
  TRD: 'Traction (TRD)',
  ST: 'Signal & Telecom',
};

export function deptLabel(dept: string): string {
  return DEPT_LABELS[dept] ?? dept;
}

// ─── Time utilities ──────────────────────────────────────────────────────────
export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Plan item duration ──────────────────────────────────────────────────────
export function planItemDurationMinutes(item: PlanItemResponse): number {
  try {
    return differenceInMinutes(parseISO(item.end_at), parseISO(item.start_at));
  } catch {
    return 0;
  }
}

// ─── Window duration ─────────────────────────────────────────────────────────
export function windowDurationMinutes(w: BlockWindow): number {
  try {
    return differenceInMinutes(parseISO(w.end_at), parseISO(w.start_at));
  } catch {
    return 0;
  }
}

// ─── Section grouping ────────────────────────────────────────────────────────
export function uniqueSections(tasks: MaintenanceTask[]): string[] {
  return [...new Set(tasks.map(t => t.section_id))].sort();
}

// ─── Derived KPIs ────────────────────────────────────────────────────────────
export function computeKPIs(tasks: MaintenanceTask[], scheduledCount: number, unscheduledCount: number) {
  return {
    totalTasks: tasks.length,
    criticalTasks: tasks.filter(t => t.severity === 5).length,
    highTasks: tasks.filter(t => t.severity === 4).length,
    overdueTasks: tasks.filter(t => isOverdue(t)).length,
    avgScore: tasks.length > 0
      ? Math.round(tasks.reduce((s, t) => s + (t.criticality_score ?? 0), 0) / tasks.length)
      : 0,
    scheduledCount,
    unscheduledCount,
  };
}
