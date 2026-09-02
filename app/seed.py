from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.entities import (
    User, UserRole, MaintenanceTask, Department, BlockWindow, BlockPlan, 
    PlanItem, PlanHorizon, PlanStatus, TrainSchedule, TrainType, Station
)
from app.services.scoring import score_task
from app.services.optimizer import optimize


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Admin User & Planner User
    if not db.scalar(select(User).where(User.email == "admin@railways.gov.in")):
        admin = User(
            email="admin@railways.gov.in",
            password_hash=hash_password("admin12345"),
            role=UserRole.ADMIN
        )
        planner = User(
            email="srdom@railways.gov.in",
            password_hash=hash_password("srdom12345"),
            role=UserRole.SENIOR_DOM
        )
        db.add_all([admin, planner])
        db.commit()

    # Clear previous seed tasks, windows, trains if needed or populate if empty
    if db.scalar(select(MaintenanceTask)):
        print("Database already contains tasks. Skipping seed.")
        db.close()
        return

    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) + timedelta(days=1)
    
    # 2. Maintenance Tasks (ENGG, S&T, TRD)
    tasks_data = [
        # NDLS-GZB-UP Corridor
        {
            "external_id": "TMS-1001",
            "department": Department.ENGG,
            "source": "TMS",
            "asset_id": "RAIL-NDLS-KM-12",
            "section_id": "NDLS-GZB-UP",
            "defect_type": "Rail Micro-Crack & Weld Defect",
            "severity": 5,
            "raised_on": base_time - timedelta(days=3),
            "due_by": base_time + timedelta(hours=36),
            "estimated_minutes": 90,
            "crew_id": "ENGG-CREW-NORTH",
            "traffic_density": 85,
            "failure_history": 30,
        },
        {
            "external_id": "SMMS-2001",
            "department": Department.ST,
            "source": "SMMS",
            "asset_id": "SIG-NDLS-AUTOMATIC-14",
            "section_id": "NDLS-GZB-UP",
            "defect_type": "Digital Axle Counter Signal Drift",
            "severity": 4,
            "raised_on": base_time - timedelta(days=2),
            "due_by": base_time + timedelta(hours=48),
            "estimated_minutes": 60,
            "crew_id": "ST-CREW-SIG1",
            "traffic_density": 85,
            "failure_history": 15,
        },
        {
            "external_id": "TDMS-3001",
            "department": Department.TRD,
            "source": "TDMS",
            "asset_id": "OHE-NDLS-SECT-4",
            "section_id": "NDLS-GZB-UP",
            "defect_type": "OHE Cantilever Insulator Replacement",
            "severity": 4,
            "raised_on": base_time - timedelta(days=1),
            "due_by": base_time + timedelta(hours=40),
            "estimated_minutes": 75,
            "crew_id": "TRD-CREW-TOWER",
            "traffic_density": 85,
            "failure_history": 20,
        },

        # GZB-NDLS-DN Corridor
        {
            "external_id": "TMS-1002",
            "department": Department.ENGG,
            "source": "TMS",
            "asset_id": "BRIDGE-GZB-GIRDER-9",
            "section_id": "GZB-NDLS-DN",
            "defect_type": "Bridge Expansion Joint Corrosion",
            "severity": 4,
            "raised_on": base_time - timedelta(days=4),
            "due_by": base_time + timedelta(hours=60),
            "estimated_minutes": 120,
            "crew_id": "ENGG-CREW-SOUTH",
            "traffic_density": 65,
            "failure_history": 10,
        },
        {
            "external_id": "SMMS-2002",
            "department": Department.ST,
            "source": "SMMS",
            "asset_id": "POINT-MACHINE-GZB-7B",
            "section_id": "GZB-NDLS-DN",
            "defect_type": "Point Machine Motor Overhaul",
            "severity": 3,
            "raised_on": base_time - timedelta(days=1),
            "due_by": base_time + timedelta(hours=72),
            "estimated_minutes": 45,
            "crew_id": "ST-CREW-POINT2",
            "traffic_density": 60,
            "failure_history": 8,
        },

        # NDLS-MTC-UP Corridor
        {
            "external_id": "TMS-1003",
            "department": Department.ENGG,
            "source": "TMS",
            "asset_id": "SWITCH-NDLS-22A",
            "section_id": "NDLS-MTC-UP",
            "defect_type": "Tongue Rail Clearance Maintenance",
            "severity": 3,
            "raised_on": base_time - timedelta(hours=12),
            "due_by": base_time + timedelta(hours=80),
            "estimated_minutes": 60,
            "crew_id": "ENGG-CREW-MTC",
            "traffic_density": 50,
            "failure_history": 5,
        },
        {
            "external_id": "TDMS-3002",
            "department": Department.TRD,
            "source": "TDMS",
            "asset_id": "OHE-NEUTRAL-SECT-1",
            "section_id": "NDLS-MTC-UP",
            "defect_type": "Neutral Section Contact Wire Wear",
            "severity": 4,
            "raised_on": base_time - timedelta(hours=18),
            "due_by": base_time + timedelta(hours=50),
            "estimated_minutes": 90,
            "crew_id": "TRD-CREW-TOWER",
            "traffic_density": 55,
            "failure_history": 18,
        },
    ]

    task_models = []
    for td in tasks_data:
        t = MaintenanceTask(**td)
        t.criticality_score, t.score_explanation = score_task(t)
        task_models.append(t)
    db.add_all(task_models)
    db.commit()

    # 3. Block Windows (Candidate possessions)
    windows_data = [
        # NDLS-GZB-UP
        {
            "external_id": "WIN-101",
            "section_id": "NDLS-GZB-UP",
            "start_at": base_time.replace(hour=1, minute=0),
            "end_at": base_time.replace(hour=5, minute=0),  # 240 mins window (ideal for consolidation)
            "traffic_load": 10.0,
            "caution_ok": True,
        },
        {
            "external_id": "WIN-102",
            "section_id": "NDLS-GZB-UP",
            "start_at": base_time.replace(hour=13, minute=0),
            "end_at": base_time.replace(hour=15, minute=0),
            "traffic_load": 45.0,
            "caution_ok": True,
        },

        # GZB-NDLS-DN
        {
            "external_id": "WIN-201",
            "section_id": "GZB-NDLS-DN",
            "start_at": base_time.replace(hour=2, minute=0),
            "end_at": base_time.replace(hour=5, minute=30),  # 210 mins window
            "traffic_load": 12.0,
            "caution_ok": False,
        },
        {
            "external_id": "WIN-202",
            "section_id": "GZB-NDLS-DN",
            "start_at": base_time.replace(hour=23, minute=0),
            "end_at": base_time.replace(hour=23, minute=0) + timedelta(hours=3),
            "traffic_load": 8.0,
            "caution_ok": True,
        },

        # NDLS-MTC-UP
        {
            "external_id": "WIN-301",
            "section_id": "NDLS-MTC-UP",
            "start_at": base_time.replace(hour=1, minute=30),
            "end_at": base_time.replace(hour=4, minute=30),
            "traffic_load": 15.0,
            "caution_ok": True,
        },
    ]

    window_models = [BlockWindow(**wd) for wd in windows_data]
    db.add_all(window_models)
    db.commit()

    # 4. Station GPS Waypoints
    stations_data = [
        {"code": "NDLS", "name": "New Delhi Junction", "lat": 28.6431, "lng": 77.2197, "zone": "NR"},
        {"code": "GZB", "name": "Ghaziabad Junction", "lat": 28.6652, "lng": 77.4385, "zone": "NR"},
        {"code": "MTC", "name": "Meerut City Junction", "lat": 28.9800, "lng": 77.7064, "zone": "NR"},
        {"code": "CNB", "name": "Kanpur Central", "lat": 26.4542, "lng": 80.3507, "zone": "NCR"},
        {"code": "PRYJ", "name": "Prayagraj Junction", "lat": 25.4358, "lng": 81.8463, "zone": "NCR"},
    ]
    db.add_all([Station(**sd) for sd in stations_data])
    db.commit()

    # 5. Timetable Train Schedules with Live GPS
    trains_data = [
        # Premium Passenger
        {
            "train_number": "22436",
            "train_name": "Vande Bharat Express",
            "train_type": TrainType.PASSENGER_PREMIUM,
            "section_id": "NDLS-GZB-UP",
            "scheduled_start": base_time.replace(hour=6, minute=0),
            "scheduled_end": base_time.replace(hour=6, minute=35),
            "priority": 1,
            "origin_station": "NDLS",
            "destination_station": "BSB",
            "current_lat": 28.6500,
            "current_lng": 77.3000,
            "speed_kph": 110.0,
        },
        {
            "train_number": "12302",
            "train_name": "Howrah Rajdhani Express",
            "train_type": TrainType.PASSENGER_PREMIUM,
            "section_id": "NDLS-GZB-UP",
            "scheduled_start": base_time.replace(hour=16, minute=50),
            "scheduled_end": base_time.replace(hour=17, minute=25),
            "priority": 1,
            "origin_station": "NDLS",
            "destination_station": "HWH",
            "current_lat": 28.6450,
            "current_lng": 77.2500,
            "speed_kph": 125.0,
        },
        # Express Passenger
        {
            "train_number": "12418",
            "train_name": "Prayagraj Express",
            "train_type": TrainType.PASSENGER_EXPRESS,
            "section_id": "NDLS-GZB-UP",
            "scheduled_start": base_time.replace(hour=22, minute=10),
            "scheduled_end": base_time.replace(hour=22, minute=50),
            "priority": 2,
            "origin_station": "NDLS",
            "destination_station": "PRYJ",
            "current_lat": 28.6431,
            "current_lng": 77.2197,
            "speed_kph": 90.0,
        },
        {
            "train_number": "12004",
            "train_name": "Lucknow Shatabdi Express",
            "train_type": TrainType.PASSENGER_PREMIUM,
            "section_id": "GZB-NDLS-DN",
            "scheduled_start": base_time.replace(hour=6, minute=10),
            "scheduled_end": base_time.replace(hour=6, minute=45),
            "priority": 1,
            "origin_station": "LKO",
            "destination_station": "NDLS",
            "current_lat": 28.6652,
            "current_lng": 77.4385,
            "speed_kph": 105.0,
        },
        # Freight Rakes
        {
            "train_number": "CONTR-8812",
            "train_name": "CONCOR Container Rake",
            "train_type": TrainType.FREIGHT_CONTAINER,
            "section_id": "NDLS-GZB-UP",
            "scheduled_start": base_time.replace(hour=10, minute=15),
            "scheduled_end": base_time.replace(hour=11, minute=0),
            "priority": 4,
            "origin_station": "TKD",
            "destination_station": "DADRI",
            "current_lat": 28.6580,
            "current_lng": 77.3700,
            "speed_kph": 65.0,
        },
        {
            "train_number": "COAL-4491",
            "train_name": "NTPC Coal Bulk Rake",
            "train_type": TrainType.FREIGHT_COAL,
            "section_id": "GZB-NDLS-DN",
            "scheduled_start": base_time.replace(hour=14, minute=20),
            "scheduled_end": base_time.replace(hour=15, minute=10),
            "priority": 5,
            "origin_station": "NTPC",
            "destination_station": "BADARPUR",
            "current_lat": 28.6600,
            "current_lng": 77.4000,
            "speed_kph": 55.0,
        },
        {
            "train_number": "EXPR-14042",
            "train_name": "Mussoorie Express",
            "train_type": TrainType.PASSENGER_EXPRESS,
            "section_id": "NDLS-MTC-UP",
            "scheduled_start": base_time.replace(hour=7, minute=30),
            "scheduled_end": base_time.replace(hour=8, minute=15),
            "priority": 3,
            "origin_station": "DLI",
            "destination_station": "KTW",
            "current_lat": 28.8000,
            "current_lng": 77.5500,
            "speed_kph": 75.0,
        },
    ]

    train_models = [TrainSchedule(**trd) for trd in trains_data]
    db.add_all(train_models)
    db.commit()

    # 5. Generate Initial CP-SAT Block Plan
    admin_user = db.scalar(select(User).where(User.email == "admin@railways.gov.in"))
    all_tasks = db.scalars(select(MaintenanceTask)).all()
    all_windows = db.scalars(select(BlockWindow)).all()
    
    assignments, unscheduled = optimize(all_tasks, all_windows, max_seconds=10)
    
    plan = BlockPlan(
        horizon=PlanHorizon.WEEK,
        status=PlanStatus.APPROVED,
        version=1,
        created_by_id=admin_user.id
    )
    db.add(plan)
    db.flush()

    for a in assignments:
        db.add(PlanItem(
            plan_id=plan.id,
            task_id=a.task.id,
            window_id=a.window.id,
            start_at=a.start_at,
            end_at=a.end_at,
            rationale=a.rationale
        ))

    db.commit()
    print(f"Successfully seeded database with {len(task_models)} tasks, {len(window_models)} windows, {len(train_models)} trains, and initial Plan ID {plan.id}.")
    db.close()


if __name__ == "__main__":
    seed_database()
