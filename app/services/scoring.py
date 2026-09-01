from datetime import datetime, timezone
from app.models.entities import MaintenanceTask


def score_task(task: MaintenanceTask, now: datetime | None = None) -> tuple[float, str]:
    """Explainable MVP score. Replace with a trained model once outcome labels exist."""
    now = now or datetime.now(timezone.utc)
    due = task.due_by if task.due_by.tzinfo else task.due_by.replace(tzinfo=timezone.utc)
    days_overdue = max(0, (now - due).days)
    severity_points = task.severity * 12
    overdue_points = min(30, days_overdue * 3)
    traffic_points = min(20, task.traffic_density * 0.2)
    history_points = min(10, task.failure_history * 0.1)
    score = round(min(100, severity_points + overdue_points + traffic_points + history_points), 1)
    why = f"severity={severity_points:.0f}, overdue={overdue_points:.0f}, traffic={traffic_points:.0f}, failure-history={history_points:.0f}"
    return score, why

