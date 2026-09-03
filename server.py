#!/usr/bin/env python3
"""
Football Team Builder - Development Server
Serves static frontend files and provides a local CORS-free proxy for the Third Half United League API.
"""

import http.server
import socketserver
import urllib.request
import json
import os
import sys

PORT = 8000
TARGET_API = "https://thirdhalfutdleague.lovable.app/api/public/matches"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Intercept local API requests and proxy to Third Half United API
        if self.path in ("/api/matches", "/api/public/matches"):
            try:
                req = urllib.request.Request(
                    TARGET_API,
                    headers={
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "application/json"
                    }
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = resp.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                    self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
                    self.send_header("Cache-Control", "no-cache")
                    self.end_headers()
                    self.wfile.write(data)
                    return
            except Exception as e:
                print(f"[Proxy Error] Could not fetch live matches from {TARGET_API}: {e}", file=sys.stderr)
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
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"🚀 Football Team Builder running at: http://localhost:{PORT}")
        print(f"🔄 League API Proxy active at: http://localhost:{PORT}/api/matches -> {TARGET_API}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
