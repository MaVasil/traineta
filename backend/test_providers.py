import sys
import os
import json
from unittest.mock import patch, MagicMock

# Ensure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.services.simulated_provider import SimulatedProvider
from app.services.railradar_provider import RailRadarProvider

@patch('app.services.simulated_provider.SimulationService.advance_train_simulation')
def test_simulated_provider(mock_advance):
    print("--- Testing SimulatedProvider ---")
    mock_advance.return_value = {
        "train_number": "12759",
        "train_name": "CHARMINAR EXP",
        "current_station": "Warangal",
        "source_city": "Chennai",
        "next_station": "Kazipet",
        "current_delay_minutes": 5,
        "scheduled_arrival_at_next": "12:00",
        "scheduled_departure_at_next": "12:05",
        "predicted_arrival_at_next": "12:05",
        "latitude": 17.0,
        "longitude": 79.0,
        "speed": 80,
        "last_updated": "2023-10-10T10:00:00"
    }

    provider = SimulatedProvider()
    
    result = provider.get_live_status("12759")
    if result:
        print("SUCCESS: SimulatedProvider returned normalized data.")
        print("Data source:", result.get("source"))
        print("Data status:", result.get("data_status"))
        print("Sample mapping -> train_name:", result.get("train_name"), "| speed:", result.get("speed_kmph"))
    else:
        print("FAIL: SimulatedProvider failed to return data.")

@patch('app.services.railradar_provider.httpx.Client.get')
def test_railradar_provider_success(mock_get):
    print("\n--- Testing RailRadarProvider (Mock Success) ---")
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "data": {
            "trainNumber": "12759",
            "trainName": "Hyderabad CHARMINAR SF EXP",
            "isLive": True,
            "currentLocation": {
                "stationCode": "WL",
                "stationName": "Warangal",
                "delayMinutes": 12,
                "lat": 17.9689,
                "lng": 79.5941,
                "speed": 85
            },
            "previousHalt": {
                "stationName": "Khammam"
            },
            "nextHalt": {
                "stationName": "Kazipet"
            },
            "delayMinutes": 12,
            "lastUpdatedAt": "2026-09-07T17:33:32+05:30"
        }
    }
    mock_get.return_value = mock_response

    provider = RailRadarProvider()
    provider.api_key = "test_key"
    provider.headers = {"Authorization": "Bearer test_key"}
    
    result = provider.get_live_status("12759")
    
    if result:
        print("SUCCESS: RailRadarProvider correctly mapped external API response.")
        print("Data source:", result.get("source"))
        print("Data status:", result.get("data_status"))
        print("Delay extracted:", result.get("current_delay_minutes"))
        print("Speed extracted:", result.get("speed_kmph"))
    else:
        print("FAIL: RailRadarProvider failed to map response.")

@patch('app.services.railradar_provider.httpx.Client.get')
def test_railradar_provider_unauthorized(mock_get):
    print("\n--- Testing RailRadarProvider (Mock 401) ---")
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_get.return_value = mock_response

    provider = RailRadarProvider()
    provider.api_key = "invalid_key"
    
    result = provider.get_live_status("12759")
    if result is None:
        print("SUCCESS: RailRadarProvider properly handled 401 Unauthorized.")
    else:
        print("FAIL: RailRadarProvider did not handle 401 properly.")

if __name__ == "__main__":
    try:
        test_simulated_provider()
        test_railradar_provider_success()
        test_railradar_provider_unauthorized()
    except Exception as e:
        print(f"Test Execution Failed: {e}")

