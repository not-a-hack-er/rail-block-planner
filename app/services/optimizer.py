from dataclasses import dataclass
from datetime import datetime, timedelta
from ortools.sat.python import cp_model
from app.models.entities import BlockWindow, MaintenanceTask


@dataclass
class ScheduledAssignment:
    task: MaintenanceTask
    window: BlockWindow
    start_at: datetime
    end_at: datetime


def optimize(tasks: list[MaintenanceTask], windows: list[BlockWindow], max_seconds: int) -> tuple[list[ScheduledAssignment], list[int]]:
    """Schedules each task at most once. Hard safety rules: section match, fit, one crew/job per window.
    A production deployment should add route topology, possessions and interlocking constraints here."""
    model = cp_model.CpModel()
    choices: dict[tuple[int, int], object] = {}
    candidates: dict[int, list[BlockWindow]] = {}
    for task in tasks:
        candidates[task.id] = [w for w in windows if w.section_id == task.section_id and (w.end_at - w.start_at).total_seconds() >= task.estimated_minutes * 60]
        for window in candidates[task.id]:
            choices[(task.id, window.id)] = model.NewBoolVar(f"task_{task.id}_window_{window.id}")
        model.Add(sum(choices[(task.id, w.id)] for w in candidates[task.id]) <= 1)

    for window in windows:
        vars_in_window = [choices[(t.id, window.id)] for t in tasks if (t.id, window.id) in choices]
        if vars_in_window:
            model.Add(sum(vars_in_window) <= 1)
    for crew in {t.crew_id for t in tasks if t.crew_id}:
        crew_tasks = [t for t in tasks if t.crew_id == crew]
        for window in windows:
            vars_for_crew = [choices[(t.id, window.id)] for t in crew_tasks if (t.id, window.id) in choices]
            if vars_for_crew:
                model.Add(sum(vars_for_crew) <= 1)

    # Scheduling a high score in low-traffic window has the highest value.
    model.Maximize(sum(int((t.criticality_score or 0) * 100 - w.traffic_load * 5) * choices[(t.id, w.id)] for t in tasks for w in candidates[t.id]))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_seconds
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [], [t.id for t in tasks]
    assigned, assigned_ids = [], set()
    for task in tasks:
        for window in candidates[task.id]:
            if solver.Value(choices[(task.id, window.id)]):
                assigned.append(ScheduledAssignment(task, window, window.start_at, window.start_at + timedelta(minutes=task.estimated_minutes)))
                assigned_ids.add(task.id)
    return assigned, [t.id for t in tasks if t.id not in assigned_ids]

