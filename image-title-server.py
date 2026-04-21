#!/usr/bin/env python3
"""
Title server — serves ~/.image-watch-title as plain text on port 9876.
Used by the bookmarklet to read the current post title without file system access.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PORT       = 9876
TITLE_FILE = Path.home() / ".image-watch-title"


class TitleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        title = TITLE_FILE.read_text().strip() if TITLE_FILE.exists() else ''
        body  = title.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # silent


HTTPServer(('127.0.0.1', PORT), TitleHandler).serve_forever()
