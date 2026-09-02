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
    rationale: str = ""


def optimize(tasks: list[MaintenanceTask], windows: list[BlockWindow], max_seconds: int = 10) -> tuple[list[ScheduledAssignment], list[int]]:
    """Schedules tasks into candidate block windows using Google OR-Tools CP-SAT.
    
    Hard Constraints Enforced:
    1. Section Match: Task section must match candidate window section.
    2. Capacity & Fit: Total duration of assigned tasks in a window cannot exceed window length.
    3. Crew Feasibility: A single crew cannot be assigned to overlapping tasks in the same window.
    4. Task Uniqueness: Each task is scheduled at most once.
    
    Objective Function:
    Maximizes weighted sum of:
    - Task Criticality Score (ML severity + failure risk)
    - Low Traffic Load Bonus (minimizes train disruption)
    - Multi-Department Consolidation Bonus (bundling ENGG + S&T + TRD into a single shadow block possession)
    """
    model = cp_model.CpModel()
    choices: dict[tuple[int, int], object] = {}
    candidates: dict[int, list[BlockWindow]] = {}

    for task in tasks:
        # Candidate windows must be in the same section and long enough for the task
        candidates[task.id] = [
            w for w in windows 
            if w.section_id == task.section_id and (w.end_at - w.start_at).total_seconds() >= task.estimated_minutes * 60
        ]
        for window in candidates[task.id]:
            choices[(task.id, window.id)] = model.NewBoolVar(f"task_{task.id}_window_{window.id}")
        
        # Each task at most once
        if candidates[task.id]:
            model.Add(sum(choices[(task.id, w.id)] for w in candidates[task.id]) <= 1)

    # Window Capacity Constraint: Sum of task durations in a window <= window duration
    for window in windows:
        vars_in_window = [(t, choices[(t.id, window.id)]) for t in tasks if (t.id, window.id) in choices]
        if vars_in_window:
            win_minutes = int((window.end_at - window.start_at).total_seconds() // 60)
            model.Add(sum(t.estimated_minutes * var for t, var in vars_in_window) <= win_minutes)

    # Crew Non-Overlap Constraint
    for crew in {t.crew_id for t in tasks if t.crew_id}:
        crew_tasks = [t for t in tasks if t.crew_id == crew]
        for window in windows:
            vars_for_crew = [choices[(t.id, window.id)] for t in crew_tasks if (t.id, window.id) in choices]
            if vars_for_crew:
                model.Add(sum(vars_for_crew) <= 1)

    # Multi-Department Consolidation Bonus variables
    consolidation_terms = []
    for window in windows:
        window_tasks = [t for t in tasks if (t.id, window.id) in choices]
        depts = {t.department for t in window_tasks}
        if len(depts) > 1:
            # Reward multi-department presence in the same window
            dept_vars = []
            for dept in depts:
                d_tasks = [choices[(t.id, window.id)] for t in window_tasks if t.department == dept]
                d_has = model.NewBoolVar(f"win_{window.id}_dept_{dept.value}")
                model.Add(sum(d_tasks) >= 1).OnlyEnforceIf(d_has)
                model.Add(sum(d_tasks) == 0).OnlyEnforceIf(d_has.Not())
                dept_vars.append(d_has)
            
            multi_dept_active = model.NewBoolVar(f"win_{window.id}_multi_dept")
            model.Add(sum(dept_vars) >= 2).OnlyEnforceIf(multi_dept_active)
            model.Add(sum(dept_vars) < 2).OnlyEnforceIf(multi_dept_active.Not())
            consolidation_terms.append(250 * multi_dept_active)

    # Objective Terms:
    # 1. Criticality score (weight: 100)
    # 2. Traffic load penalty (-5 per traffic load unit)
    # 3. Consolidation bonus (+250 for multi-department bundling)
    obj_terms = []
    for task in tasks:
        for window in candidates[task.id]:
            score = int((task.criticality_score or 0) * 100 - window.traffic_load * 5)
            obj_terms.append(score * choices[(task.id, window.id)])

    model.Maximize(sum(obj_terms) + sum(consolidation_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_seconds
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [], [t.id for t in tasks]

    assigned = []
    assigned_ids = set()

    for window in windows:
        window_assigned_tasks = []
        for task in tasks:
            if (task.id, window.id) in choices and solver.Value(choices[(task.id, window.id)]):
                window_assigned_tasks.append(task)
                assigned_ids.add(task.id)

        if not window_assigned_tasks:
            continue

        # Sort assigned tasks by criticality score descending
        window_assigned_tasks.sort(key=lambda t: t.criticality_score or 0, reverse=True)
        depts_in_window = list({t.department.value for t in window_assigned_tasks})
        is_consolidated = len(depts_in_window) > 1

        curr_start = window.start_at
        for task in window_assigned_tasks:
            task_end = curr_start + timedelta(minutes=task.estimated_minutes)
            
            # Construct detailed CP-SAT rationale
            reasons = [
                f"CP-SAT score {task.criticality_score:.1f}/100 ({task.score_explanation or 'Standard priority'})",
                f"Window {window.external_id} section fit ({window.section_id}, load: {window.traffic_load:.0f}%)",
            ]
            if is_consolidated:
                other_depts = [d for d in depts_in_window if d != task.department.value]
                reasons.append(f"Multi-Department Shadow Possession (bundled with {', '.join(other_depts)})")
            if task.crew_id:
                reasons.append(f"Crew {task.crew_id} assigned without schedule conflict")

            rationale_str = " | ".join(reasons)

            assigned.append(ScheduledAssignment(
                task=task,
                window=window,
                start_at=curr_start,
                end_at=task_end,
                rationale=rationale_str
            ))
            # Next task in window starts sequentially (or shadow block)
            curr_start = task_end

    unscheduled = [t.id for t in tasks if t.id not in assigned_ids]
    return assigned, unscheduled


