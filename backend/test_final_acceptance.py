import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.services.geo_utils import is_valid_india_coordinate

client = TestClient(app)

test_trains = ["57411", "12760", "12761", "12759", "12713", "17645"]

print("=" * 80)
print("FINAL AUDIT & ACCEPTANCE VERIFICATION")
print("=" * 80)

results = []

for num in test_trains:
    print(f"\n--- Testing Train {num} ---")
    
    # 1. /api/trains/{num}
    r_train = client.get(f"/api/trains/{num}")
    assert r_train.status_code == 200, f"Failed /api/trains/{num}: {r_train.status_code}"
    train_data = r_train.json()
    
    # 2. /api/tracking/{num}
    r_track = client.get(f"/api/tracking/{num}")
    assert r_track.status_code == 200, f"Failed /api/tracking/{num}: {r_track.status_code}"
    track_data = r_track.json()
    
    # 3. /api/trains/{num}/map
    r_map = client.get(f"/api/trains/{num}/map")
    assert r_map.status_code == 200, f"Failed /api/trains/{num}/map: {r_map.status_code}"
    map_data = r_map.json()

    # 4. /api/trains/{num}/position
    r_pos = client.get(f"/api/trains/{num}/position")
    assert r_pos.status_code == 200, f"Failed /api/trains/{num}/position: {r_pos.status_code}"
    pos_data = r_pos.json()

    # Extract coordinates
    lat = train_data.get("latitude")
    lng = train_data.get("longitude")
    track_lat = track_data.get("latitude")
    track_lng = track_data.get("longitude")
    map_pos = map_data.get("current_position", {})
    map_lat = map_pos.get("latitude")
    map_lng = map_pos.get("longitude")
    pos_lat = pos_data.get("latitude")
    pos_lng = pos_data.get("longitude")

    coord_valid = is_valid_india_coordinate(lat, lng)
    
    # Verify consistency across endpoints
    coords_match = (
        lat == track_lat == map_lat == pos_lat and
        lng == track_lng == map_lng == pos_lng
    )

    # Source & Destination
    src = train_data.get("source")
    src_code = train_data.get("source_code")
    dst = train_data.get("destination")
    dst_code = train_data.get("destination_code")

    # Speed & Speed Status
    speed = train_data.get("speed")
    speed_status = train_data.get("speed_status") or train_data.get("speedStatus")
    track_speed = track_data.get("speed")
    track_speed_status = track_data.get("speed_status") or track_data.get("speedStatus")
    map_speed = map_data.get("speed")
    map_speed_status = map_data.get("speed_status") or map_data.get("speedStatus")

    speed_match = (
        speed == track_speed == map_speed and
        speed_status == track_speed_status == map_speed_status
    )

    # Speed correctness check:
    # If speed is None, status must be UNAVAILABLE
    # If speed is not None (including 0), status must be LIVE
    speed_status_correct = (
        (speed is None and speed_status == "UNAVAILABLE") or
        (speed is not None and speed_status == "LIVE")
    )

    # Map polyline and halts
    route_coords = map_data.get("route_coordinates", [])
    stations = map_data.get("stations", [])

    status_pass = (
        coord_valid and 
        coords_match and 
        speed_match and 
        speed_status_correct and 
        src not in (None, "Unknown", "") and 
        dst not in (None, "Unknown", "") and 
        len(stations) > 0
    )

    row = {
        "train": num,
        "name": train_data.get("train_name"),
        "lat_lng": f"({lat}, {lng})",
        "coord_valid": coord_valid,
        "coords_consistent": coords_match,
        "source": f"{src} ({src_code})",
        "destination": f"{dst} ({dst_code})",
        "speed": f"{speed} km/h" if speed is not None else "None",
        "speed_status": speed_status,
        "speed_consistent": speed_match,
        "speed_status_correct": speed_status_correct,
        "stations_count": len(stations),
        "route_coords_count": len(route_coords),
        "result": "PASS" if status_pass else "FAIL",
    }
    results.append(row)
    print(json.dumps(row, indent=2))

print("\n" + "=" * 80)
print("FINAL AUDIT SUMMARY TABLE")
print("=" * 80)
print(f"{'Train':<8} | {'Lat, Lng':<24} | {'Source':<18} | {'Destination':<18} | {'Speed':<12} | {'Speed Status':<12} | {'Result'}")
print("-" * 110)
for r in results:
    print(f"{r['train']:<8} | {r['lat_lng']:<24} | {r['source'][:17]:<18} | {r['destination'][:17]:<18} | {r['speed']:<12} | {r['speed_status']:<12} | {r['result']}")
print("=" * 80)

all_passed = all(r["result"] == "PASS" for r in results)
print(f"OVERALL STATUS: {'ALL TESTS PASSED (100%)' if all_passed else 'SOME TESTS FAILED'}")
assert all_passed, "Not all train telemetry tests passed!"
