import argparse
import os
import re

def main():
    parser = argparse.ArgumentParser(description="Bump Aero Skin Version")
    parser.add_argument("version", help="New version string (e.g. 2.1.3)")
    args = parser.parse_args()

    repo_root = os.getcwd()
    if os.path.basename(repo_root) == "dev":
        repo_root = os.path.dirname(repo_root)

    skin_dir = os.path.join(repo_root, "skins/Aero")

    files_to_update = [
        os.path.join(skin_dir, "VERSION"),
        os.path.join(skin_dir, "skin.conf"),
        os.path.join(repo_root, "install.py")
    ]

    version = args.version
    print(f"Updating version to {version}...")

    # 1. Update VERSION file
    with open(os.path.join(skin_dir, "VERSION"), "w") as f:
        f.write(version)

    # 2. Update skin.conf
    # Look for `version = ...` under [Skin]
    skin_conf = os.path.join(skin_dir, "skin.conf")
    with open(skin_conf, "r") as f:
        content = f.read()

    new_content = re.sub(r'(version\s*=\s*)([\d\.]+)', fr'\g<1>{version}', content)

    with open(skin_conf, "w") as f:
        f.write(new_content)

    # 3. Update install.py
    # Look for `version="..."`
    install_py = os.path.join(repo_root, "install.py")
    if os.path.exists(install_py):
        with open(install_py, "r") as f:
            content = f.read()

        new_content = re.sub(r'(version\s*=\s*")([\d\.]+)"', fr'\g<1>{version}"', content)
        new_content = re.sub(r"(version\s*=\s*')([\d\.]+)'", fr"\g<1>{version}'", new_content)

        with open(install_py, "w") as f:
            f.write(new_content)

    print("Version updated.")

if __name__ == "__main__":
    main()
