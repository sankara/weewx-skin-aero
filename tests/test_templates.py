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

# We rely on fixtures from conftest.py: generated_data and report_output

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

def test_weatherplus_json_structure(report_output):
    """Verify weatherplus.json structure for Homebridge."""
    with open(report_output / "data" / "weatherplus.json") as f:
        data = json.load(f)

    # Check for observations array
    assert "observations" in data
    assert isinstance(data["observations"], list)
    assert len(data["observations"]) > 0

    obs = data["observations"][0]
    assert "stationID" in obs
    assert "epoch" in obs
    assert "imperial" in obs
    assert "metric" in obs
    assert "metric_si" in obs
    assert "uk_hybrid" in obs
