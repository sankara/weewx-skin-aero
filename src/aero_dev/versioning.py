import argparse
import os
import re


def main():
    parser = argparse.ArgumentParser(description="Bump Aero Skin Version")
    parser.add_argument("version", help="New version string (e.g. 1.0.2)")
    args = parser.parse_args()

    repo_root = os.getcwd()
    # Handle running from src/aero_dev or root
    if os.path.basename(repo_root) == "aero_dev":
        repo_root = os.path.dirname(os.path.dirname(repo_root))
    elif os.path.basename(repo_root) == "src":
        repo_root = os.path.dirname(repo_root)

    toml_path = os.path.join(repo_root, "pyproject.toml")
    if not os.path.exists(toml_path):
        print(f"Error: pyproject.toml not found at {toml_path}")
        return

    version = args.version
    if version.startswith('v'):
        version = version[1:]

    print(f"Updating version to {version} in pyproject.toml...")
    with open(toml_path, "r") as f:
        content = f.read()
    new_content = re.sub(r'(version\s*=\s*")([\d.]+)"', fr'\g<1>{version}"', content, count=1)
    with open(toml_path, "w") as f:
        f.write(new_content)
    print("pyproject.toml updated.")

    install_py_path = os.path.join(repo_root, "install.py")
    if os.path.exists(install_py_path):
        print(f"Updating version to {version} in install.py...")
        with open(install_py_path, "r") as f:
            content = f.read()
        new_content = re.sub(r'(version\s*=\s*")([\d.]+)"', fr'\g<1>{version}"', content, count=1)
        with open(install_py_path, "w") as f:
            f.write(new_content)
        print("install.py updated.")

    skin_conf_path = os.path.join(repo_root, "skins", "Aero", "skin.conf")
    if os.path.exists(skin_conf_path):
        print(f"Updating version to {version} in skin.conf...")
        with open(skin_conf_path, "r") as f:
            content = f.read()
        new_content = re.sub(r'(version\s*=\s*)([\d.]+)', fr'\g<1>{version}', content, count=1)
        with open(skin_conf_path, "w") as f:
            f.write(new_content)
        print("skin.conf updated.")

    version_file_path = os.path.join(repo_root, "skins", "Aero", "VERSION")
    print(f"Updating version to {version} in skins/Aero/VERSION...")
    with open(version_file_path, "w") as f:
        f.write(f"{version}\n")
    print("skins/Aero/VERSION updated.")


if __name__ == "__main__":
    main()
