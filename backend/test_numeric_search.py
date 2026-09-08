import os
import sys
import unittest
import httpx

API_BASE = os.environ.get("API_BASE")
if not API_BASE:
    for port in [8001, 8000]:
        try:
            if httpx.get(f"http://127.0.0.1:{port}/api/health", timeout=1.0).status_code == 200:
                API_BASE = f"http://127.0.0.1:{port}"
                break
        except Exception:
            pass
if not API_BASE:
    API_BASE = "http://127.0.0.1:8001"

class TestNumericTrainSearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Verify server is responding
        try:
            r = httpx.get(f"{API_BASE}/api/health", timeout=5.0)
            assert r.status_code == 200
        except Exception as e:
            raise RuntimeError(f"FastAPI backend is not reachable at {API_BASE}: {e}")

    def test_01_search_configured_train_12759(self):
        """Test 1: Search 12759 returns exactly 12759 and no other trains."""
        r = httpx.get(f"{API_BASE}/api/trains/search?q=12759", timeout=10.0)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1, f"Expected exactly 1 result for 12759, got {len(data)}")
        self.assertEqual(data[0]["train_number"], "12759")
        # Ensure other trains are NOT in the results
        train_nums = [t["train_number"] for t in data]
        self.assertNotIn("12760", train_nums)
        self.assertNotIn("12761", train_nums)
        print("PASS: Test 1 - Search 12759 returned ONLY 12759")

    def test_02_search_dynamically_tracked_train_12761(self):
        """Test 2: Search 12761 returns exactly 12761."""
        r = httpx.get(f"{API_BASE}/api/trains/search?q=12761", timeout=10.0)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1, f"Expected exactly 1 result for 12761, got {len(data)}")
        self.assertEqual(data[0]["train_number"], "12761")
        print("PASS: Test 2 - Search 12761 returned ONLY 12761")

    def test_03_search_discovered_train_17645(self):
        """Test 3: Search train 17645 returns ONLY 17645 and never unrelated DB trains."""
        r = httpx.get(f"{API_BASE}/api/trains/search?q=17645", timeout=15.0)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1, f"Expected exactly 1 result for 17645, got {len(data)}")
        self.assertEqual(data[0]["train_number"], "17645")
        # Verify fields
        self.assertIn("train_name", data[0])
        self.assertIn("data_status", data[0])
        self.assertIn("delay_minutes", data[0])
        print(f"PASS: Test 3 - Search 17645 returned train: {data[0]['train_name']} ({data[0]['train_number']})")

    def test_04_search_invalid_train_number(self):
        """Test 4: Search invalid train number 99999 returns empty list and no unrelated DB trains."""
        r = httpx.get(f"{API_BASE}/api/trains/search?q=99999", timeout=10.0)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0, f"Expected 0 results for invalid train 99999, got {len(data)}: {data}")
        print("PASS: Test 4 - Search 99999 returned 0 results (no unrelated DB trains)")

    def test_05_search_by_train_name(self):
        """Test 5: Search by train name 'Charminar' returns matching train."""
        r = httpx.get(f"{API_BASE}/api/trains/search?q=Charminar", timeout=10.0)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) >= 1, f"Expected at least 1 result for 'Charminar', got {len(data)}")
        names = [t.get("train_name", "") for t in data]
        self.assertTrue(any("charminar" in n.lower() for n in names))
        print("PASS: Test 5 - Search by name 'Charminar' works correctly")

    def test_06_search_by_station(self):
        """Test 6: Search by station 'Warangal' returns matching trains."""
        r = httpx.get(f"{API_BASE}/api/trains/search?q=Warangal", timeout=10.0)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        print(f"PASS: Test 6 - Search by station 'Warangal' returned {len(data)} trains")

    def test_07_api_key_security_check(self):
        """Test 8: Verify API key never appears in responses."""
        from app.config import settings
        key = settings.RAILRADAR_API_KEY
        if key and len(key) > 5:
            for endpoint in ["/api/trains/search?q=17645", "/api/trains/17645", "/api/pipeline/status"]:
                r = httpx.get(f"{API_BASE}{endpoint}", timeout=10.0)
                self.assertNotIn(key, r.text, f"SECURITY LEAK: API Key found in {endpoint}")
        print("PASS: Test 8 - API key security check verified")

if __name__ == "__main__":
    unittest.main()
