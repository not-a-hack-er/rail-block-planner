import enum
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Department(str, enum.Enum):
    ENGG = "ENGG"
    TRD = "TRD"
    ST = "ST"


class PlanHorizon(str, enum.Enum):
    WEEK = "WEEK"
    MONTH = "MONTH"


class PlanStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"


class UserRole(str, enum.Enum):
    PLANNER = "PLANNER"
    DEPARTMENT_APPROVER = "DEPARTMENT_APPROVER"
    SENIOR_DOM = "SENIOR_DOM"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.PLANNER)


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    department: Mapped[Department] = mapped_column(Enum(Department))
    source: Mapped[str] = mapped_column(String(30))
    asset_id: Mapped[str] = mapped_column(String(100))
    section_id: Mapped[str] = mapped_column(String(100), index=True)
    defect_type: Mapped[str] = mapped_column(String(120))
    severity: Mapped[int] = mapped_column(Integer)  # 1 (low) to 5 (critical)
    raised_on: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    due_by: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    crew_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    traffic_density: Mapped[float] = mapped_column(Float, default=0)
    failure_history: Mapped[float] = mapped_column(Float, default=0)
    criticality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)


class BlockWindow(Base):
    __tablename__ = "block_windows"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    section_id: Mapped[str] = mapped_column(String(100), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    traffic_load: Mapped[float] = mapped_column(Float, default=0)
    caution_ok: Mapped[bool] = mapped_column(Boolean, default=False)


class BlockPlan(Base):
    __tablename__ = "block_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    horizon: Mapped[PlanHorizon] = mapped_column(Enum(PlanHorizon))
    status: Mapped[PlanStatus] = mapped_column(Enum(PlanStatus), default=PlanStatus.DRAFT)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    items: Mapped[list["PlanItem"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanItem(Base):
    __tablename__ = "plan_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("block_plans.id"), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("maintenance_tasks.id"), index=True)
    window_id: Mapped[int] = mapped_column(ForeignKey("block_windows.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    rationale: Mapped[str] = mapped_column(Text)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[BlockPlan] = relationship(back_populates="items")


class TrainType(str, enum.Enum):
    PASSENGER_PREMIUM = "PASSENGER_PREMIUM"  # Vande Bharat, Rajdhani, Shatabdi
    PASSENGER_EXPRESS = "PASSENGER_EXPRESS"  # Mail / Express
    PASSENGER_LOCAL = "PASSENGER_LOCAL"      # Suburban / MEMU
    FREIGHT_CONTAINER = "FREIGHT_CONTAINER"  # Container Rake
    FREIGHT_COAL = "FREIGHT_COAL"            # Bulk Coal / Iron Ore Rake


class TrainSchedule(Base):
    __tablename__ = "train_schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    train_number: Mapped[str] = mapped_column(String(50), index=True)
    train_name: Mapped[str] = mapped_column(String(120))
    train_type: Mapped[TrainType] = mapped_column(Enum(TrainType))
    section_id: Mapped[str] = mapped_column(String(100), index=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    priority: Mapped[int] = mapped_column(Integer, default=1)  # 1 (Highest, e.g., Vande Bharat) to 5 (Freight)
    origin_station: Mapped[str] = mapped_column(String(50))
    destination_station: Mapped[str] = mapped_column(String(50))
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_kph: Mapped[float | None] = mapped_column(Float, nullable=True)


class Station(Base):
    __tablename__ = "stations"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    zone: Mapped[str] = mapped_column(String(50), default="NR")



class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("block_plans.id"), index=True)
    approved_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

