import pandas as pd
import random
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.history import HistoricalRun
from app.models.delay_event import DelayEvent
from app.models.route import TrainRoute
from app.models.train import Train
from app.models.station import Station

def get_historical_features(db: Session) -> pd.DataFrame:
    """
    Extracts features from HistoricalRun, TrainRoute, DelayEvent tables.
    Constructs features identical to what the predictor will receive.
    """
    runs = db.query(HistoricalRun).all()
    if not runs:
        return pd.DataFrame()

    data = []
    for run in runs:
        scheduled_arrival = run.scheduled_arrival
        hour_of_day = scheduled_arrival.hour
        day_of_week = run.journey_date.weekday()
        is_rush_hour = 1 if (7 <= hour_of_day <= 9) or (17 <= hour_of_day <= 19) else 0

        base_travel_time = max(10, run.travel_time_minutes - run.delay_minutes)
        # Reconstruct simulated physics for historical runs
        distance_km = base_travel_time * (random.uniform(60, 90) / 60)
        speed = distance_km / (base_travel_time / 60)
        current_delay = max(0, run.delay_minutes - random.randint(0, 10))

        data.append({
            "train_id": run.train_id,
            "station_id": run.station_id,
            "scheduled_hour": hour_of_day,
            "day_of_week": day_of_week,
            "is_rush_hour": is_rush_hour,
            "base_travel_time": base_travel_time,
            "current_delay": current_delay,
            "current_speed": speed,
            "distance_km": distance_km,
            "remaining_travel_time_minutes": run.travel_time_minutes # Target
        })
    
    df = pd.DataFrame(data)
    
    if not df.empty:
        # Calculate historical average delay at this station
        df['historical_delay_minutes'] = df['remaining_travel_time_minutes'] - df['base_travel_time']
        avg_delays = df.groupby(['train_id', 'station_id'])['historical_delay_minutes'].mean().reset_index()
        avg_delays.rename(columns={'historical_delay_minutes': 'avg_station_delay'}, inplace=True)
        df = df.merge(avg_delays, on=['train_id', 'station_id'], how='left')
        df.drop(columns=['historical_delay_minutes', 'train_id', 'station_id'], inplace=True)
        
    return df

def create_features(
    current_delay: float,
    speed: float,
    distance_km: float,
    scheduled_hour: int,
    day_of_week: int,
    avg_station_delay: float
) -> pd.DataFrame:
    """
    Build a feature vector for prediction matching training features exactly.
    """
    is_rush_hour = 1 if (7 <= scheduled_hour <= 9) or (17 <= scheduled_hour <= 19) else 0
    base_travel_time = (distance_km / max(1, speed)) * 60

    data = {
        "scheduled_hour": [scheduled_hour],
        "day_of_week": [day_of_week],
        "is_rush_hour": [is_rush_hour],
        "base_travel_time": [base_travel_time],
        "current_delay": [current_delay],
        "current_speed": [speed],
        "distance_km": [distance_km],
        "avg_station_delay": [avg_station_delay]
    }
    
    # Ensure column order matches training
    cols = ['scheduled_hour', 'day_of_week', 'is_rush_hour', 'base_travel_time', 'current_delay', 'current_speed', 'distance_km', 'avg_station_delay']
    return pd.DataFrame(data)[cols]

