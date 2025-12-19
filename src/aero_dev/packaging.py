import argparse
import os
import zipfile
import shutil

import hashlib
import aero_dev.bundler as bundler

def update_install_py(install_py_path, file_list):
    if not os.path.exists(install_py_path):
        print(f"Warning: {install_py_path} not found, skipping update.")
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
    print(f"Updated {install_py_path} with new file list.")

def main():
    parser = argparse.ArgumentParser(description="Package Aero Skin")
    parser.add_argument("--output-dir", default="dist", help="Output directory")
    parser.add_argument("--version", help="Override version string")
    args = parser.parse_args()

    # Determine repo root
    cw = os.getcwd()
    repo_root = cw
    while not os.path.exists(os.path.join(repo_root, "skins")) and repo_root != "/":
        repo_root = os.path.dirname(repo_root)

    if not os.path.exists(os.path.join(repo_root, "skins")):
        if os.path.exists("skins"):
            repo_root = "."
        else:
            repo_root = ".."

    repo_root = os.path.abspath(repo_root)
    skin_dir = os.path.join(repo_root, "skins/Aero")
    output_dir = os.path.join(repo_root, args.output_dir)

    # Define build directory
    build_dir = os.path.join(repo_root, "build/package")
    # Define package root inside build directory to satisfy "common path" requirement
    pkg_root = os.path.join(build_dir, "aero")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Clean and recreate build directory
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(pkg_root)

    print(f"Preparing package in {pkg_root}...")

    # Copy skins/Aero
    target_skin_dir = os.path.join(pkg_root, "skins/Aero")
    shutil.copytree(skin_dir, target_skin_dir, ignore=shutil.ignore_patterns('.*'))

    # Copy root files (README, LICENSE) to skins/Aero
    extra_files = ['README.md', 'LICENSE']
    for extra in extra_files:
        src = os.path.join(repo_root, extra)
        if os.path.exists(src):
            shutil.copy(src, target_skin_dir)

    # Copy install.py to root of pkg_root
    src_install = os.path.join(repo_root, "install.py")
    dst_install = os.path.join(pkg_root, "install.py")
    if os.path.exists(src_install):
        shutil.copy(src_install, dst_install)
    else:
        print("Error: install.py not found in repo root.")
        return



    # Determine version
    if args.version:
        version = args.version
    else:
        version_file = os.path.join(target_skin_dir, "VERSION")
        if os.path.exists(version_file):
            with open(version_file, "r") as f:
                version = f.read().strip()
        else:
            version = "0.0.0"

    # Bundle Assets (CSS/JS)
    # This runs npm build, updates index.html and skin.conf in the target directory
    bundler.run_bundler(target_skin_dir)

    # Gather files for install.py list
    # We want to list all files in skins/Aero relative to the package root (inside the zip root)
    file_list = []
    for root, dirs, files in os.walk(target_skin_dir):
        for file in files:
            if file.startswith('.'): continue
            # Exclude node_modules if they were copied or created (bundler installs them)
            # Actually bundler installs them in target_skin_dir. We should exclude them from the zip list.
            if 'node_modules' in root: continue
            
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, pkg_root) # e.g. skins/Aero/index.html
            file_list.append(rel_path)

    # Update install.py in the pkg_root
    update_install_py(dst_install, file_list)

    # Cleanup before zipping
    # Remove node_modules
    nm_dir = os.path.join(target_skin_dir, 'node_modules')
    if os.path.exists(nm_dir):
        shutil.rmtree(nm_dir)
    
    # Remove source files that are now bundled
    # We keep index.html and skin.conf of course
    removals = [
        'package.json', 'package-lock.json', 'webpack.config.js',
        'app.js', 'style.css', 'utils.js', 'charts.js', 'ui.js', 'state.js'
    ]
    for r in removals:
        p = os.path.join(target_skin_dir, r)
        if os.path.exists(p):
            os.remove(p)

    # Create Zip
    zip_filename = f"weewx-aero-{version}.zip"
    zip_path = os.path.join(output_dir, zip_filename)

    print(f"Packaging {zip_filename}...")

    hasher = hashlib.sha256()

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Walk the build directory and add everything to zip
        for root, dirs, files in os.walk(build_dir):
            for file in files:
                if file.startswith('.'): continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, build_dir)

                zf.write(abs_path, rel_path)

                with open(abs_path, 'rb') as f:
                    hasher.update(f.read())

    print(f"Package created at {zip_path}")
    print(f"SHA256: {hasher.hexdigest()}")

    # Cleanup (optional, but good for local dev)
    # shutil.rmtree(build_dir)

if __name__ == "__main__":
    main()
