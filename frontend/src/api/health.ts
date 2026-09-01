import apiClient from './client';
import type { HealthResponse } from '../types';

export async function checkHealth(): Promise<HealthResponse> {
  const res = await apiClient.get<HealthResponse>('/health');
  return res.data;
}
