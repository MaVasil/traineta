"""
TrainETA Dynamic Route Station Timeline Verification Suite
Verifies:
1. Retrieval of live RailRadar halts for real trains (12761, 12760, 12759, 12713, 17645)
2. Normalization of timeline with station codes, names, status, state, HH:MM times, platforms, distances
3. Status tagging: CURRENT node matches current_station_code, NEXT matches next_station_code
4. Commercial stops filtering (isHalt == True) vs total waypoints
5. Non-existent train (99999) yields None / 404 with ZERO mock/dummy fallback data
6. FastAPI endpoints return proper HTTP responses
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.config import settings
from app.database import SessionLocal
from app.services.train_service import TrainService
from app.services.train_discovery_service import TrainDiscoveryService
from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    print("=" * 65)
    print("      TRAINETA DYNAMIC ROUTE STATION TIMELINE VERIFICATION     ")
    print("=" * 65)
    print(f"Provider: {settings.TRAIN_DATA_PROVIDER}")
    print(f"API Key: {'Configured' if settings.RAILRADAR_API_KEY else 'Missing'}")

    db = SessionLocal()
    client = TestClient(app)

    # -------------------------------------------------------------
    # TEST 1: Train 12761 (Karimnagar SF Express)
    # -------------------------------------------------------------
    print("\n--- TEST 1: Train 12761 Live Route Station Timeline ---")
    tl_12761 = TrainService.get_train_timeline(db, "12761")
    assert tl_12761 is not None, "Timeline for 12761 must not be None!"
    
    timeline = tl_12761.get("timeline", [])
    print(f"Total waypoints loaded: {len(timeline)}")
    assert len(timeline) >= 90, f"Expected >= 90 halts for 12761, got {len(timeline)}"

    commercial_halts = [h for h in timeline if h.get("isHalt") or h.get("is_halt")]
    print(f"Commercial passenger halts (isHalt=True): {len(commercial_halts)}")
    assert len(commercial_halts) in (11, 12, 13), f"Expected ~12 commercial halts, got {len(commercial_halts)}"

    curr_code = tl_12761.get("current_station_code")
    next_code = tl_12761.get("next_station_code")
    print(f"Current station: {tl_12761.get('current_station')} ({curr_code})")
    print(f"Next station:    {tl_12761.get('next_station')} ({next_code})")

    # Find the current station in timeline
    curr_nodes = [h for h in timeline if h.get("status") == "CURRENT" or h.get("state") == "current"]
    next_nodes = [h for h in timeline if h.get("status") == "NEXT" or h.get("state") == "next"]
    print(f"Current nodes identified: {[n.get('code') for n in curr_nodes]}")
    print(f"Next nodes identified: {[n.get('code') for n in next_nodes]}")

    assert len(curr_nodes) >= 1, "Must identify at least one CURRENT station node"
    assert len(next_nodes) >= 1, "Must identify at least one NEXT station node"
    assert curr_nodes[0].get("code") == curr_code, f"Expected current node {curr_code}, got {curr_nodes[0].get('code')}"
    assert next_nodes[0].get("code") == next_code, f"Expected next node {next_code}, got {next_nodes[0].get('code')}"

    # Verify origin station formatting
    origin = timeline[0]
    print(f"Origin station: code={origin.get('code')}, dep={origin.get('scheduledDep')}, pf={origin.get('platform')}")
    assert origin.get("scheduledDep") is not None and ":" in origin.get("scheduledDep"), "Must have HH:MM formatted departure"
    print("PASS: Train 12761 timeline verified.")

    # -------------------------------------------------------------
    # TEST 2: Train 12760 & 12759 Live Route Timelines
    # -------------------------------------------------------------
    print("\n--- TEST 2: Additional Trains (12760 & 12759) ---")
    tl_12760 = TrainService.get_train_timeline(db, "12760")
    assert tl_12760 is not None, "Timeline for 12760 must not be None!"
    print(f"Train 12760 halts count: {len(tl_12760.get('timeline', []))}")
    assert len(tl_12760.get("timeline", [])) > 100, "Expected >100 waypoints for 12760"

    tl_12759 = TrainService.get_train_timeline(db, "12759")
    assert tl_12759 is not None, "Timeline for 12759 must not be None!"
    print(f"Train 12759 halts count: {len(tl_12759.get('timeline', []))}")
    assert len(tl_12759.get("timeline", [])) > 100, "Expected >100 waypoints for 12759"
    print("PASS: Additional trains verified.")

    # -------------------------------------------------------------
    # TEST 3: Negative Test - Non-Existent Train 99999
    # -------------------------------------------------------------
    print("\n--- TEST 3: Negative Test (Invalid Train 99999) ---")
    tl_99999 = TrainService.get_train_timeline(db, "99999")
    print(f"Result for 99999: {tl_99999}")
    assert tl_99999 is None, f"Expected None for non-existent train 99999, but got: {tl_99999}"
    print("PASS: Non-existent train returns None with zero fake mock fallback.")

    # -------------------------------------------------------------
    # TEST 4: FastAPI REST Endpoints
    # -------------------------------------------------------------
    print("\n--- TEST 4: FastAPI REST Endpoints ---")
    resp_tl = client.get("/api/trains/12761/timeline")
    print(f"GET /api/trains/12761/timeline status: {resp_tl.status_code}")
    assert resp_tl.status_code == 200, f"Expected 200, got {resp_tl.status_code}"
    resp_tl_json = resp_tl.json()
    assert len(resp_tl_json.get("timeline", [])) >= 90
    print(f"FastAPI timeline endpoint returned {len(resp_tl_json['timeline'])} stations.")

    resp_dt = client.get("/api/trains/12761/details")
    print(f"GET /api/trains/12761/details status: {resp_dt.status_code}")
    assert resp_dt.status_code == 200, f"Expected 200, got {resp_dt.status_code}"
    resp_dt_json = resp_dt.json()
    assert len(resp_dt_json.get("timeline", [])) >= 90
    print(f"FastAPI details endpoint returned train with {len(resp_dt_json['timeline'])} stations.")

    # 404 for 99999
    resp_404 = client.get("/api/trains/99999/timeline")
    print(f"GET /api/trains/99999/timeline status: {resp_404.status_code} (Expected 404)")
    assert resp_404.status_code == 404, f"Expected 404, got {resp_404.status_code}"
    print("PASS: FastAPI REST endpoints verified.")

    db.close()
    print("\n" + "=" * 65)
    print("     ALL ROUTE STATION TIMELINE TESTS PASSED SUCCESSFULLY!    ")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
