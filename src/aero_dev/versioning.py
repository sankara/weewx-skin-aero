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

    # Regex to find version = "..." in [project] section
    # Simplified assumption: version = "..." is near the top
    # We want to match `version = "1.0.0"`
    new_content = re.sub(r'(version\s*=\s*")([\d\.]+)"', fr'\g<1>{version}"', content, count=1)

    with open(toml_path, "w") as f:
        f.write(new_content)

    print("pyproject.toml updated.")

if __name__ == "__main__":
    main()
