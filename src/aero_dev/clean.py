import argparse
import logging
import shutil
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def remove_path(path: Path):
    if not path.exists():
        return

    try:
        if path.is_file() or path.is_symlink():
            path.unlink()
            logger.info(f"Removed file: {path}")
        elif path.is_dir():
            shutil.rmtree(path)
            logger.info(f"Removed directory: {path}")
    except Exception as e:
        logger.error(f"Failed to remove {path}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Clean generated files and directories")
    args = parser.parse_args()

    repo_root = Path.cwd()

    # List of paths to clean relative to repo root
    paths_to_clean = [
        "build",
        "dist",
        "public_html",
        "public_html_test",
        "weewx.sdb",
        "skins/Aero/forecast_cache.json",
        ".pytest_cache",
        "htmlcov",
        ".coverage"
    ]

    logger.info("Cleaning generated files...")

    for p in paths_to_clean:
        remove_path(repo_root / p)

    # find and remove __pycache__
    for pycache in repo_root.rglob("__pycache__"):
        remove_path(pycache)

    logger.info("Clean complete.")


if __name__ == "__main__":
    main()
