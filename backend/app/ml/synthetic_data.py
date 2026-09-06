import random
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from app.models.station import Station
from app.models.train import Train
from app.models.route import TrainRoute
from app.models.history import HistoricalRun
from app.models.delay_event import DelayEvent

def generate_synthetic_historical_data(db: Session, num_records=5000):
    """
    Generates synthetic historical railway data ONLY for ML prototype training when real data is unavailable.
    Do NOT claim this represents real railway statistics.
    """
    print(f"Generating {num_records} synthetic historical runs...")
    
    trains = db.query(Train).all()
    stations = db.query(Station).all()
    
    if not trains or not stations:
        print("Missing basic seed data (trains/stations). Cannot generate synthetic history.")
        return

    routes = db.query(TrainRoute).all()
    if not routes:
        # Create some fake routes for the trains
        for t in trains:
            dist = 0.0
            for i, st in enumerate(stations):
                db.add(TrainRoute(
                    train_id=t.id,
                    station_id=st.id,
                    sequence_number=i+1,
                    distance_from_source=dist,
                    scheduled_arrival=(datetime.now().replace(hour=10) + timedelta(minutes=i*45)).time(),
                    scheduled_departure=(datetime.now().replace(hour=10) + timedelta(minutes=i*45 + 5)).time()
                ))
                dist += random.uniform(40.0, 70.0)
        db.commit()

    start_date = date.today() - timedelta(days=90)
    
    runs = []
    delays = []
    
    for i in range(num_records):
        t = random.choice(trains)
        st = random.choice(stations)
        
        journey_date = start_date + timedelta(days=random.randint(0, 90))
        
        # Base travel time
        base_travel = random.randint(30, 180)
        
        # Time of day effect (rush hour = more delay)
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        scheduled = datetime.strptime(f"{hour:02d}:{minute:02d}:00", "%H:%M:%S").time()
        
        rush_hour_penalty = 0
        if (7 <= hour <= 9) or (17 <= hour <= 19):
            rush_hour_penalty = random.randint(5, 20)
            
        weather_penalty = 0
        if random.random() < 0.1:
            weather_penalty = random.randint(10, 45) # Bad weather
            
        is_delayed = random.random() < 0.3 or rush_hour_penalty > 0 or weather_penalty > 0
        delay_minutes = 0
        
        if is_delayed:
            delay_minutes = random.randint(1, 15) + rush_hour_penalty + weather_penalty
            
        actual_time = (datetime.combine(journey_date, scheduled) + timedelta(minutes=delay_minutes)).time()
        
        runs.append(HistoricalRun(
            train_id=t.id,
            station_id=st.id,
            scheduled_arrival=scheduled,
            actual_arrival=actual_time,
            travel_time_minutes=base_travel + delay_minutes,
            delay_minutes=delay_minutes,
            journey_date=journey_date,
            created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30))
        ))
        
        if delay_minutes > 15:
            reasons = ["Signal Failure", "Track Maintenance", "Weather Conditions", "Congestion", "Technical Issue"]
            delays.append(DelayEvent(
                train_id=t.id,
                station_id=st.id,
                delay_minutes=delay_minutes,
                reason=random.choice(reasons),
                recorded_at=datetime.combine(journey_date, actual_time)
            ))
            
        if len(runs) >= 1000:
            db.bulk_save_objects(runs)
            db.bulk_save_objects(delays)
            runs = []
            delays = []
            
    if runs:
        db.bulk_save_objects(runs)
    if delays:
        db.bulk_save_objects(delays)
        
    db.commit()
    print("Synthetic data generation complete.")

if __name__ == '__main__':
    from app.database import SessionLocal
    db = SessionLocal()
    generate_synthetic_historical_data(db)
    db.close()
