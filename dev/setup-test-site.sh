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
# Ensure we have a today.json (copy or link a specific day for testing)
if [ ! -f "$SITE_DIR/data/today.json" ]; then
    # Link the first available day file as today.json
    FIRST_DAY_FILE=$(find "$DATA_SRC_DIR" -name "day-*.json" | head -n 1)
    if [ -n "$FIRST_DAY_FILE" ]; then
        ln -sf "$FIRST_DAY_FILE" "$SITE_DIR/data/today.json"
        echo "Linked $(basename "$FIRST_DAY_FILE") as today.json"
    else
        echo "Warning: No day-*.json files found in $DATA_SRC_DIR"
    fi
fi

echo "Test site ready."
echo "Run: python3 -m http.server 8000 -d dev/test-site"
