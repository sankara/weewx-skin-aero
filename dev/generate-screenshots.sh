#!/bin/bash
set -e

# Directory definitions
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Setup test site
"$SCRIPT_DIR/setup-test-site.sh"

# Start server
echo "Starting server..."
python3 -m http.server 8000 -d "$REPO_ROOT/dev/test-site" > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server
sleep 3

# Run capture
echo "Capturing screenshots..."
python3 "$SCRIPT_DIR/capture_screenshots.py"

# Kill server
kill $SERVER_PID || true
echo "Done."
