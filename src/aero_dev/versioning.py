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

    # Update README.md
    readme_path = os.path.join(repo_root, "README.md")
    if os.path.exists(readme_path):
        print(f"Updating version to {version} in README.md...")
        with open(readme_path, "r") as f:
            readme_content = f.read()

        # Replace version in download URL and filename
        # Pattern looks for vX.X.X/weewx-aero-vX.X.X.zip
        # We replace with v{version}/weewx-aero-v{version}.zip
        
        # Regex to capture the version part in the specific URL context
        # https://github.com/.../download/v1.2.1/weewx-aero-v1.2.1.zip
        # limiting to the specific context to avoid incidental numbers
        
        new_readme_content = re.sub(
            r'/download/v[\d\.]+/weewx-aero-v[\d\.]+\.zip',
            f'/download/v{version}/weewx-aero-v{version}.zip',
            readme_content
        )
        
        # Also update the install command filename (which now includes URL)
        # weectl extension install https://github.com/.../weewx-aero-v1.2.1.zip
        new_readme_content = re.sub(
             r'weectl extension install https://.*/weewx-aero-v[\d\.]+\.zip',
             f'weectl extension install https://github.com/sankara/weewx-skin-aero/releases/download/v{version}/weewx-aero-v{version}.zip',
             new_readme_content
        )

        with open(readme_path, "w") as f:
            f.write(new_readme_content)
        
        print("README.md updated.")

if __name__ == "__main__":
    main()
