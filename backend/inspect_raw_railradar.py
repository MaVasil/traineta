import time
import json
import httpx
from app.config import settings

api_key = settings.RAILRADAR_API_KEY
if not api_key:
    print("NO API KEY CONFIGURED!")
    exit(1)

headers = {
    "Authorization": f"Bearer {api_key}",
    "x-api-key": api_key,
    "Accept": "application/json",
}
base_url = "https://railradar.in/api/v1"

test_trains = ["57411", "12760", "12761", "12759", "12713", "17645"]

print("=== INSPECTING RAW RAILRADAR API RESPONSES ===")

for t_num in test_trains:
    url = f"{base_url}/trains/{t_num}/live"
    try:
        r = httpx.get(url, headers=headers, timeout=15.0)
        print(f"\n--- Train {t_num} (HTTP {r.status_code}) ---")
        if r.status_code == 200:
            res_json = r.json()
            if not res_json.get("success"):
                print(f"API success=False: {res_json.get('message')}")
                continue
            data = res_json.get("data", {})
            
            # Print top-level keys
            print(f"Top-level keys: {list(data.keys())}")
            
            # Print currentLocation details
            curr_loc = data.get("currentLocation") or {}
            print(f"currentLocation keys: {list(curr_loc.keys())}")
            print(f"currentLocation content: {json.dumps(curr_loc, indent=2)}")
            
            # Check for any speed field in data or currentLocation
            speed_fields = {}
            for k, v in curr_loc.items():
                if "speed" in k.lower():
                    speed_fields[f"currentLocation.{k}"] = v
            for k, v in data.items():
                if "speed" in k.lower():
                    speed_fields[f"data.{k}"] = v
            train_obj = data.get("train") or {}
            for k, v in train_obj.items():
                if "speed" in k.lower():
                    speed_fields[f"train.{k}"] = v
            print(f"Detected Speed Fields: {speed_fields}")
            
            # Inspect journey endpoints
            print(f"train object: {json.dumps(train_obj, indent=2)}")
            halts = data.get("halts") or []
            print(f"Total halts: {len(halts)}")
            if halts:
                print(f"First halt (origin): {halts[0].get('stationName')} ({halts[0].get('stationCode')})")
                print(f"Last halt (terminus): {halts[-1].get('stationName')} ({halts[-1].get('stationCode')})")
                
        elif r.status_code == 429:
            print(f"Rate limited (429)! Waiting 5s...")
            time.sleep(5)
        else:
            print(f"Unexpected status: {r.status_code} - {r.text[:200]}")
    except Exception as e:
        print(f"Error inspecting {t_num}: {e}")
    time.sleep(2.0)
