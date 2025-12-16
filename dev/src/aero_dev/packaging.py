import argparse
import os
import zipfile
import re
import hashlib
import time
from datetime import datetime

def update_install_py(repo_root, file_list):
    install_py_path = os.path.join(repo_root, "install.py")
    if not os.path.exists(install_py_path):
        print("Warning: install.py not found, skipping update.")
        return

    with open(install_py_path, "r") as f:
        content = f.read()

    # Find the files=[ block
    start_marker = "files=["
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Error: files=[ parameter not found in install.py")
        return

    # Find matching closing bracket
    balance = 0
    end_idx = -1
    for i in range(start_idx, len(content)):
        char = content[i]
        if char == '[':
            balance += 1
        elif char == ']':
            balance -= 1
            if balance == 0:
                end_idx = i + 1
                break

    if end_idx == -1:
        print("Error: Could not find closing bracket for files=[ in install.py")
        return

    # Construct new files block
    # Maintain indentation
    indent = "                "
    files_block = "files=[\n"
    files_block += indent + "('skins/Aero', [\n"

    for f in sorted(file_list):
        files_block += indent + "    '" + f + "',\n"

    files_block += indent + "]),\n"
    files_block += "            ]"

    new_content = content[:start_idx] + files_block + content[end_idx:]

    with open(install_py_path, "w") as f:
        f.write(new_content)
    print("Updated install.py with new file list.")

def main():
    parser = argparse.ArgumentParser(description="Package Aero Skin")
    parser.add_argument("--output-dir", default="dist", help="Output directory")
    parser.add_argument("--version", help="Override version string")
    args = parser.parse_args()

    # Determine repo root
    # Assumption: script is in dev/src/aero_dev/ or similar, but run from ?
    # Let's find 'skins' directory to anchor.
    cw = os.getcwd()
    repo_root = cw
    while not os.path.exists(os.path.join(repo_root, "skins")) and repo_root != "/":
        repo_root = os.path.dirname(repo_root)

    if not os.path.exists(os.path.join(repo_root, "skins")):
        # Fallback if not found (e.g. strange execution context), assume CWD or one level up
        if os.path.exists("skins"):
            repo_root = "."
        else:
            repo_root = ".." # classic dev/ execution

    repo_root = os.path.abspath(repo_root)
    skin_dir = os.path.join(repo_root, "skins/Aero")
    output_dir = os.path.join(repo_root, args.output_dir)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Determine version
    if args.version:
        version = args.version
    else:
        version_file = os.path.join(skin_dir, "VERSION")
        if os.path.exists(version_file):
            with open(version_file, "r") as f:
                version = f.read().strip()
        else:
            version = "0.0.0"

    # Gather files
    file_list = []
    for root, dirs, files in os.walk(skin_dir):
        for file in files:
            if file.startswith('.'): continue
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, repo_root) # e.g. skins/Aero/index.html
            file_list.append(rel_path)

    # Update install.py
    update_install_py(repo_root, file_list)

    # Create Zip
    zip_filename = f"weewx-aero-{version}.zip"
    zip_path = os.path.join(output_dir, zip_filename)

    print(f"Packaging {zip_filename}...")
    print(f"Repo root: {repo_root}")
    print(f"Skin dir: {skin_dir}")

    hasher = hashlib.sha256()

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add skin files
        for rel_path in file_list:
             abs_path = os.path.join(repo_root, rel_path)
             zf.write(abs_path, rel_path)
             with open(abs_path, 'rb') as f:
                 hasher.update(f.read())

        # Add install.py
        install_py = os.path.join(repo_root, "install.py")
        if os.path.exists(install_py):
            zf.write(install_py, "install.py")
            with open(install_py, 'rb') as f:
                hasher.update(f.read())
        else:
            print("Warning: install.py not found for zipping!")

    print(f"Package created at {zip_path}")
    print(f"SHA256: {hasher.hexdigest()}")

if __name__ == "__main__":
    main()
