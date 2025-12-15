import http.server
import socketserver
import os
import mimetypes

# Configuration
PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Skin is in ../skins/Aero relative to dev/debug_server.py
SKIN_DIR = os.path.join(BASE_DIR, '..', 'skins', 'Aero')
# Test data is in ./test-data relative to dev/debug_server.py
DATA_DIR = os.path.join(BASE_DIR, 'test-data')

print(f"Serving at http://localhost:{PORT}")
print(f"Skin Dir: {SKIN_DIR}")
print(f"Data Dir: {DATA_DIR}")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Default logic for file mapping
        path = self.path.lstrip('/')
        if not path:
            path = "index.html"
            
        target_path = None
        
        # 1. Data Files
        if path.startswith("data/") or path.endswith(".json"):
            filename = path
            if filename.startswith("data/"):
                filename = filename[5:] # Remove 'data/' prefix
            
            # Aliases
            if filename == 'today.json':
                target_path = os.path.join(DATA_DIR, 'day-2025-12-14.json')
            elif filename == 'week.json':
                target_path = os.path.join(DATA_DIR, 'week-to-date.json')
            elif filename == 'month.json':
                target_path = os.path.join(DATA_DIR, 'month-to-date.json')
            elif filename == 'year.json':
                target_path = os.path.join(DATA_DIR, 'year-2025.json')
            else:
                # Direct file
                target_path = os.path.join(DATA_DIR, filename)

        # 2. Skin Assets (if not resolved to a data file that exists)
        if not target_path or not os.path.exists(target_path):
             # Try static skin file
             target_path = os.path.join(SKIN_DIR, path)

        # 3. Serve Logic
        if os.path.exists(target_path) and os.path.isfile(target_path):
            self.serve_file(target_path)
        else:
            self.send_error(404, f"File not found: {path}")

    def serve_file(self, full_path):
        try:
            with open(full_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            
            # Content Type
            ctype, _ = mimetypes.guess_type(full_path)
            if ctype:
                self.send_header("Content-type", ctype)
            
            # CORS (Important for local dev)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error serving file: {e}")

# Allow reuse of address
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
