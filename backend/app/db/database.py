import os
from datetime import datetime, date, time, timedelta
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Engine configuration
connect_args = {}
if settings.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": 8}

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator:
    """FastAPI Dependency providing a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_connection() -> dict:
    """Verifies live connection to the database without leaking credentials."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "database": "unavailable"}

def init_db():
    """Validates schema tables and ensures baseline corridor seed data exists."""
    from app.models.station import Station
    from app.models.train import Train
    from app.models.route import TrainRoute
    from app.models.train_position import TrainPosition
    from app.models.prediction import ETAPrediction
    from app.models.history import HistoricalRun
    from app.models.delay_event import DelayEvent

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        pass

    db = SessionLocal()
    try:
        if db.query(Train).count() == 0:
            seed_demo_data(db)
    except Exception as e:
        db.rollback()
    finally:
        db.close()

def seed_demo_data(db):
    """Populates complete South Central Railway corridor demo records including routes, positions, predictions, and history."""
    from app.models.station import Station
    from app.models.train import Train
    from app.models.route import TrainRoute
    from app.models.train_position import TrainPosition
    from app.models.prediction import ETAPrediction
    from app.models.history import HistoricalRun
    from app.models.delay_event import DelayEvent

    # ─── 1. STATIONS ───
    stations_data = [
        {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "code": "HYB", "name": "Hyderabad Deccan", "city": "Hyderabad", "lat": 17.392000, "lng": 78.473500},
        {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", "code": "KZJ", "name": "Kazipet Junction", "city": "Kazipet", "lat": 17.978400, "lng": 79.516700},
        {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", "code": "WL",  "name": "Warangal", "city": "Warangal", "lat": 17.968900, "lng": 79.594100},
        {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14", "code": "BZA", "name": "Vijayawada Junction", "city": "Vijayawada", "lat": 16.518600, "lng": 80.619500},
        {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15", "code": "MAS", "name": "Chennai Central", "city": "Chennai", "lat": 13.082700, "lng": 80.270700},
    ]

    station_map = {}
    for s in stations_data:
        st = db.query(Station).filter(Station.station_code == s["code"]).first()
        if not st:
            st = Station(
                id=s["id"],
                station_code=s["code"],
                station_name=s["name"],
                city=s["city"],
                latitude=s["lat"],
                longitude=s["lng"]
            )
            db.add(st)
            db.flush()
        station_map[s["code"]] = st

    # ─── 2. TRAINS ───
    trains_data = [
        {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01", "num": "12401", "name": "Demo Express", "src": "HYB", "dst": "MAS", "status": "MINOR_DELAY"},
        {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02", "num": "12605", "name": "South Corridor Express", "src": "HYB", "dst": "MAS", "status": "ON_TIME"},
        {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03", "num": "12760", "name": "Coastal Superfast", "src": "HYB", "dst": "MAS", "status": "MAJOR_DELAY"},
        {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04", "num": "12728", "name": "Godavari Superfast", "src": "HYB", "dst": "BZA", "status": "ON_TIME"},
        {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05", "num": "12704", "name": "Faluknama Express", "src": "HYB", "dst": "MAS", "status": "MINOR_DELAY"},
        {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06", "num": "12616", "name": "Grand Trunk Express", "src": "BZA", "dst": "MAS", "status": "ON_TIME"},
    ]

    train_map = {}
    for t in trains_data:
        tr = db.query(Train).filter(Train.train_number == t["num"]).first()
        if not tr:
            tr = Train(
                id=t["id"],
                train_number=t["num"],
                train_name=t["name"],
                source_station_id=station_map[t["src"]].id,
                destination_station_id=station_map[t["dst"]].id,
                status=t["status"]
            )
            db.add(tr)
        train_map[t["num"]] = tr
    db.flush()

    # ─── 3. TRAIN ROUTES (ordered corridor stops) ───
    route_definitions = {
        "12401": [
            ("HYB", 1, None, "18:15", 0.0),
            ("KZJ", 2, "20:18", "20:20", 132.0),
            ("WL",  3, "20:38", "20:40", 142.0),
            ("BZA", 4, "22:36", "22:45", 349.0),
            ("MAS", 5, "05:45", None, 785.0),
        ],
        "12605": [
            ("HYB", 1, None, "18:30", 0.0),
            ("KZJ", 2, "20:30", "20:32", 132.0),
            ("WL",  3, "20:50", "20:52", 142.0),
            ("BZA", 4, "22:36", "22:46", 349.0),
            ("MAS", 5, "06:00", None, 785.0),
        ],
        "12760": [
            ("HYB", 1, None, "17:45", 0.0),
            ("KZJ", 2, "19:50", "19:55", 132.0),
            ("WL",  3, "20:15", "20:17", 142.0),
            ("BZA", 4, "22:15", "22:25", 349.0),
            ("MAS", 5, "05:20", None, 785.0),
        ],
        "12728": [
            ("HYB", 1, None, "17:05", 0.0),
            ("KZJ", 2, "19:10", "19:12", 132.0),
            ("WL",  3, "19:30", "19:32", 142.0),
            ("BZA", 4, "21:50", None, 349.0),
        ],
        "12704": [
            ("HYB", 1, None, "16:00", 0.0),
            ("KZJ", 2, "18:05", "18:07", 132.0),
            ("WL",  3, "18:25", "18:27", 142.0),
            ("BZA", 4, "21:00", "21:10", 349.0),
            ("MAS", 5, "04:15", None, 785.0),
        ],
        "12616": [
            ("BZA", 1, None, "21:40", 0.0),
            ("MAS", 2, "06:15", None, 436.0),
        ],
    }

    for train_num, stops in route_definitions.items():
        tr = train_map.get(train_num)
        if not tr:
            continue
        existing = db.query(TrainRoute).filter(TrainRoute.train_id == tr.id).count()
        if existing > 0:
            continue
        for (code, seq, arr_str, dep_str, dist) in stops:
            st = station_map.get(code)
            if not st:
                continue
            arr_time = datetime.strptime(arr_str, "%H:%M").time() if arr_str else None
            dep_time = datetime.strptime(dep_str, "%H:%M").time() if dep_str else None
            db.add(TrainRoute(
                train_id=tr.id,
                station_id=st.id,
                sequence_number=seq,
                scheduled_arrival=arr_time,
                scheduled_departure=dep_time,
                distance_from_source=dist
            ))
    db.flush()

    # ─── 4. TRAIN POSITIONS (current location for each train) ───
    position_data = [
        ("12401", "WL", "BZA", 17.9689, 79.5941, 78, 6),
        ("12605", "WL", "BZA", 17.8900, 79.6900, 74, 3),
        ("12760", "KZJ", "WL", 17.9784, 79.5167, 62, 18),
        ("12728", "WL", "BZA", 17.2473, 80.1514, 82, 1),
        ("12704", "WL", "BZA", 17.5986, 80.0044, 71, 8),
        ("12616", "BZA", "MAS", 15.5057, 80.0499, 89, 0),
    ]

    for (train_num, curr_code, next_code, lat, lng, speed, delay) in position_data:
        tr = train_map.get(train_num)
        if not tr:
            continue
        existing = db.query(TrainPosition).filter(TrainPosition.train_id == tr.id).count()
        if existing > 0:
            continue
        curr_st = station_map.get(curr_code)
        next_st = station_map.get(next_code)
        db.add(TrainPosition(
            train_id=tr.id,
            latitude=lat,
            longitude=lng,
            speed=speed,
            current_station_id=curr_st.id if curr_st else None,
            next_station_id=next_st.id if next_st else None,
            current_delay_minutes=delay,
            recorded_at=datetime.utcnow()
        ))
    db.flush()

    # ─── 5. ETA PREDICTIONS (initial baseline predictions) ───
    now = datetime.utcnow()
    prediction_data = [
        ("12401", "BZA", "22:36", "22:42", 6, 0.91, "ML"),
        ("12605", "BZA", "22:36", "22:39", 3, 0.93, "ML"),
        ("12760", "WL",  "20:15", "20:33", 18, 0.87, "BASELINE"),
        ("12728", "BZA", "21:50", "21:51", 1, 0.96, "ML"),
        ("12704", "BZA", "21:00", "21:08", 8, 0.92, "ML"),
        ("12616", "MAS", "06:15", "06:15", 0, 0.95, "ML"),
    ]

    for (train_num, st_code, sch_str, pred_str, delay, conf, ptype) in prediction_data:
        tr = train_map.get(train_num)
        st = station_map.get(st_code)
        if not tr or not st:
            continue
        existing = db.query(ETAPrediction).filter(ETAPrediction.train_id == tr.id).count()
        if existing > 0:
            continue
        sch_parts = [int(p) for p in sch_str.split(":")]
        pred_parts = [int(p) for p in pred_str.split(":")]
        sch_dt = now.replace(hour=sch_parts[0], minute=sch_parts[1], second=0, microsecond=0)
        pred_dt = now.replace(hour=pred_parts[0], minute=pred_parts[1], second=0, microsecond=0)
        db.add(ETAPrediction(
            train_id=tr.id,
            station_id=st.id,
            scheduled_eta=sch_dt,
            predicted_eta=pred_dt,
            predicted_delay_minutes=delay,
            confidence=conf,
            prediction_type=ptype,
            model_version="1.0" if ptype == "ML" else "v1-baseline"
        ))
    db.flush()

    # ─── 6. HISTORICAL RUNS (recent performance records) ───
    history_entries = [
        ("12401", "WL",  "20:38", "20:39", 140, 1, "2026-09-05"),
        ("12401", "KZJ", "20:18", "20:18", 125, 0, "2026-09-05"),
        ("12605", "KZJ", "20:30", "20:35", 128, 5, "2026-09-05"),
        ("12760", "HYB", "17:45", "17:57", 10, 12, "2026-09-05"),
        ("12728", "WL",  "19:30", "19:31", 148, 1, "2026-09-04"),
        ("12704", "KZJ", "18:05", "18:11", 130, 6, "2026-09-04"),
        ("12616", "BZA", "21:40", "21:41", 5, 1, "2026-09-04"),
        ("12401", "BZA", "22:36", "22:38", 240, 2, "2026-09-03"),
        ("12605", "BZA", "22:36", "22:45", 245, 9, "2026-09-03"),
    ]

    for (train_num, st_code, sch_str, act_str, travel, delay, dt_str) in history_entries:
        tr = train_map.get(train_num)
        st = station_map.get(st_code)
        if not tr or not st:
            continue
        existing = db.query(HistoricalRun).filter(HistoricalRun.train_id == tr.id).count()
        if existing > 0:
            continue
        sch_time = datetime.strptime(sch_str, "%H:%M").time()
        act_time = datetime.strptime(act_str, "%H:%M").time()
        j_date = datetime.strptime(dt_str, "%Y-%m-%d").date()
        db.add(HistoricalRun(
            train_id=tr.id,
            station_id=st.id,
            scheduled_arrival=sch_time,
            actual_arrival=act_time,
            travel_time_minutes=travel,
            delay_minutes=delay,
            journey_date=j_date
        ))
    db.flush()

    db.commit()
    print("✓ TrainETA: Full corridor seed data loaded (stations, trains, routes, positions, predictions, history)")
