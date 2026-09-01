from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, require_roles
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import Approval, BlockPlan, BlockWindow, MaintenanceTask, PlanHorizon, PlanItem, PlanStatus, User, UserRole
from app.schemas.api import ApprovalRequest, LoginRequest, PlanItemResponse, PlanResponse, PlanningRunRequest, TaskCreate, TokenResponse, UserCreate, WindowCreate
from app.services.optimizer import optimize
from app.services.scoring import score_task

router = APIRouter()


def plan_response(plan: BlockPlan, unscheduled: list[int] | None = None) -> PlanResponse:
    return PlanResponse(id=plan.id, horizon=plan.horizon, status=plan.status, version=plan.version,
                        scheduled_count=len(plan.items), unscheduled_task_ids=unscheduled or [],
                        items=[PlanItemResponse(task_id=i.task_id, window_id=i.window_id, start_at=i.start_at, end_at=i.end_at, rationale=i.rationale) for i in plan.items])


@router.post("/auth/register", status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(409, "Email already registered")
    user = User(email=data.email, password_hash=hash_password(data.password), role=data.role)
    db.add(user); db.commit()
    return {"id": user.id, "email": user.email, "role": user.role}


@router.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return TokenResponse(access_token=create_access_token(str(user.id), user.role.value))


@router.post("/tasks", status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.PLANNER, UserRole.ADMIN))):
    if db.scalar(select(MaintenanceTask).where(MaintenanceTask.external_id == data.external_id)):
        raise HTTPException(409, "external_id already exists")
    task = MaintenanceTask(**data.model_dump())
    task.criticality_score, task.score_explanation = score_task(task)
    db.add(task); db.commit(); db.refresh(task)
    return {"id": task.id, "criticality_score": task.criticality_score, "explanation": task.score_explanation}


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.scalars(select(MaintenanceTask).order_by(MaintenanceTask.criticality_score.desc())).all()


@router.post("/windows", status_code=201)
def create_window(data: WindowCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.PLANNER, UserRole.ADMIN))):
    if data.end_at <= data.start_at:
        raise HTTPException(422, "end_at must be after start_at")
    if db.scalar(select(BlockWindow).where(BlockWindow.external_id == data.external_id)):
        raise HTTPException(409, "external_id already exists")
    window = BlockWindow(**data.model_dump()); db.add(window); db.commit(); db.refresh(window)
    return {"id": window.id}


@router.post("/plans/generate", response_model=PlanResponse, status_code=201)
def generate_plan(data: PlanningRunRequest, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.PLANNER, UserRole.ADMIN))):
    if data.ends_at <= data.starts_at:
        raise HTTPException(422, "ends_at must be after starts_at")
    tasks = db.scalars(select(MaintenanceTask).where(MaintenanceTask.due_by <= data.ends_at)).all()
    for task in tasks:
        task.criticality_score, task.score_explanation = score_task(task)
    windows = db.scalars(select(BlockWindow).where(BlockWindow.start_at >= data.starts_at, BlockWindow.end_at <= data.ends_at)).all()
    assignments, unscheduled = optimize(tasks, windows, data.max_solver_seconds)
    plan = BlockPlan(horizon=data.horizon, status=PlanStatus.DRAFT, created_by_id=user.id)
    db.add(plan); db.flush()
    for a in assignments:
        rationale = f"Priority {a.task.criticality_score}/100 ({a.task.score_explanation}); selected low-impact compatible block window."
        db.add(PlanItem(plan_id=plan.id, task_id=a.task.id, window_id=a.window.id, start_at=a.start_at, end_at=a.end_at, rationale=rationale))
    db.commit(); db.refresh(plan)
    return plan_response(plan, unscheduled)


@router.get("/plans/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    plan = db.get(BlockPlan, plan_id)
    if not plan: raise HTTPException(404, "Plan not found")
    return plan_response(plan)


@router.post("/plans/{plan_id}/approve", response_model=PlanResponse)
def approve_plan(plan_id: int, data: ApprovalRequest, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.DEPARTMENT_APPROVER, UserRole.SENIOR_DOM, UserRole.ADMIN))):
    plan = db.get(BlockPlan, plan_id)
    if not plan: raise HTTPException(404, "Plan not found")
    if plan.status != PlanStatus.DRAFT: raise HTTPException(409, "Only draft plans can be approved")
    db.add(Approval(plan_id=plan.id, approved_by_id=user.id, role=user.role, comment=data.comment))
    # In a railway deployment require configured department signatures here; MVP requires Sr DOM or admin final sign-off.
    if user.role in (UserRole.SENIOR_DOM, UserRole.ADMIN): plan.status = PlanStatus.APPROVED
    db.commit(); db.refresh(plan)
    return plan_response(plan)


@router.post("/plans/{plan_id}/publish", response_model=PlanResponse)
def publish_plan(plan_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.SENIOR_DOM, UserRole.ADMIN))):
    plan = db.get(BlockPlan, plan_id)
    if not plan: raise HTTPException(404, "Plan not found")
    if plan.status != PlanStatus.APPROVED: raise HTTPException(409, "Plan needs Senior DOM approval before publishing")
    # Replace this controlled boundary with BDMS / COA clients; never publish directly from a solver run.
    plan.status = PlanStatus.PUBLISHED; db.commit(); db.refresh(plan)
    return plan_response(plan)


@router.get("/health")
def health(): return {"status": "ok", "time": datetime.now(timezone.utc)}
