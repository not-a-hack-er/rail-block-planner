/**
 * DEMO DATA — ISOLATED FRONTEND LAYER
 * =====================================
 * This module provides synthetic data for features that have NO backend support yet.
 * All demo data is clearly labeled in the UI with a "DEMO — SYNTHETIC DATA" banner.
 *
 * Features using this module:
 *  - Simulation page (no backend simulation endpoint)
 *  - Seed demo data (creates real data via POST /tasks + POST /windows)
 *
 * When the backend gains these features, delete this module and wire the real API.
 */

import type { TaskCreate, WindowCreate } from '../types';
import { addDays, addHours, addMinutes, startOfDay } from 'date-fns';

// ─── Seed data for demo ─────────────────────────────────────────────────────
// These are sent to the REAL API (POST /tasks, POST /windows) to populate the DB.
// This is NOT fake data — it calls real endpoints with realistic sample payloads.

export function buildSeedTasks(baseDate: Date): TaskCreate[] {
  const base = startOfDay(baseDate);
  const iso = (d: Date) => d.toISOString();

  return [
    {
      external_id: 'TMS-1001',
      department: 'ENGG',
      source: 'TMS',
      asset_id: 'TRACK-77',
      section_id: 'NDLS-GZB-UP',
      defect_type: 'Rail Crack',
      severity: 5,
      raised_on: iso(addDays(base, -5)),
      due_by: iso(addDays(base, 1)),
      estimated_minutes: 90,
      crew_id: 'ENGG-CREW-1',
      traffic_density: 85,
      failure_history: 25,
    },
    {
      external_id: 'TMS-1002',
      department: 'ENGG',
      source: 'TMS',
      asset_id: 'BRIDGE-12',
      section_id: 'GZB-NDLS-DN',
      defect_type: 'Girder Corrosion',
      severity: 4,
      raised_on: iso(addDays(base, -3)),
      due_by: iso(addDays(base, 3)),
      estimated_minutes: 120,
      crew_id: 'ENGG-CREW-2',
      traffic_density: 60,
      failure_history: 10,
    },
    {
      external_id: 'SMMS-2001',
      department: 'ST',
      source: 'SMMS',
      asset_id: 'SIG-NDLS-14',
      section_id: 'NDLS-GZB-UP',
      defect_type: 'Signal Cable Fault',
      severity: 4,
      raised_on: iso(addDays(base, -2)),
      due_by: iso(addDays(base, 2)),
      estimated_minutes: 60,
      crew_id: 'ST-CREW-1',
      traffic_density: 85,
      failure_history: 5,
    },
    {
      external_id: 'TDMS-3001',
      department: 'TRD',
      source: 'TDMS',
      asset_id: 'OHE-GZB-SECT-3',
      section_id: 'GZB-NDLS-DN',
      defect_type: 'OHE Tension Loss',
      severity: 3,
      raised_on: iso(addDays(base, -1)),
      due_by: iso(addDays(base, 4)),
      estimated_minutes: 45,
      crew_id: 'TRD-CREW-1',
      traffic_density: 60,
      failure_history: 8,
    },
    {
      external_id: 'TMS-1003',
      department: 'ENGG',
      source: 'TMS',
      asset_id: 'TRACK-88',
      section_id: 'NDLS-GZB-UP',
      defect_type: 'Joint Failure',
      severity: 3,
      raised_on: iso(addDays(base, 0)),
      due_by: iso(addDays(base, 5)),
      estimated_minutes: 75,
      crew_id: 'ENGG-CREW-3',
      traffic_density: 70,
      failure_history: 12,
    },
    {
      external_id: 'SMMS-2002',
      department: 'ST',
      source: 'SMMS',
      asset_id: 'AXLE-COUNTER-7',
      section_id: 'GZB-NDLS-DN',
      defect_type: 'Axle Counter Reset',
      severity: 2,
      raised_on: iso(addDays(base, -1)),
      due_by: iso(addDays(base, 6)),
      estimated_minutes: 30,
      crew_id: 'ST-CREW-2',
      traffic_density: 55,
      failure_history: 3,
    },
  ];
}

