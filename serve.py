#!/usr/bin/env python3
"""Serves the Brewly website on localhost.

It works like `python3 -m http.server`, with one difference: every file is sent with
`Cache-Control: no-cache`. Without that header, browsers keep old copies of the JavaScript
and CSS for a while, so an edit does not show after a normal reload.

Usage (from this folder):  python3 serve.py [port]     (default port 3000)
"""
import functools
import os
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

SITE_DIR = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    handler = functools.partial(NoCacheHandler, directory=SITE_DIR)
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving {SITE_DIR} at http://localhost:{port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
