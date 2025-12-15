#!/bin/bash
set -e

# Directory definitions
REPO_ROOT="$(git rev-parse --show-toplevel)"
SITE_DIR="$REPO_ROOT/dev/test-site"
SRC_DIR="$REPO_ROOT/skins/Aero"
DATA_SRC_DIR="$REPO_ROOT/dev/test-data"

echo "Setting up test site in $SITE_DIR..."

# Clean previous build
rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR/data"

# Symlink Source Files (HTML, JS, CSS)
# We link individual files to avoid nesting issues or just link the content
# Since index.html expects .js/.css in the same dir, we link them directly into SITE_DIR
for file in "$SRC_DIR"/*; do
    filename=$(basename "$file")
    # Skip templates or unrelated files if needed, but linking all is fine for dev
    ln -sf "$file" "$SITE_DIR/$filename"
done

# Symlink Data Files
# app.js expects data in 'data/' (based on state.js basePath)
for file in "$DATA_SRC_DIR"/*.json; do
    filename=$(basename "$file")
    ln -sf "$file" "$SITE_DIR/data/$filename"
done

# Ensure we have a today.json (copy or link a specific day for testing)
# Using Aug 1, 2023 as 'today' for the test context if not present
if [ ! -f "$SITE_DIR/data/today.json" ]; then
    # Link a sample day as today.json
    # Check if day-2023-08-01.json exists in source
    if [ -f "$DATA_SRC_DIR/day-2023-08-01.json" ]; then
        ln -sf "$DATA_SRC_DIR/day-2023-08-01.json" "$SITE_DIR/data/today.json"
    fi
fi

echo "Test site ready."
echo "Run: python3 -m http.server 8000 -d dev/test-site"
