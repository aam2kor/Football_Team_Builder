#!/usr/bin/env python3
"""
Football Team Builder - High-Performance Dev Server with Threading & In-Memory API Cache
Serves frontend static assets and provides a sub-millisecond cached CORS proxy for Third Half United League API.
"""

import http.server
import urllib.request
import json
import os
import sys
import time
import threading

PORT = 8000
TARGET_API = "https://thirdhalfutdleague.lovable.app/api/public/matches"
CACHE_TTL_SECONDS = 60  # Cache live API responses for 60 seconds

# In-memory fast cache
_api_cache = {
    "data": None,
    "timestamp": 0,
    "lock": threading.Lock()
}

def fetch_upstream_matches():
    """Fetches latest matches from the live Lovable API with browser headers."""
    req = urllib.request.Request(
        TARGET_API,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        content = resp.read()
        parsed = json.loads(content.decode("utf-8"))
        if "matches" in parsed and len(parsed["matches"]) > 0:
            with _api_cache["lock"]:
                _api_cache["data"] = content
                _api_cache["timestamp"] = time.time()
            return content
    return None

class FastProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Handle proxy endpoints
        if self.path.startswith("/api/matches") or self.path.startswith("/api/public/matches"):
            now = time.time()
            is_force = "force=true" in self.path or "refresh=true" in self.path
            cached_data = _api_cache["data"]
            cache_age = now - _api_cache["timestamp"]

            # 1. Return immediately from in-memory cache if valid
            if not is_force and cached_data and cache_age < CACHE_TTL_SECONDS:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("X-Cache", "HIT")
                self.end_headers()
                self.wfile.write(cached_data)
                return

            # 2. Fetch fresh upstream if stale or forced
            try:
                data = fetch_upstream_matches()
                if data:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("X-Cache", "MISS")
                    self.end_headers()
                    self.wfile.write(data)
                    return
            except Exception as e:
                print(f"[Proxy] Live fetch error: {e}", file=sys.stderr)
                # If upstream failed but we have stale cache, serve stale cache instantly
                if cached_data:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("X-Cache", "STALE")
                    self.end_headers()
                    self.wfile.write(cached_data)
                    return

                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        return super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()

if __name__ == "__main__":
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    
    # Pre-fetch matches in background immediately on startup
    threading.Thread(target=fetch_upstream_matches, daemon=True).start()

    # Use ThreadingHTTPServer for concurrent non-blocking static + API requests
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), FastProxyHTTPRequestHandler) as httpd:
        print(f"🚀 Football Team Builder running at: http://localhost:{PORT}")
        print(f"⚡ Instant League API Proxy active at: http://localhost:{PORT}/api/matches")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
