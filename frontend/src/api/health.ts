import apiClient from './client';
import type { HealthResponse } from '../types';

export async function checkHealth(): Promise<HealthResponse> {
  const res = await apiClient.get<HealthResponse>('/health');
  return res.data;
}

export async function checkHealthDetailed(): Promise<Record<string, unknown>> {
  const res = await apiClient.get<Record<string, unknown>>('/health/detailed');
  return res.data;
}

export async function resetAndSeed(): Promise<{ status: string; message: string }> {
  const res = await apiClient.post<{ status: string; message: string }>('/seed/reset');
  return res.data;
}

export async function getAnalyticsSummary(): Promise<Record<string, unknown>> {
  const res = await apiClient.get<Record<string, unknown>>('/analytics/summary');
  return res.data;
}
