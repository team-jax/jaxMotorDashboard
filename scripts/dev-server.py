"""Serve the editable dashboard without caching old JavaScript modules."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=5173)
args = parser.parse_args()

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

root = Path(__file__).resolve().parents[1] / 'dist'
server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root)))
print(f'JAX Control Panel: http://localhost:{args.port} (cache disabled)', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
