import apiClient from './client';
import type { WindowCreate } from '../types';

export async function createWindow(data: WindowCreate): Promise<{ id: number }> {
  const res = await apiClient.post<{ id: number }>('/windows', data);
  return res.data;
}

// NOTE: Backend has no GET /windows endpoint.
// Windows created during a session are stored in localStorage by the UI layer.
