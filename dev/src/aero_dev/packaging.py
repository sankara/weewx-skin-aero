import argparse
import os
import zipfile
import re
import hashlib
import time
from datetime import datetime

def main():
    parser = argparse.ArgumentParser(description="Package Aero Skin")
    parser.add_argument("--output-dir", default="dist", help="Output directory")
    parser.add_argument("--version", help="Override version string (e.g. for trunk builds)")
    args = parser.parse_args()

    repo_root = os.getcwd()
    if os.path.basename(repo_root) == "dev":
        repo_root = os.path.dirname(repo_root)

    skin_dir = os.path.join(repo_root, "skins/Aero")
    output_dir = os.path.join(repo_root, args.output_dir)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Read version
    if args.version:
        version = args.version
    else:
        version_file = os.path.join(skin_dir, "VERSION")
        with open(version_file, "r") as f:
            version = f.read().strip()

    # Calculate hash of files to be included
    hasher = hashlib.sha256()

    zip_filename = f"weewx-aero-{version}.zip"
    zip_path = os.path.join(output_dir, zip_filename)

    print(f"Packaging {zip_filename}...")

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add skins/Aero content
        # Note: In WeeWX 5.x, templates are in data/ but should be installed to data/?
        # install.py handles installation mapping if specified.
        # But standard weewx extension zip layout is usually:
        # skins/Aero/...
        # install.py

        for root, dirs, files in os.walk(skin_dir):
            for file in files:
                if file.startswith('.'): continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, repo_root) # e.g. skins/Aero/index.html
                zf.write(abs_path, rel_path)

                # Update hash
                with open(abs_path, 'rb') as f:
                    hasher.update(f.read())

        # Add install.py
        install_py = os.path.join(repo_root, "install.py")
        if os.path.exists(install_py):
            zf.write(install_py, "install.py")
            with open(install_py, 'rb') as f:
                hasher.update(f.read())
        else:
            print("Warning: install.py not found!")

    print(f"Package created at {zip_path}")
    print(f"SHA256: {hasher.hexdigest()}")

if __name__ == "__main__":
    main()
