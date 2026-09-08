"""
Verification script for Google Maps & RailRadar live train telemetry synchronization.
Tests endpoints for train 57411, 12761, 12760, and 99999.
"""
import sys
import httpx

BASE_URL = "http://localhost:8001"

def test_endpoint(name, url):
    print(f"\n--- Testing {name}: {url} ---")
    try:
        r = httpx.get(url, timeout=15)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            return data
        else:
            print(f"Response: {r.text[:200]}")
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def verify():
    print("==================================================")
    print("VERIFYING AUTHORITATIVE TELEMETRY PIPELINE")
    print("==================================================")

    # 1. Test /api/trains/57411
    d_train = test_endpoint("Train 57411 Metadata", f"{BASE_URL}/api/trains/57411")
    assert d_train is not None, "Failed to fetch /api/trains/57411"
    lat = d_train.get("latitude")
    lng = d_train.get("longitude")
    loc_type = d_train.get("location_type")
    st_count = len(d_train.get("stations") or [])
    rc_count = len(d_train.get("route_coordinates") or [])
    print(f"57411: lat={lat}, lng={lng}, loc_type={loc_type}")
    print(f"57411: stations={st_count}, route_coords={rc_count}")
    assert lat is not None and lng is not None, "lat/lng should not be None!"
    assert not (lat == 0.0 and lng == 0.0), "lat/lng should not be (0, 0) Null Island!"
    assert st_count > 0, "stations should not be empty!"
    assert rc_count > 0, "route_coordinates should not be empty!"

    # 2. Test /api/trains/57411/details
    d_details = test_endpoint("Train 57411 Details", f"{BASE_URL}/api/trains/57411/details")
    assert d_details is not None, "Failed to fetch /api/trains/57411/details"
    d_lat = d_details.get("latitude")
    d_lng = d_details.get("longitude")
    print(f"57411 Details: lat={d_lat}, lng={d_lng}")
    assert d_lat == lat and d_lng == lng, f"Details lat/lng ({d_lat},{d_lng}) must match main train ({lat},{lng})!"

    # 3. Test /api/trains/57411/map
    d_map = test_endpoint("Train 57411 Map Telemetry", f"{BASE_URL}/api/trains/57411/map")
    assert d_map is not None, "Failed to fetch /api/trains/57411/map"
    m_pos = d_map.get("current_position", {})
    m_lat = m_pos.get("latitude")
    m_lng = m_pos.get("longitude")
    m_st_count = len(d_map.get("stations") or [])
    m_rc_count = len(d_map.get("route_coordinates") or [])
    print(f"57411 Map: lat={m_lat}, lng={m_lng}, stations={m_st_count}, route_coords={m_rc_count}")
    assert m_lat == lat and m_lng == lng, f"Map current_position ({m_lat},{m_lng}) must match authoritative position ({lat},{lng})!"
    assert m_st_count == st_count, f"Map stations ({m_st_count}) must match discovered stations ({st_count})!"
    assert m_rc_count == rc_count, f"Map route_coordinates ({m_rc_count}) must match discovered route_coordinates ({rc_count})!"

    # 4. Test /api/tracking/57411
    d_tracking = test_endpoint("Train 57411 Live Tracking", f"{BASE_URL}/api/tracking/57411")
    assert d_tracking is not None, "Failed to fetch /api/tracking/57411"
    t_lat = d_tracking.get("latitude")
    t_lng = d_tracking.get("longitude")
    print(f"57411 Tracking: lat={t_lat}, lng={t_lng}")
    assert t_lat == lat and t_lng == lng, f"Tracking lat/lng ({t_lat},{t_lng}) must match authoritative position ({lat},{lng})!"

    # 5. Test /api/trains/57411/position
    d_pos = test_endpoint("Train 57411 Latest Position", f"{BASE_URL}/api/trains/57411/position")
    assert d_pos is not None, "Failed to fetch /api/trains/57411/position"
    p_lat = d_pos.get("latitude")
    p_lng = d_pos.get("longitude")
    print(f"57411 Position: lat={p_lat}, lng={p_lng}")
    assert p_lat == lat and p_lng == lng, f"Position lat/lng ({p_lat},{p_lng}) must match authoritative position ({lat},{lng})!"

    # 6. Test train 12761
    d_12761 = test_endpoint("Train 12761", f"{BASE_URL}/api/trains/12761")
    if d_12761:
        print(f"12761: lat={d_12761.get('latitude')}, lng={d_12761.get('longitude')}, halts={len(d_12761.get('timeline') or [])}")

    # 7. Test invalid train 99999
    print(f"\n--- Testing Invalid Train: {BASE_URL}/api/trains/99999 ---")
    r_inv = httpx.get(f"{BASE_URL}/api/trains/99999", timeout=15)
    print(f"Status for 99999: {r_inv.status_code}")
    assert r_inv.status_code == 404, f"Invalid train 99999 should return 404, got {r_inv.status_code}"

    print("\n==================================================")
    print("ALL MAP COORDINATE TESTS PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    verify()
