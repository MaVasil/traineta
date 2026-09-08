import sys
import os
import httpx

# Ensure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.config import settings
from app.services.railradar_provider import RailRadarProvider
from app.services.simulated_provider import SimulatedProvider

def get_provider(provider_type=None):
    provider_type = provider_type or settings.TRAIN_DATA_PROVIDER
    if provider_type == "RAILRADAR":
        return RailRadarProvider()
    else:
        return SimulatedProvider()

def verify_factory():
    print("--- Provider Factory Verification ---")
    provider_real = get_provider("RAILRADAR")
    print(f"When TRAIN_DATA_PROVIDER=RAILRADAR: Selected {provider_real.__class__.__name__}")
    
    provider_sim = get_provider("SIMULATED")
    print(f"When TRAIN_DATA_PROVIDER=SIMULATED: Selected {provider_sim.__class__.__name__}")

def verify_real_api():
    print("\n--- Real API Verification ---")
    
    provider = RailRadarProvider()
    
    has_key = "YES" if provider.api_key else "NO"
    print(f"API key configured: {has_key}")
    
    train_number = "12759"
    endpoint = f"{provider.BASE_URL}/trains/{train_number}/live"
    print(f"Endpoint actually used: {endpoint}")
    
    if not provider.api_key:
        print("Authentication: FAILED (No key)")
        return
        
    try:
        # Make a direct real request first to check raw status
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(endpoint, headers=provider.headers)
            
        print(f"HTTP status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("Authentication: FAILED (401 Unauthorized)")
        elif resp.status_code == 200:
            print("Authentication: SUCCESS")
        else:
            print(f"Authentication: UNKNOWN (HTTP {resp.status_code})")
            
        print(f"Train number tested: {train_number}")
        
        # Now use the provider wrapper
        result = provider.get_live_status(train_number)
        
        print(f"Response received: {'YES' if result else 'NO'}")
        
        if result:
            print(f"Source: {result.get('source')}")
            print(f"Live status: {result.get('data_status')}")
            print(f"Current location: {result.get('current_station')}")
            print(f"Next station: {result.get('next_station')}")
            print(f"Current delay: {result.get('current_delay_minutes')} mins")
            print(f"Speed: {result.get('speed_kmph')} km/h")
            print(f"Latitude: {result.get('latitude')}")
            print(f"Longitude: {result.get('longitude')}")
            print(f"Last updated: {result.get('timestamp')}")
            
    except httpx.RequestError as e:
        print("Network/HTTP Request Error:", e)
    except Exception as e:
        print("Unknown Error:", e)

if __name__ == "__main__":
    verify_factory()
    verify_real_api()
