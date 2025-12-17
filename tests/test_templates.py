import os
import json
import pytest
import subprocess
import shutil
from pathlib import Path

# Paths
DEV_DIR = Path(__file__).parent.parent
PROJECT_ROOT = DEV_DIR.parent
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
    # We check if data exists
    data_dir = REPORT_OUT / "data"
    if not data_dir.exists() or not any(data_dir.iterdir()):
        print("Building report...")
        subprocess.run(["uv", "run", "aero-build", "--db", str(generated_data), "--output", str(REPORT_OUT)],
                       cwd=DEV_DIR, check=True)
    return REPORT_OUT

def test_json_files_exist(report_output):
    """Verify that key JSON files are generated."""
    # Note: week.json is renamed to week-to-date.json
    expected_files = ["current.json", "week-to-date.json", "month.json"]
    for fname in expected_files:
        assert (report_output / "data" / fname).exists(), f"{fname} is missing in data/"

def test_current_json_structure(report_output):
    """Verify current.json structure."""
    with open(report_output / "data" / "current.json") as f:
        data = json.load(f)

    # Check for observations array
    assert "observations" in data
    assert isinstance(data["observations"], list)

    # Check for temperature
    found_temp = False
    for item in data["observations"]:
        if item.get("observation") == "outTemp":
            found_temp = True
            assert "current" in item
            break
    assert found_temp

def test_week_json_structure(report_output):
    """Verify week.json structure."""
    with open(report_output / "data" / "week-to-date.json") as f:
        data = json.load(f)

    # Check for observations array
    assert "observations" in data

    found_temp = False
    for item in data["observations"]:
        if item.get("observation") == "outTemp":
            found_temp = True
            assert "graph" in item
            graph = item["graph"]
            assert isinstance(graph, list)
            if len(graph) > 0:
                # [timestamp, val]
                assert len(graph[0]) >= 2
            break
    assert found_temp
