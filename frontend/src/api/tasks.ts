import apiClient from './client';
import type { MaintenanceTask, TaskCreate } from '../types';

export async function listTasks(): Promise<MaintenanceTask[]> {
  const res = await apiClient.get<MaintenanceTask[]>('/tasks');
  return res.data;
}

export async function createTask(data: TaskCreate): Promise<{ id: number; criticality_score: number; explanation: string }> {
  const res = await apiClient.post('/tasks', data);
  return res.data;
}
