import sys
import json
from app.services.railradar_provider import RailRadarProvider
from app.services.train_discovery_service import TrainDiscoveryService
from app.services.train_service import TrainService
from app.services.tracking_service import TrackingService
from app.database import SessionLocal

def audit():
    db = SessionLocal()
    test_trains = ['57411', '12760', '12761', '12759', '12713', '17645', '99999']
    
    print("=" * 80)
    print("RAILRADAR FINAL AUDIT")
    print("=" * 80)
    
    for tn in test_trains:
        print(f"\n--- AUDITING TRAIN {tn} ---")
        # 1. TrainDiscoveryService
        disc = TrainDiscoveryService.discover_train(tn, db=db)
        if not disc.get("success"):
            print(f"Discovery: Train not found (expected for 99999). Error: {disc.get('error')}")
            # Check 404 behavior on endpoints
            tracking_res = TrackingService.get_live_tracking(db, tn)
            pos_res = TrainService.get_train_position(db, tn)
            map_res = TrainService.get_train_map(db, tn)
            details_res = TrainService.get_train_details(db, tn)
            print(f"TrackingService 404: {tracking_res is None}")
            print(f"TrainPosition 404: {pos_res is None}")
            print(f"TrainMap 404: {map_res is None}")
            print(f"TrainDetails 404: {details_res is None}")
            continue

        train = disc.get("train", {})
        print(f"Train Name: {train.get('train_name')}")
        print(f"Source: {train.get('source')} ({train.get('source_code')}) - lat/lng: {train.get('source_latitude')}, {train.get('source_longitude')}")
        print(f"Destination: {train.get('destination')} ({train.get('destination_code')}) - lat/lng: {train.get('destination_latitude')}, {train.get('destination_longitude')}")
        print(f"Current Station: {train.get('current_station')} ({train.get('current_station_code')})")
        print(f"Next Station: {train.get('next_station')} ({train.get('next_station_code')})")
        print(f"Live GPS: lat={train.get('latitude')}, lng={train.get('longitude')}, location_type={train.get('location_type')}")
        print(f"Station Coords: lat={train.get('station_latitude')}, lng={train.get('station_longitude')}")
        print(f"Speed: {train.get('speed')} | speed_status: {train.get('speed_status')} | speedStatus: {train.get('speedStatus')}")
        print(f"Delay: {train.get('delay_minutes')} min")
        print(f"Halts Count: {len(train.get('stations', []))}")
        print(f"Route Coords Count: {len(train.get('route_coordinates', []))}")

        # Check endpoints consistency
        tracking = TrackingService.get_live_tracking(db, tn)
        pos = TrainService.get_train_position(db, tn)
        t_map = TrainService.get_train_map(db, tn)
        details = TrainService.get_train_details(db, tn)

        print("\nCross-Endpoint Consistency Check:")
        print(f"  Tracking: lat={tracking.get('latitude')}, lng={tracking.get('longitude')}, speed={tracking.get('speed')}, speed_status={tracking.get('speed_status')}, src={tracking.get('source')}, dst={tracking.get('destination')}")
        print(f"  Position: lat={pos.get('latitude')}, lng={pos.get('longitude')}, speed={pos.get('speed')}, speed_status={pos.get('speed_status')}, src={pos.get('source')}, dst={pos.get('destination')}")
        print(f"  Map:      lat={t_map.get('current_position', {}).get('latitude')}, lng={t_map.get('current_position', {}).get('longitude')}, speed={t_map.get('speed')}, src={t_map.get('source')}, dst={t_map.get('destination')}")
        print(f"  Details:  lat={details.get('latitude')}, lng={details.get('longitude')}, speed={details.get('speed')}, src={details.get('source')}, dst={details.get('destination')}")

    db.close()

if __name__ == "__main__":
    audit()
