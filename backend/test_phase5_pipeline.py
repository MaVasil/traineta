import sys
import os
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

# Ensure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.config import settings
from app.services.provider_factory import get_provider
from app.services.simulated_provider import SimulatedProvider
from app.services.railradar_provider import RailRadarProvider
from app.services.realtime_pipeline import RealtimePipeline

class TestPhase5Pipeline(unittest.TestCase):
    """
    Comprehensive test suite for Phase 5 Real-Time Operational Data Pipeline.
    """

    def test_01_provider_factory(self):
        """Test provider factory toggle between SIMULATED and RAILRADAR."""
        with patch.object(settings, "TRAIN_DATA_PROVIDER", "SIMULATED"):
            provider = get_provider()
            self.assertIsInstance(provider, SimulatedProvider)

        with patch.object(settings, "TRAIN_DATA_PROVIDER", "RAILRADAR"):
            provider = get_provider()
            self.assertIsInstance(provider, RailRadarProvider)

    def test_02_railradar_normalization_signed_delay_and_nulls(self):
        """Test that RailRadar normalizer preserves signed delays and leaves missing GPS/speed as None."""
        provider = RailRadarProvider()
        
        # Test Case A: Train ahead of schedule (negative delay) with missing GPS and speed
        raw_ahead = {
            "trainNumber": "12759",
            "trainName": "CHARMINAR EXP",
            "isLive": True,
            "delayMinutes": -25,
            "lastUpdatedAt": datetime.now(timezone.utc).isoformat(),
            "currentLocation": {
                "stationCode": "WL",
                "stationName": "Warangal"
            },
            "previousHalt": {
                "stationCode": "KMT",
                "stationName": "Khammam"
            },
            "nextHalt": {
                "stationCode": "KZJ",
                "stationName": "Kazipet"
            }
        }
        
        norm_ahead = provider._normalize("12759", raw_ahead)
        self.assertEqual(norm_ahead["train_number"], "12759")
        self.assertEqual(norm_ahead["current_delay_minutes"], -25, "Signed negative delay must be preserved")
        self.assertIsNone(norm_ahead["latitude"], "Missing latitude must remain None, not 0")
        self.assertIsNone(norm_ahead["longitude"], "Missing longitude must remain None, not 0")
        self.assertIsNone(norm_ahead["speed_kmph"], "Missing speed must remain None, not 0")
        self.assertEqual(norm_ahead["source"], "RAILRADAR")
        self.assertEqual(norm_ahead["data_status"], "LIVE")
        self.assertEqual(norm_ahead["current_station_code"], "WL")
        self.assertEqual(norm_ahead["next_station_code"], "KZJ")

        # Test Case B: Positive delay with GPS provided
        raw_delayed = {
            "trainNumber": "12760",
            "trainName": "Coastal SF",
            "isLive": True,
            "delayMinutes": 45,
            "lastUpdatedAt": datetime.now(timezone.utc).isoformat(),
            "currentLocation": {
                "stationCode": "BZA",
                "stationName": "Vijayawada",
                "lat": 16.5186,
                "lng": 80.6195,
                "speed": 82
            }
        }
        norm_delayed = provider._normalize("12760", raw_delayed)
        self.assertEqual(norm_delayed["current_delay_minutes"], 45)
        self.assertEqual(norm_delayed["latitude"], 16.5186)
        self.assertEqual(norm_delayed["longitude"], 80.6195)
        self.assertEqual(norm_delayed["speed_kmph"], 82)

    def test_03_staleness_calculation(self):
        """Test data status calculation (LIVE vs STALE based on timestamp)."""
        provider = RailRadarProvider()
        
        # 1. Fresh timestamp (< threshold)
        fresh_time = datetime.now(timezone.utc).isoformat()
        self.assertFalse(provider._is_stale(fresh_time))

        # 2. Stale timestamp (older than threshold, e.g. 2 hours old)
        stale_time = (datetime.now(timezone.utc) - timedelta(seconds=7200)).isoformat()
        self.assertTrue(provider._is_stale(stale_time))

        # 3. Verify in normalization
        raw_stale = {
            "trainNumber": "12759",
            "isLive": True,
            "delayMinutes": 10,
            "lastUpdatedAt": stale_time,
            "currentLocation": {"stationCode": "WL"}
        }
        norm = provider._normalize("12759", raw_stale)
        self.assertEqual(norm["data_status"], "STALE", "Data older than stale threshold must be marked STALE")

    @patch('app.services.railradar_provider.httpx.Client.get')
    def test_04_http_error_handling(self, mock_get):
        """Test provider error handling across 401, 404, 429, 503, and timeouts."""
        provider = RailRadarProvider()
        provider.api_key = "test_key"
        provider.headers = {"Authorization": "Bearer test_key"}

        # 401 Unauthorized
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_get.return_value = mock_resp
        self.assertIsNone(provider.get_live_status("12759"), "401 must return None without raising uncaught exception")

        # 404 Not Found
        mock_resp.status_code = 404
        self.assertIsNone(provider.get_live_status("99999"), "404 must return None without raising exception")

        # 429 Rate Limit
        mock_resp.status_code = 429
        self.assertIsNone(provider.get_live_status("12759"), "429 must return None safely")

        # 503 Service Unavailable
        mock_resp.status_code = 503
        self.assertIsNone(provider.get_live_status("12759"), "503 must return None safely")

        # Timeout Exception
        import httpx
        mock_get.side_effect = httpx.TimeoutException("Connection timed out")
        self.assertIsNone(provider.get_live_status("12759"), "Timeout must return None safely")
        mock_get.side_effect = None

    def test_05_station_resolution(self):
        """Test station resolution against known database stations and graceful NULL fallback for unknown."""
        mock_db = MagicMock()
        
        # Mock station found
        mock_station = MagicMock()
        mock_station.id = "station-uuid-123"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_station

        resolved_id = RealtimePipeline.resolve_station(mock_db, "WL")
        self.assertEqual(resolved_id, "station-uuid-123")

        # Mock station not found
        mock_db.query.return_value.filter.return_value.first.return_value = None
        with patch.object(RealtimePipeline, "_fetch_train_numbers_from_supabase_rest", return_value=[]):
            with patch('app.services.realtime_pipeline.httpx.Client.get') as mock_rest_get:
                mock_rest_get.return_value.status_code = 404
                resolved_none = RealtimePipeline.resolve_station(mock_db, "UNKNOWN_STATION")
                self.assertIsNone(resolved_none, "Unknown station must resolve to None without failing")

    def test_06_pipeline_error_isolation(self):
        """Test that failure on one train does not crash the pipeline cycle for subsequent trains."""
        mock_provider = MagicMock()
        
        # Train 1 fails with 404/None, Train 2 succeeds
        def mock_get_status(train_num):
            if train_num == "17001":
                return None  # 404
            return {
                "train_number": train_num,
                "train_name": "Test Express",
                "current_station": "Warangal",
                "current_station_code": "WL",
                "next_station": "Vijayawada",
                "next_station_code": "BZA",
                "current_delay_minutes": 15,
                "latitude": None,
                "longitude": None,
                "speed_kmph": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "RAILRADAR",
                "data_status": "LIVE"
            }
        
        mock_provider.get_live_status.side_effect = mock_get_status

        with patch.object(RealtimePipeline, "resolve_train_id", return_value="train-uuid-abc"):
            with patch.object(RealtimePipeline, "persist_snapshot", return_value="snap-123"):
                with patch.object(RealtimePipeline, "should_deduplicate", return_value=False):
                    res1 = RealtimePipeline.poll_train("17001", provider=mock_provider)
                    self.assertEqual(res1["status"], "UNAVAILABLE")
                    self.assertFalse(res1["persisted"])

                    res2 = RealtimePipeline.poll_train("12759", provider=mock_provider)
                    self.assertEqual(res2["status"], "LIVE")
                    self.assertTrue(res2["persisted"])
                    self.assertEqual(res2["delay_minutes"], 15)

    def test_07_deduplication(self):
        """Test deduplication logic prevents redundant duplicate insertions."""
        mock_db = MagicMock()
        mock_pos = MagicMock()
        mock_pos.current_station_id = "st-1"
        mock_pos.current_delay_minutes = 20
        mock_pos.data_status = "LIVE"
        mock_pos.recorded_at = datetime.utcnow() - timedelta(seconds=10) # 10s ago

        mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = mock_pos

        is_dup = RealtimePipeline.should_deduplicate(
            db=mock_db,
            train_id="tr-1",
            current_station_id="st-1",
            current_delay_minutes=20,
            data_status="LIVE",
            min_interval_seconds=60
        )
        self.assertTrue(is_dup, "Identical snapshot within threshold must be detected as duplicate")

        # Different delay -> not a duplicate
        is_not_dup = RealtimePipeline.should_deduplicate(
            db=mock_db,
            train_id="tr-1",
            current_station_id="st-1",
            current_delay_minutes=25,
            data_status="LIVE",
            min_interval_seconds=60
        )
        self.assertFalse(is_not_dup, "Different delay must not be deduplicated")

if __name__ == "__main__":
    unittest.main()
