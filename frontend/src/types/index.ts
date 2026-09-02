// ─── TypeScript Interfaces matching backend schemas exactly ─────────────────
// Source: app/schemas/api.py, app/models/entities.py
// DO NOT add fields that don't exist in the backend.

export type Department = 'ENGG' | 'TRD' | 'ST';
export type PlanHorizon = 'WEEK' | 'MONTH';
export type PlanStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED';
export type UserRole = 'PLANNER' | 'DEPARTMENT_APPROVER' | 'SENIOR_DOM' | 'ADMIN';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserCreate {
  email: string;
  password: string;
  role?: UserRole;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

// ─── Maintenance Task ────────────────────────────────────────────────────────

export interface TaskCreate {
  external_id: string;
  department: Department;
  source: string;
  asset_id: string;
  section_id: string;
  defect_type: string;
  severity: number;         // 1 (low) to 5 (critical)
  raised_on: string;        // ISO datetime
  due_by: string;           // ISO datetime
  estimated_minutes: number;
  crew_id?: string | null;
  traffic_density?: number; // 0–100
  failure_history?: number; // 0–100
}

// Returned by GET /tasks (SQLAlchemy model as dict)
export interface MaintenanceTask {
  id: number;
  external_id: string;
  department: Department;
  source: string;
  asset_id: string;
  section_id: string;
  defect_type: string;
  severity: number;
  raised_on: string;
  due_by: string;
  estimated_minutes: number;
  crew_id: string | null;
  traffic_density: number;
  failure_history: number;
  criticality_score: number | null;
  score_explanation: string | null;
}

// ─── Block Window ────────────────────────────────────────────────────────────

export interface WindowCreate {
  external_id: string;
  section_id: string;
  start_at: string;  // ISO datetime
  end_at: string;    // ISO datetime
  traffic_load?: number; // 0–100
  caution_ok?: boolean;
}

export interface BlockWindow {
  id: number;
  external_id: string;
  section_id: string;
  start_at: string;
  end_at: string;
  traffic_load: number;
  caution_ok: boolean;
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export interface PlanningRunRequest {
  horizon: PlanHorizon;
  starts_at: string;  // ISO datetime
  ends_at: string;    // ISO datetime
  max_solver_seconds?: number; // 1–60, default 10
}

export interface PlanItemResponse {
  task_id: number;
  window_id: number;
  start_at: string;
  end_at: string;
  rationale: string;
}

export interface PlanResponse {
  id: number;
  horizon: PlanHorizon;
  status: PlanStatus;
  version: number;
  scheduled_count: number;
  unscheduled_task_ids: number[];
  items: PlanItemResponse[];
}

export interface ApprovalRequest {
  comment?: string;
}

// ─── Timetable Train ─────────────────────────────────────────────────────────

export type TrainType =
  | 'PASSENGER_PREMIUM'
  | 'PASSENGER_EXPRESS'
  | 'PASSENGER_LOCAL'
  | 'FREIGHT_CONTAINER'
  | 'FREIGHT_COAL';

export interface StationResponse {
  id: number;
  code: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
}

export interface SsoLoginRequest {
  employee_id: string;
  directory_domain?: string;
  otp_code?: string;
}

export interface MfaVerifyRequest {
  session_id: string;
  otp_code: string;
}

export interface MfaVerifyResponse {
  verified: boolean;
  access_token: string;
  user_role: UserRole;
}

export interface TrainSchedule {
  id: number;
  train_number: string;
  train_name: string;
  train_type: TrainType;
  section_id: string;
  scheduled_start: string; // ISO datetime
  scheduled_end: string;   // ISO datetime
  priority: number;       // 1 (highest) to 5
  origin_station: string;
  destination_station: string;
  current_lat?: number | null;
  current_lng?: number | null;
  speed_kph?: number | null;
}


// ─── Simulation ──────────────────────────────────────────────────────────────

export interface SimulationRequest {
  scenario_id: string;
  overrun_minutes?: number;
  section_id?: string;
}

export interface SimulationResponse {
  scenario_id: string;
  success: boolean;
  conflict_detected: boolean;
  conflict_description: string;
  replan_summary: string;
  baseline_train_delay: number;
  new_train_delay: number;
  blocks_affected: number;
  committed_horizon_locked: boolean;
  uncommitted_horizon_replanned: boolean;
  replanned_items: PlanItemResponse[];
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  time: string;
}

// ─── Frontend-derived types (not from backend) ───────────────────────────────

export interface ParsedScoreExplanation {
  severity: number;
  overdue: number;
  traffic: number;
  failureHistory: number;
}

export interface ParsedRationale {
  score: number;
  explanation: ParsedScoreExplanation | null;
  message: string;
}

// Enriched plan item with joined task + window data for UI display
export interface EnrichedPlanItem extends PlanItemResponse {
  task?: MaintenanceTask;
  window?: BlockWindow;
  durationMinutes: number;
  parsedRationale: ParsedRationale;
}

// Computed KPIs derived from real task + plan data
export interface DashboardKPIs {
  totalTasks: number;
  criticalTasks: number;       // severity === 5
  highTasks: number;           // severity === 4
  scheduledCount: number;      // plan.scheduled_count
  unscheduledCount: number;    // plan.unscheduled_task_ids.length
  planStatus: PlanStatus | null;
  latestPlanId: number | null;
}

