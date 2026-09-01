import apiClient from './client';
import type { PlanningRunRequest, PlanResponse, ApprovalRequest } from '../types';

export async function generatePlan(data: PlanningRunRequest): Promise<PlanResponse> {
  const res = await apiClient.post<PlanResponse>('/plans/generate', data);
  return res.data;
}

export async function getPlan(planId: number): Promise<PlanResponse> {
  const res = await apiClient.get<PlanResponse>(`/plans/${planId}`);
  return res.data;
}

export async function approvePlan(planId: number, data: ApprovalRequest): Promise<PlanResponse> {
  const res = await apiClient.post<PlanResponse>(`/plans/${planId}/approve`, data);
  return res.data;
}

export async function publishPlan(planId: number): Promise<PlanResponse> {
  const res = await apiClient.post<PlanResponse>(`/plans/${planId}/publish`, {});
  return res.data;
}

// ─── Plan ID history in localStorage ────────────────────────────────────────
// NOTE: Backend has no GET /plans (list) endpoint.
// We track plan IDs locally and fetch individually.

const PLAN_HISTORY_KEY = 'rail_plan_history';

export function savePlanIdToHistory(planId: number): void {
  const history = getPlanHistory();
  if (!history.includes(planId)) {
    history.unshift(planId);
    localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  }
}

export function getPlanHistory(): number[] {
  try {
    return JSON.parse(localStorage.getItem(PLAN_HISTORY_KEY) ?? '[]') as number[];
  } catch {
    return [];
  }
}

export function getLatestPlanId(): number | null {
  const history = getPlanHistory();
  return history.length > 0 ? history[0] : null;
}

export function clearPlanHistory(): void {
  localStorage.removeItem(PLAN_HISTORY_KEY);
}
