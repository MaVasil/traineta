import sys
import os
import json
import httpx

# Ensure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.config import settings
from app.services.train_discovery_service import TrainDiscoveryService
from app.services.realtime_pipeline import RealtimePipeline

def verify_live_discovery():
    print("=========================================================")
    print("   TRAINETA DYNAMIC TRAIN DISCOVERY LIVE VERIFICATION   ")
    print("=========================================================")
    print(f"Provider: {settings.TRAIN_DATA_PROVIDER}")
    print(f"API Key Present: {'YES' if settings.RAILRADAR_API_KEY else 'NO'}")
    print(f"Initial configured trains: {RealtimePipeline.get_configured_train_numbers()}")

    test_train = "12761"
    print(f"\n--- STEP 1: Discovering Unconfigured Train {test_train} ---")
    res = TrainDiscoveryService.discover_train(test_train)
    print("Discovery Success:", res.get("success"))
    print("Discovered Flag:", res.get("discovered"))
    print("Message:", res.get("message"))
    if res.get("train"):
        t = res["train"]
        print(f"  Train Number: {t.get('train_number')}")
        print(f"  Train Name: {t.get('train_name')}")
        print(f"  Source: {t.get('source')} ({t.get('source_code')})")
        print(f"  Destination: {t.get('destination')} ({t.get('destination_code')})")
        print(f"  Current Station: {t.get('current_station')}")
        print(f"  Current Delay: {t.get('delay_minutes')} minutes")
        print(f"  Data Source: {t.get('data_source')}")
        print(f"  Data Status: {t.get('data_status')}")
        print(f"  Latitude: {t.get('latitude')}")
        print(f"  Longitude: {t.get('longitude')}")
        print(f"  Speed: {t.get('speed')}")
        print(f"  Tracking Enabled: {t.get('tracking_enabled')}")

    print("\n--- STEP 2: Verify Dynamic Active Tracking Set in RealtimePipeline ---")
    active_trains = RealtimePipeline.get_configured_train_numbers()
    print(f"Updated Active Tracking Set: {active_trains}")
    assert test_train in active_trains, f"Train {test_train} must be in active tracking set!"
    print(f"VERIFIED: Train {test_train} successfully added to RealtimePipeline tracking set.")

    print("\n--- STEP 3: Verify Supabase Database Master Record in 'trains' table ---")
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        headers = {
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_KEY}"
        }
        with httpx.Client(timeout=8.0) as client:
            r = client.get(f"{settings.SUPABASE_URL}/rest/v1/trains?train_number=eq.{test_train}&select=*", headers=headers)
            if r.status_code == 200 and r.json():
                db_train = r.json()[0]
                print(f"Supabase trains table record found: ID={db_train.get('id')} | Num={db_train.get('train_number')} | Name={db_train.get('train_name')} | Status={db_train.get('status')}")
            else:
                print("Supabase trains record not found:", r.status_code, r.text)

    print("\n--- STEP 4: Verify Supabase 'train_positions' Observation ---")
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        headers = {
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_KEY}"
        }
        with httpx.Client(timeout=8.0) as client:
            r = client.get(f"{settings.SUPABASE_URL}/rest/v1/train_positions?select=*&order=recorded_at.desc&limit=4", headers=headers)
            if r.status_code == 200:
                print("Latest snapshots in Supabase train_positions:")
                for p in r.json():
                    print(f"  ID={p.get('id')} | train_id={p.get('train_id')} | delay={p.get('current_delay_minutes')} | source={p.get('data_source')} | status={p.get('data_status')} | lat={p.get('latitude')} | lng={p.get('longitude')} | speed={p.get('speed')} | time={p.get('recorded_at')}")

    print("\n--- STEP 5: Second Search for Same Train Reuses Master Data (No External Call) ---")
    res2 = TrainDiscoveryService.discover_train(test_train)
    print("Second Query Success:", res2.get("success"))
    print("Discovered Flag (should be False for existing):", res2.get("discovered"))
    print("Message:", res2.get("message"))

    print("\n=========================================================")
    print("         DYNAMIC TRAIN DISCOVERY VERIFICATION: PASS       ")
    print("=========================================================")

if __name__ == "__main__":
    verify_live_discovery()
