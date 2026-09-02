import apiClient from './client';
import type { WindowCreate, BlockWindow } from '../types';

export async function createWindow(data: WindowCreate): Promise<{ id: number }> {
  const res = await apiClient.post<{ id: number }>('/windows', data);
  return res.data;
}

export async function getWindows(): Promise<BlockWindow[]> {
  const res = await apiClient.get<BlockWindow[]>('/windows');
  return res.data;
}