export function buildSeedWindows(baseDate: Date): WindowCreate[] {
  const base = startOfDay(baseDate);
  const iso = (d: Date) => d.toISOString();
  const tomorrow = addDays(base, 1);

  return [
    {
      external_id: 'COA-901',
      section_id: 'NDLS-GZB-UP',
      start_at: iso(addHours(tomorrow, 1)),     // 01:00
      end_at: iso(addHours(tomorrow, 3)),       // 03:00
      traffic_load: 10,
      caution_ok: true,
    },
    {
      external_id: 'COA-902',
      section_id: 'NDLS-GZB-UP',
      start_at: iso(addHours(tomorrow, 3)),     // 03:00
      end_at: iso(addHours(tomorrow, 5)),       // 05:00
      traffic_load: 8,
      caution_ok: true,
    },
    {
      external_id: 'COA-903',
      section_id: 'GZB-NDLS-DN',
      start_at: iso(addHours(tomorrow, 2)),     // 02:00
      end_at: iso(addMinutes(addHours(tomorrow, 4), 30)),   // 04:30
      traffic_load: 15,
      caution_ok: false,
    },
    {
      external_id: 'COA-904',
      section_id: 'GZB-NDLS-DN',
      start_at: iso(addHours(tomorrow, 23)),    // 23:00
      end_at: iso(addHours(addDays(tomorrow, 1), 1)),  // next 01:00
      traffic_load: 5,
      caution_ok: true,
    },
  ];
}

// ─── Simulation scenarios (no backend support) ───────────────────────────────

export type SimScenarioId =
  | 'normal'
  | 'maintenance_overrun_30'
  | 'maintenance_overrun_60'
  | 'freight_surge'
  | 'passenger_peak'
  | 'emergency_defect';

export interface SimScenario {
  id: SimScenarioId;
  label: string;
  description: string;
  disturbanceLabel: string;
  overrunMinutes: number;
  conflictDescription: string;
  replanNote: string;
  baselineDelay: number;
  newDelay: number;
  blocksAffected: number;
  replanSuccess: boolean;
  newWindowOffset: number; // minutes shifted
}

export const SIM_SCENARIOS: Record<SimScenarioId, SimScenario> = {
  normal: {
    id: 'normal',
    label: 'Normal Traffic',
    description: 'No disturbances. Base plan holds.',
    disturbanceLabel: 'None',
    overrunMinutes: 0,
    conflictDescription: 'No conflicts detected.',
    replanNote: 'Base plan is retained. No replanning required.',
    baselineDelay: 0,
    newDelay: 0,
    blocksAffected: 0,
    replanSuccess: true,
    newWindowOffset: 0,
  },
  maintenance_overrun_30: {
    id: 'maintenance_overrun_30',
    label: 'Maintenance Overrun +30 min',
    description: 'A maintenance task exceeds its planned duration by 30 minutes.',
    disturbanceLabel: 'Overrun: +30 min',
    overrunMinutes: 30,
    conflictDescription: 'Block extends into next scheduled window. Train approaching section.',
    replanNote: 'Uncommitted horizon replanned. Committed decisions locked. New window assigned.',
    baselineDelay: 0,
    newDelay: 18,
    blocksAffected: 1,
    replanSuccess: true,
    newWindowOffset: 35,
  },
  maintenance_overrun_60: {
    id: 'maintenance_overrun_60',
    label: 'Maintenance Overrun +60 min',
    description: 'A maintenance task exceeds its planned duration by 60 minutes.',
    disturbanceLabel: 'Overrun: +60 min',
    overrunMinutes: 60,
    conflictDescription: 'Block extends into peak morning window. 2 trains affected.',
    replanNote: 'Partial replanning executed. 1 task deferred to next available window.',
    baselineDelay: 0,
    newDelay: 42,
    blocksAffected: 2,
    replanSuccess: true,
    newWindowOffset: 70,
  },
  freight_surge: {
    id: 'freight_surge',
    label: 'Freight Surge +40%',
    description: 'Unexpected increase in freight traffic demand on a key corridor.',
    disturbanceLabel: 'Freight +40%',
    overrunMinutes: 0,
    conflictDescription: 'Planned window now overlaps high-demand freight slot.',
    replanNote: 'Alternative low-traffic window identified. Block shifted to avoid freight peak.',
    baselineDelay: 0,
    newDelay: 8,
    blocksAffected: 1,
    replanSuccess: true,
    newWindowOffset: 90,
  },
  passenger_peak: {
    id: 'passenger_peak',
    label: 'Passenger Peak',
    description: 'Passenger demand spike due to festival season.',
    disturbanceLabel: 'Passenger peak demand',
    overrunMinutes: 0,
    conflictDescription: 'Planned early-morning window conflicts with additional passenger services.',
    replanNote: 'Block window moved to late night slot with lower passenger density.',
    baselineDelay: 0,
    newDelay: 12,
    blocksAffected: 1,
    replanSuccess: true,
    newWindowOffset: 120,
  },
  emergency_defect: {
    id: 'emergency_defect',
    label: 'Emergency Critical Defect',
    description: 'High-criticality defect detected requiring immediate maintenance.',
    disturbanceLabel: 'Emergency task inserted',
    overrunMinutes: 0,
    conflictDescription: 'Emergency task requires same section as currently planned block.',
    replanNote: 'Emergency task given priority. Existing block rescheduled to next window.',
    baselineDelay: 0,
    newDelay: 25,
    blocksAffected: 2,
    replanSuccess: true,
    newWindowOffset: 45,
  },
};
