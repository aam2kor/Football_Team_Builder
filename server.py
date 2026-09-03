#!/usr/bin/env python3
"""
Football Team Builder - High-Performance Dev Server with Threading & API Proxies
Serves frontend static assets and provides CORS-free proxies for:
1. Third Half United League API (/api/matches)
2. Local Ollama LLM API (/api/ollama/* -> http://localhost:11434/*)
"""

import http.server
import urllib.request
import json
import os
import sys
import time
import threading

PORT = 8000
LEAGUE_TARGET_API = "https://thirdhalfutdleague.lovable.app/api/public/matches"
OLLAMA_TARGET_BASE = "http://localhost:11434"
CACHE_TTL_SECONDS = 60

# In-memory cache for league matches
_league_cache = {
    "data": None,
    "timestamp": 0,
    "lock": threading.Lock()
}

def fetch_upstream_matches():
    """Fetches latest matches from the live Lovable API with browser headers."""
    req = urllib.request.Request(
        LEAGUE_TARGET_API,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read()
            parsed = json.loads(content.decode("utf-8"))
            if "matches" in parsed and len(parsed["matches"]) > 0:
                with _league_cache["lock"]:
                    _league_cache["data"] = content
                    _league_cache["timestamp"] = time.time()
                return content
    except Exception as e:
        print(f"[Proxy] Upstream league fetch warning: {e}", file=sys.stderr)
    return None

class FastProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        # 1. League API Proxy
        if self.path.startswith("/api/matches") or self.path.startswith("/api/public/matches"):
            now = time.time()
            is_force = "force=true" in self.path or "refresh=true" in self.path
            cached_data = _league_cache["data"]
            cache_age = now - _league_cache["timestamp"]

            if not is_force and cached_data and cache_age < CACHE_TTL_SECONDS:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("X-Cache", "HIT")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(cached_data)
                return

            try:
                data = fetch_upstream_matches()
                if data:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("X-Cache", "MISS")
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(data)
                    return
            except Exception as e:
                print(f"[Proxy] Live fetch error: {e}", file=sys.stderr)
                if cached_data:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("X-Cache", "STALE")
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(cached_data)
                    return

                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        # 2. Ollama Proxy (GET, e.g. /api/ollama/api/tags)
        if self.path.startswith("/api/ollama"):
            subpath = self.path[len("/api/ollama"):]
            if not subpath.startswith("/"): subpath = "/" + subpath
            target_url = f"{OLLAMA_TARGET_BASE}{subpath}"
            return self._proxy_ollama_request(target_url, method="GET")

        # 3. Gemini Proxy (GET)
        if self.path.startswith("/api/gemini"):
            return self._proxy_gemini_request(method="GET")

        return super().do_GET()

    def do_POST(self):
        # 2. Ollama Proxy (POST, e.g. /api/ollama/api/chat)
        if self.path.startswith("/api/ollama"):
            subpath = self.path[len("/api/ollama"):]
            if not subpath.startswith("/"): subpath = "/" + subpath
            target_url = f"{OLLAMA_TARGET_BASE}{subpath}"
            return self._proxy_ollama_request(target_url, method="POST")

        # 3. Gemini Proxy (POST, e.g. /api/gemini/gemini-2.5-flash:generateContent)
        if self.path.startswith("/api/gemini"):
            return self._proxy_gemini_request(method="POST")

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

    def _proxy_ollama_request(self, target_url, method="GET"):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    "Content-Type": self.headers.get("Content-Type", "application/json"),
                    "Accept": "application/json"
                },
                method=method
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                resp_data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(resp_data)
        except urllib.error.HTTPError as he:
            self.send_response(he.code)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(he.read())
        except Exception as e:
            print(f"[Ollama Proxy Error] {e}", file=sys.stderr)
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Failed to connect to Ollama at {OLLAMA_TARGET_BASE}: {e}"}).encode("utf-8"))

    def _proxy_gemini_request(self, method="POST"):
        try:
            subpath = self.path[len("/api/gemini"):]
            if not subpath.startswith("/"): subpath = "/" + subpath
            
            # Extract query param or environment variable for API key
            env_key = os.environ.get("GEMINI_API_KEY", "")
            has_key_param = "key=" in subpath

            if not has_key_param and env_key:
                sep = "&" if "?" in subpath else "?"
                subpath = f"{subpath}{sep}key={env_key}"

            target_url = f"https://generativelanguage.googleapis.com/v1beta/models{subpath}"
            
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    "Content-Type": self.headers.get("Content-Type", "application/json"),
                    "Accept": "application/json"
                },
                method=method
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                resp_data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(resp_data)
        except urllib.error.HTTPError as he:
            self.send_response(he.code)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(he.read())
        except Exception as e:
            print(f"[Gemini Proxy Error] {e}", file=sys.stderr)
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Failed to connect to Google Gemini API: {e}"}).encode("utf-8"))

if __name__ == "__main__":
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)

    # Pre-fetch matches in background immediately on startup
    threading.Thread(target=fetch_upstream_matches, daemon=True).start()

    # Use ThreadingHTTPServer for concurrent non-blocking static + API requests
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), FastProxyHTTPRequestHandler) as httpd:
        print(f"🚀 Football Team Builder running at: http://localhost:{PORT}")
        print(f"⚡ League API Proxy active at: http://localhost:{PORT}/api/matches")
        print(f"🤖 Ollama AI Proxy active at: http://localhost:{PORT}/api/ollama/* -> {OLLAMA_TARGET_BASE}/*")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
