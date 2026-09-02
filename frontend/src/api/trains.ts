import apiClient from './client';
import type { TrainSchedule } from '../types';

export async function getTrains(): Promise<TrainSchedule[]> {
  const res = await apiClient.get<TrainSchedule[]>('/trains');
  return res.data;
}

export const listTrains = getTrains;

