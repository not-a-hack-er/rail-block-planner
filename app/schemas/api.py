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


class ApprovalRequest(BaseModel):
    comment: str | None = None

