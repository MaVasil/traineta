import sys
import os
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

# Ensure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.config import settings
from app.services.train_discovery_service import TrainDiscoveryService
from app.services.realtime_pipeline import RealtimePipeline
from app.services.provider_factory import get_provider
from app.services.simulated_provider import SimulatedProvider
from app.services.railradar_provider import RailRadarProvider

class TestTrainDiscovery(unittest.TestCase):
    """
    Unit test suite for Dynamic Train Discovery and Tracking Extension.
    """

    def setUp(self):
        # Clear cache before each test
        TrainDiscoveryService._discovery_cache.clear()

    def test_01_discover_existing_train_reuses_master_record(self):
        """Test that searching an already existing train in DB does not call external API."""
        mock_db = MagicMock()
        mock_train_details = {
            "id": "12759",
            "db_id": "uuid-12759",
            "train_number": "12759",
            "train_name": "Charminar SF Express",
            "status": "ON_TIME",
            "delay_minutes": 10
        }

        with patch.object(TrainDiscoveryService, "_find_in_database", return_value=mock_train_details):
            with patch('app.services.provider_factory.get_provider') as mock_get_prov:
                res = TrainDiscoveryService.discover_train("12759", db=mock_db)
                self.assertTrue(res["success"])
                self.assertFalse(res["discovered"], "Existing train should not trigger new discovery")
                self.assertEqual(res["train"]["train_number"], "12759")
                # Provider get_live_status should NOT have been called
                mock_get_prov.assert_not_called()
                # Should be registered in dynamic tracking set
                self.assertIn("12759", RealtimePipeline.get_configured_train_numbers())

    def test_02_discover_new_valid_train(self):
        """Test discovery of a new valid train creates master record and registers tracking."""
        mock_provider = MagicMock(spec=RailRadarProvider)
        mock_provider.get_live_status.return_value = {
            "train_number": "12761",
            "train_name": "Karimnagar SF Express",
            "current_station": "Tirupati",
            "current_station_code": "TPTY",
            "previous_station": "Tirupati",
            "previous_station_code": "TPTY",
            "next_station": "Karimnagar",
            "next_station_code": "KRMR",
            "current_delay_minutes": 0,
            "latitude": None,
            "longitude": None,
            "speed_kmph": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "RAILRADAR",
            "data_status": "LIVE"
        }

        with patch.object(TrainDiscoveryService, "_find_in_database", return_value=None):
            with patch('app.services.train_discovery_service.get_provider', return_value=mock_provider):
                with patch.object(TrainDiscoveryService, "_create_train_master_record", return_value="uuid-12761"):
                    with patch.object(RealtimePipeline, "persist_snapshot", return_value="snap-12761"):
                        res = TrainDiscoveryService.discover_train("12761")
                        self.assertTrue(res["success"])
                        self.assertTrue(res["discovered"])
                        self.assertEqual(res["train"]["train_number"], "12761")
                        self.assertEqual(res["train"]["train_name"], "Karimnagar SF Express")
                        self.assertIsNone(res["train"]["latitude"])
                        self.assertIsNone(res["train"]["speed"])
                        self.assertEqual(res["train"]["delay_minutes"], 0)
                        # Train should now be in active tracking set
                        self.assertIn("12761", RealtimePipeline.get_configured_train_numbers())

    def test_03_discover_invalid_or_nonexistent_train(self):
        """Test that invalid/non-existent train returns clean error without crashing."""
        mock_provider = MagicMock(spec=RailRadarProvider)
        mock_provider.get_live_status.return_value = None  # 404 from RailRadar

        with patch.object(TrainDiscoveryService, "_find_in_database", return_value=None):
            with patch('app.services.train_discovery_service.get_provider', return_value=mock_provider):
                res = TrainDiscoveryService.discover_train("99999")
                self.assertFalse(res["success"])
                self.assertIsNone(res["train"])
                self.assertIn("not found", res["error"].lower())

    def test_04_invalid_train_format(self):
        """Test validation rejects malformed train input."""
        res = TrainDiscoveryService.discover_train("!@#$%")
        self.assertFalse(res["success"])
        self.assertIn("Invalid train number", res["error"])

    def test_05_dynamic_tracking_set_integration(self):
        """Test that RealtimePipeline includes dynamically registered trains in polling cycles."""
        RealtimePipeline.register_dynamic_train("12761")
        active = RealtimePipeline.get_configured_train_numbers()
        self.assertIn("12761", active)

    def test_06_simulated_mode_preservation(self):
        """Test that SIMULATED provider toggle continues to return SimulatedProvider."""
        with patch.object(settings, "TRAIN_DATA_PROVIDER", "SIMULATED"):
            provider = get_provider()
            self.assertIsInstance(provider, SimulatedProvider)

if __name__ == "__main__":
    unittest.main()
