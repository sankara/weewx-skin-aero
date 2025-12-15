#!/bin/bash
set -e

# Validate arguments
if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION=$1
ZIP_NAME="weewx-aero-${VERSION}.zip"
STAGING_DIR="aero"

# clean up any previous build artifacts
rm -rf "$STAGING_DIR" "$ZIP_NAME"

echo "Packaging $ZIP_NAME..."

# Create staging directory
mkdir -p "$STAGING_DIR"

# Copy essential files
cp install.py README.md LICENSE "$STAGING_DIR/"

# Copy skins directory
cp -r skins "$STAGING_DIR/"

# Zip the folder
# -r: recursive
# -q: quiet
zip -r -q "$ZIP_NAME" "$STAGING_DIR"

# Clean up staging directory
rm -rf "$STAGING_DIR"

echo "Successfully created $ZIP_NAME"
