import apiClient from './client';
import type { StationResponse } from '../types';

export async function getStations(): Promise<StationResponse[]> {
  const res = await apiClient.get<StationResponse[]>('/gis/stations');
  return res.data;
}
