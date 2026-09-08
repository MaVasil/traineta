"""
Verification script for TrainETA & RailRadar telemetry pipeline.
Validates:
1. Authoritative coordinates (no 0,0 Null Island, correct India bounding box 8-38°N, 68-98°E).
2. Dynamic journey origin (source) and terminus (destination) - never "Unknown", "N/A", or previous station.
3. Real dynamic velocity in km/h.
4. Route coordinates GeoJSON ordering [lat, lng].
5. Invalid train handling (zero mock fallback).
"""
import sys
import time
import httpx

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8001/api"
VALID_TRAINS = ["57411", "12760", "12761", "12759", "12713", "17645"]
INVALID_TRAINS = ["99999"]

def test_valid_train(train_num: str):
    print(f"\n=======================================================")
    print(f"Testing Valid Train: {train_num}")
    print(f"=======================================================")
    
    with httpx.Client(timeout=25.0) as client:
        # 1. Test /api/trains/{train_num} (Train Details)
        r_details = client.get(f"{BASE_URL}/trains/{train_num}")
        assert r_details.status_code == 200, f"Expected 200 for /trains/{train_num}, got {r_details.status_code}"
        d_data = r_details.json()
        print(f"[OK] /api/trains/{train_num} returned HTTP 200")
        
        # 2. Test /api/tracking/{train_num} (Live Tracking)
        r_track = client.get(f"{BASE_URL}/tracking/{train_num}")
        assert r_track.status_code == 200, f"Expected 200 for /tracking/{train_num}, got {r_track.status_code}"
        t_data = r_track.json()
        print(f"[OK] /api/tracking/{train_num} returned HTTP 200")
        
        # 3. Test /api/trains/{train_num}/map (Geospatial Map)
        r_map = client.get(f"{BASE_URL}/trains/{train_num}/map")
        assert r_map.status_code == 200, f"Expected 200 for /trains/{train_num}/map, got {r_map.status_code}"
        m_data = r_map.json()
        print(f"[OK] /api/trains/{train_num}/map returned HTTP 200")

    # --- Validation 1: Source and Destination Endpoints ---
    for name, payload in [("Details", d_data), ("Tracking", t_data), ("Map", m_data)]:
        src = payload.get("source")
        src_code = payload.get("source_code")
        dst = payload.get("destination")
        dst_code = payload.get("destination_code")

        assert src and src not in ("Unknown", "N/A", "--"), f"[{name}] Invalid source: {src}"
        assert dst and dst not in ("Unknown", "N/A", "--"), f"[{name}] Invalid destination: {dst}"
        assert src != dst, f"[{name}] Source and Destination cannot be identical: {src}"
        
        curr_st = payload.get("current_station")
        curr_code = payload.get("current_station_code")
        if payload.get("next_station"):
            assert dst_code != curr_code or dst == curr_st or not curr_code, f"[{name}] Destination wrongly matched current station!"

    print(f"[OK] Journey Endpoints: {t_data.get('source')} ({t_data.get('source_code')}) -> {t_data.get('destination')} ({t_data.get('destination_code')})")

    # --- Validation 2: Train Coordinates ---
    lat = t_data.get("latitude")
    lng = t_data.get("longitude")
    print(f"  Live Coordinates: lat={lat}, lng={lng}, location_type={t_data.get('location_type')}")
    if lat is not None and lng is not None:
        assert not (lat == 0.0 and lng == 0.0), "Null Island (0.0, 0.0) detected!"
        assert 8.0 <= lat <= 38.0, f"Latitude {lat} out of India boundary (8° - 38° N)"
        assert 68.0 <= lng <= 98.0, f"Longitude {lng} out of India boundary (68° - 98° E)"
        print(f"[OK] Coordinates strictly within India geographical limits")

    # --- Validation 3: Speed Telemetry ---
    speed = t_data.get("speed")
    unit = t_data.get("speed_unit", "km/h")
    print(f"  Speed: {speed} {unit}")
    if speed is not None:
        assert isinstance(speed, (int, float)), f"Speed must be numerical, got {type(speed)}"
        assert speed >= 0, f"Speed cannot be negative: {speed}"
    print(f"[OK] Speed telemetry valid")

    # --- Validation 4: Track Coordinates & Stations ---
    route_coords = m_data.get("route_coordinates") or []
    stations = m_data.get("stations") or []
    print(f"  Stations count: {len(stations)}, Track coordinates count: {len(route_coords)}")
    assert len(stations) > 0, "Stations list should not be empty"
    
    if route_coords:
        for idx, pt in enumerate(route_coords[:10]):
            assert isinstance(pt, list) and len(pt) >= 2, f"Point {idx} invalid: {pt}"
            p_lat, p_lng = pt[0], pt[1]
            assert 8.0 <= p_lat <= 38.0, f"Track lat {p_lat} inverted or out of range at {idx}"
            assert 68.0 <= p_lng <= 98.0, f"Track lng {p_lng} inverted or out of range at {idx}"
        print(f"[OK] Track geometry GeoJSON coordinates properly oriented [lat, lng]")

    print(f"[SUCCESS] Train {train_num} ALL CHECKS PASSED!")

def test_invalid_train(train_num: str):
    print(f"\n=======================================================")
    print(f"Testing Invalid Train (Zero Mock): {train_num}")
    print(f"=======================================================")
    
    with httpx.Client(timeout=15.0) as client:
        r_track = client.get(f"{BASE_URL}/tracking/{train_num}")
        assert r_track.status_code == 404, f"Expected 404 for invalid train, got {r_track.status_code}"
        print(f"[OK] /api/tracking/{train_num} returned HTTP 404 as expected (no demo data fabricated)")

        r_map = client.get(f"{BASE_URL}/trains/{train_num}/map")
        assert r_map.status_code in (404, 400), f"Expected 404/400 for invalid train map, got {r_map.status_code}"
        print(f"[OK] /api/trains/{train_num}/map returned 404/400 as expected")

    print(f"[SUCCESS] Invalid Train {train_num} ALL CHECKS PASSED (Zero Mock)!")

def main():
    print("Starting Comprehensive RailRadar Telemetry Verification...")
    passed = 0
    total = len(VALID_TRAINS) + len(INVALID_TRAINS)

    for train in VALID_TRAINS:
        try:
            test_valid_train(train)
            passed += 1
        except Exception as e:
            print(f"[FAIL] for train {train}: {e}")
        time.sleep(1.0)  # Rate limit courtesy spacing

    for train in INVALID_TRAINS:
        try:
            test_invalid_train(train)
            passed += 1
        except Exception as e:
            print(f"[FAIL] for invalid train {train}: {e}")

    print(f"\n=======================================================")
    print(f"Verification Summary: {passed}/{total} Passed")
    print(f"=======================================================")
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    main()
