#!/bin/bash
set -e

NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <new_version>"
    exit 1
fi

echo "Updating version to $NEW_VERSION..."

# 1. Update skins/Aero/VERSION
echo "$NEW_VERSION" > skins/Aero/VERSION

# 2. Update skins/Aero/skin.conf
# Look for "version = X.Y.Z"
sed -i "s/version = .*/version = $NEW_VERSION/" skins/Aero/skin.conf

# 3. Update install.py
# Look for version="X.Y.Z"
sed -i "s/version=\".*\"/version=\"$NEW_VERSION\"/" install.py

echo "Version updated to $NEW_VERSION in VERSION, skin.conf, and install.py"
