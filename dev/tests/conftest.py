import pytest
import subprocess
from pathlib import Path

DEV_DIR = Path(__file__).parent.parent
TEST_DATA_DB = DEV_DIR / "weewx.sdb"
REPORT_OUT = DEV_DIR / "public_html"

@pytest.fixture(scope="session")
def generated_data():
    """Generates the test database if it doesn't exist."""
    if not TEST_DATA_DB.exists():
        print("Generating test database...")
        # Run the generator module
        subprocess.run(["uv", "run", "aero-gen", "--output", str(TEST_DATA_DB), "--days", "7"],
                       cwd=DEV_DIR, check=True)
    return TEST_DATA_DB

@pytest.fixture(scope="session")
def report_output(generated_data):
    """Builds the report if it doesn't exist or is empty."""
    # Always rebuild to be safe in dev, or check existence for speed.
    # For now, let's check existence.
    if not REPORT_OUT.exists() or not any(REPORT_OUT.iterdir()):
        print("Building report...")
        subprocess.run(["uv", "run", "aero-build", "--db", str(generated_data), "--output", str(REPORT_OUT)],
                       cwd=DEV_DIR, check=True)
    return REPORT_OUT
