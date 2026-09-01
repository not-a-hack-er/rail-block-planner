from datetime import datetime, timedelta, timezone
from app.models.entities import Department, MaintenanceTask
from app.services.scoring import score_task


def test_overdue_critical_task_scores_higher():
    now = datetime.now(timezone.utc)
    common = dict(external_id="X", department=Department.ENGG, source="TMS", asset_id="A", section_id="S", defect_type="rail", raised_on=now, estimated_minutes=30)
    low = MaintenanceTask(**common, due_by=now + timedelta(days=5), severity=1, traffic_density=10, failure_history=0)
    high = MaintenanceTask(**{**common, "external_id": "Y"}, due_by=now - timedelta(days=5), severity=5, traffic_density=90, failure_history=50)
    assert score_task(high, now)[0] > score_task(low, now)[0]

