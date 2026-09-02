from datetime import datetime
from pydantic import BaseModel, Field
from app.models.entities import Department, PlanHorizon, PlanStatus, UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    role: UserRole = UserRole.PLANNER


class TaskCreate(BaseModel):
    external_id: str
    department: Department
    source: str
    asset_id: str
    section_id: str
    defect_type: str
    severity: int = Field(ge=1, le=5)
    raised_on: datetime
    due_by: datetime
    estimated_minutes: int = Field(gt=0)
    crew_id: str | None = None
    traffic_density: float = Field(default=0, ge=0, le=100)
    failure_history: float = Field(default=0, ge=0, le=100)


class WindowCreate(BaseModel):
    external_id: str
    section_id: str
    start_at: datetime
    end_at: datetime
    traffic_load: float = Field(default=0, ge=0, le=100)
    caution_ok: bool = False


class PlanningRunRequest(BaseModel):
    horizon: PlanHorizon
    starts_at: datetime
    ends_at: datetime
    max_solver_seconds: int = Field(default=10, ge=1, le=60)


class PlanItemResponse(BaseModel):
    task_id: int
    window_id: int
    start_at: datetime
    end_at: datetime
    rationale: str


class PlanResponse(BaseModel):
    id: int
    horizon: PlanHorizon
    status: PlanStatus
    version: int
    scheduled_count: int
    unscheduled_task_ids: list[int]
    items: list[PlanItemResponse]


class WindowResponse(BaseModel):
    id: int
    external_id: str
    section_id: str
    start_at: datetime
    end_at: datetime
    traffic_load: float
    caution_ok: bool


class TrainResponse(BaseModel):
    id: int
    train_number: str
    train_name: str
    train_type: str
    section_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    priority: int
    origin_station: str
    destination_station: str
    current_lat: float | None = None
    current_lng: float | None = None
    speed_kph: float | None = None


class StationResponse(BaseModel):
    id: int
    code: str
    name: str
    lat: float
    lng: float
    zone: str


class SsoLoginRequest(BaseModel):
    employee_id: str
    directory_domain: str = "railways.gov.in"
    otp_code: str | None = None


class MfaVerifyRequest(BaseModel):
    session_id: str
    otp_code: str


class MfaVerifyResponse(BaseModel):
    verified: bool
    access_token: str
    user_role: UserRole


class ApprovalRequest(BaseModel):
    comment: str | None = None
    mfa_otp: str | None = None



class SimulationRequest(BaseModel):
    scenario_id: str
    overrun_minutes: int = 0
    section_id: str | None = None


class SimulationResponse(BaseModel):
    scenario_id: str
    success: bool
    conflict_detected: bool
    conflict_description: str
    replan_summary: str
    baseline_train_delay: int
    new_train_delay: int
    blocks_affected: int
    committed_horizon_locked: bool
    uncommitted_horizon_replanned: bool
    replanned_items: list[PlanItemResponse]


