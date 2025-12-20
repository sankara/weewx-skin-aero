import subprocess
import sys
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, cwd=None):
    """Runs a shell command and returns true if successful."""
    logger.info(f"Running: {' '.join(command)} in {cwd or 'current directory'}")
    try:
        result = subprocess.run(command, cwd=cwd, check=True)
        return True
    except subprocess.CalledProcessError:
        logger.error(f"Command failed: {' '.join(command)}")
        return False
    except FileNotFoundError as e:
        logger.error(f"Command not found: {command[0]}. {e}")
        return False

def main():
    root_dir = Path(__file__).parent.parent.parent
    js_dir = root_dir / "skins" / "Aero"
    
    success = True

    # 1. Run Python Tests
    logger.info("--- Running Python Tests (Pytest) ---")
    if not run_command(["pytest"], cwd=root_dir):
        success = False

    # 2. Run JS Tests
    logger.info("\n--- Running JavaScript Tests (Vitest) ---")
    # Check if node_modules exists, if not maybe suggest npm install
    if not (js_dir / "node_modules").exists():
        logger.warning("node_modules not found in skins/Aero. Attempting to install...")
        if not run_command(["npm", "install"], cwd=js_dir):
            logger.error("Failed to install JS dependencies.")
            success = False
    
    if success:
        if not run_command(["npx", "vitest", "run"], cwd=js_dir):
            success = False

    if success:
        logger.info("\n✅ All tests passed!")
        sys.exit(0)
    else:
        logger.error("\n❌ Some tests failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
