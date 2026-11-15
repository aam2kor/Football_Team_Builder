import http.client
import http.server
import json
import os
import tempfile
import threading
import unittest
from unittest.mock import patch

import server


class TestSyncApiProxy(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.orig_cache_file = server.MATCHES_CACHE_FILE
        self.orig_legacy_file = server.LEGACY_MATCHES_DUMP_FILE
        server.MATCHES_CACHE_FILE = os.path.join(self.tmpdir.name, "league_matches_cache.json")
        server.LEGACY_MATCHES_DUMP_FILE = os.path.join(self.tmpdir.name, "league_matches_dump.json")
        with server._league_cache["lock"]:
            server._league_cache["data"] = None
            server._league_cache["timestamp"] = 0

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), server.FastProxyHTTPRequestHandler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        server.MATCHES_CACHE_FILE = self.orig_cache_file
        server.LEGACY_MATCHES_DUMP_FILE = self.orig_legacy_file
        self.tmpdir.cleanup()

    def _get(self, path):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request("GET", path)
            resp = conn.getresponse()
            headers = {k: v for k, v in resp.getheaders()}
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, headers, body
        finally:
            conn.close()

    def test_upstream_failure_without_cache_returns_502_not_404(self):
        with patch("server.urllib.request.urlopen", side_effect=OSError("DNS failure")):
            status, headers, body = self._get("/api/matches?force=true&t=123")
        self.assertEqual(status, 502)
        self.assertIn("error", body)
        self.assertIn("no-store", headers.get("Cache-Control", ""))

    def test_upstream_success_persists_disk_cache_and_serves_stale_on_later_failure(self):
        sample_payload = {
            "matches": [
                {"match_date": "2026-11-01", "season": 2026, "voyagers_goals": 5, "boots_goals": 4}
            ]
        }

        class FakeResp:
            def __init__(self, data):
                self._data = data

            def read(self):
                return self._data

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        raw_bytes = json.dumps(sample_payload).encode("utf-8")
        with patch("server.urllib.request.urlopen", return_value=FakeResp(raw_bytes)):
            status, headers, body = self._get("/api/matches?force=true&t=1")
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("X-Cache"), "MISS")
        self.assertEqual(len(body["matches"]), 1)
        self.assertTrue(os.path.exists(server.MATCHES_CACHE_FILE))

        # Clear in-memory cache to verify disk cache fallback on subsequent upstream error
        with server._league_cache["lock"]:
            server._league_cache["data"] = None
            server._league_cache["timestamp"] = 0

        with patch("server.urllib.request.urlopen", side_effect=TimeoutError("Upstream timed out")):
            status2, headers2, body2 = self._get("/api/matches?force=true&t=2")
        self.assertEqual(status2, 200)
        self.assertEqual(headers2.get("X-Cache"), "STALE")
        self.assertEqual(body2["matches"][0]["match_date"], "2026-11-01")


if __name__ == "__main__":
    unittest.main()
