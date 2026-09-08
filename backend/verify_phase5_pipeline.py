import sys
import os
import time
import httpx

# Ensure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.config import settings
from app.services.realtime_pipeline import RealtimePipeline

def verify_live_pipeline():
    print("==================================================")
    print("   TRAINETA PHASE 5 — REAL OPERATIONAL PIPELINE   ")
    print("==================================================")
    print(f"Provider Configured: {settings.TRAIN_DATA_PROVIDER}")
    print(f"API Key Present: {'YES' if settings.RAILRADAR_API_KEY else 'NO'}")
    print(f"Poll Interval Configured: {settings.RAILRADAR_POLL_INTERVAL_SECONDS}s")
    print(f"Stale Threshold: {settings.TRAIN_DATA_STALE_THRESHOLD_SECONDS}s")
    print(f"Active Pipeline Trains: {settings.PIPELINE_ACTIVE_TRAINS}")

    print("\n--- STEP 1: Single Controlled Poll for Train 12759 ---")
    res = RealtimePipeline.poll_train("12759")
    print(f"Train: {res.get('train_number')}")
    print(f"Status: {res.get('status')}")
    print(f"Source: {res.get('source')}")
    print(f"Delay: {res.get('delay_minutes')} minutes")
    print(f"Current Station: {res.get('current_station')}")
    print(f"Next Station: {res.get('next_station')}")
    print(f"Latitude: {res.get('latitude')}")
    print(f"Longitude: {res.get('longitude')}")
    print(f"Speed: {res.get('speed_kmph')}")
    print(f"Persisted to Supabase: {res.get('persisted')}")
    print(f"Snapshot ID: {res.get('snapshot_id')}")
    print(f"Duration: {res.get('duration_ms')} ms")

    print("\n--- STEP 2: Query Supabase train_positions to Verify Database Persistence ---")
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        headers = {
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_KEY}"
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.get(
                    f"{settings.SUPABASE_URL}/rest/v1/train_positions?select=*&order=recorded_at.desc&limit=3",
                    headers=headers
                )
            if r.status_code == 200:
                rows = r.json()
                print(f"Recent Supabase train_positions records: {len(rows)}")
                for i, row in enumerate(rows):
                    print(f" Record #{i+1}: ID={row.get('id')} | train_id={row.get('train_id')} | delay={row.get('current_delay_minutes')} | lat={row.get('latitude')} | lng={row.get('longitude')} | speed={row.get('speed')} | source={row.get('data_source')} | status={row.get('data_status')} | recorded_at={row.get('recorded_at')}")
            else:
                print(f"Supabase query failed: HTTP {r.status_code} - {r.text}")
        except Exception as e:
            print(f"Supabase query error: {e}")

    print("\n--- STEP 3: Multiple Snapshot Test (Cycle 2 with slight pause) ---")
    time.sleep(2)
    cycle_res = RealtimePipeline.run_pipeline_cycle()
    print(f"Cycle Number: {cycle_res.get('cycle_number')}")
    print(f"Trains Processed: {cycle_res.get('trains_processed')}")
    print(f"Success Count: {cycle_res.get('success_count')}")
    print(f"Persisted Count: {cycle_res.get('persisted_count')}")
    print(f"Error Count: {cycle_res.get('error_count')}")
    print(f"Cycle Duration: {cycle_res.get('duration_seconds')}s")
    for r in cycle_res.get("results", []):
        print(f"  -> Train {r.get('train_number')}: Status={r.get('status')}, Persisted={r.get('persisted')}, Delay={r.get('delay_minutes')}min, Deduplicated={r.get('deduplicated', False)}")

    print("\n--- STEP 4: Pipeline Status Endpoint Check ---")
    status = RealtimePipeline.get_status()
    print(f"Pipeline Status: Enabled={status.get('pipeline_enabled')}, Cycles={status.get('total_cycles_executed')}, Total Snapshots={status.get('total_snapshots_persisted')}")

if __name__ == "__main__":
    verify_live_pipeline()
