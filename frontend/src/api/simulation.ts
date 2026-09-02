import apiClient from './client';
import type { SimulationRequest, SimulationResponse } from '../types';

export async function runSimulation(data: SimulationRequest): Promise<SimulationResponse> {
  const res = await apiClient.post<SimulationResponse>('/simulation/run', data);
  return res.data;
}
