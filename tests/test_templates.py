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


def test_forecast_json_exists(report_output):
    """Verify that forecast.json is generated."""
    assert (report_output / "data" / "forecast.json").exists(), "forecast.json is missing"


def test_forecast_json_structure(report_output):
    """Verify forecast.json has required structure."""
    with open(report_output / "data" / "forecast.json") as f:
        data = json.load(f)

    # Check meta section
    assert "meta" in data
    assert "time" in data["meta"]
    assert "enabled" in data["meta"]

    # Check arrays exist
    assert "hourly" in data
    assert "daily" in data
    assert "alerts" in data
    assert isinstance(data["hourly"], list)
    assert isinstance(data["daily"], list)
    assert isinstance(data["alerts"], list)


def test_forecast_json_enabled_with_data(report_output):
    """Verify forecast.json has data when enabled."""
    with open(report_output / "data" / "forecast.json") as f:
        data = json.load(f)

    # When enabled, should have hourly and daily data
    if data["meta"]["enabled"]:
        assert len(data["hourly"]) > 0, "Enabled forecast should have hourly data"
        assert len(data["daily"]) > 0, "Enabled forecast should have daily data"
        assert data["meta"]["provider"] is not None, "Enabled forecast should have provider"

        # Check hourly structure
        hour = data["hourly"][0]
        assert "timestamp" in hour
        assert "temp" in hour
        assert "icon" in hour

        # Check daily structure
        day = data["daily"][0]
        assert "date" in day
        assert "tempHigh" in day
        assert "tempLow" in day
        assert "icon" in day


def test_forecast_json_with_dirty_alerts():
    """Verify that forecast.json handles alerts with newlines and quotes correctly."""
    from Cheetah.Template import Template
    
    template_path = Path(__file__).parent.parent / "skins" / "Aero" / "data" / "forecast.json.tmpl"
    with open(template_path) as f:
        template_content = f.read()
        
    # Mock data with exact snippet from issue
    mock_forecast = {
        'provider': 'test',
        'updated': 12345,
        'enabled': True,
        'hourly': [],
        'daily': [],
        'alerts': [
            {
                'event': 'High Wind Watch',
                'headline': 'High Wind Watch issued February 23 at 12:54PM MST until February 27 at 8:00AM MST by NWS Great Falls MT',
                'description': """* WHAT...West winds 30 to 40 mph with gusts up to 70 mph possible.

WHERE...Cascade County, including the Little Belt and Highwood
Mountains, Judith Basin County and Judith Gap, Upper Blackfoot and
MacDonald Pass, Gates of the Mountains, and Big Belt, Bridger and
Castle Mountains.

WHEN...From late Tuesday night through Friday morning.

IMPACTS...High winds may move loose debris, damage property and
cause power outages. Travel could be difficult, especially for
high profile vehicles.""",
                'severity': 'Severe',
                'urgency': 'Future',
                'onset': '2026-02-25T02:00:00-07:00',
                'expires': '2026-02-24T04:00:00-07:00',
                'instruction': """Monitor the latest forecasts and warnings for updates.

Remember, a High Wind Watch means that there is at least a 50%
chance of 40 mph sustained winds or 58 mph wind gusts occurring
during the watch period."""
            }
        ]
    }
    
    # Mock current object
    class DummyObj:
        pass
    
    current_obj = DummyObj()
    current_obj.dateTime = DummyObj()
    current_obj.dateTime.raw = 1768721100
    
    # Render the template
    t = Template(template_content, searchList=[{'aero_forecast': mock_forecast, 'current': current_obj}])
    
    output = str(t)
    
    # Verify that the output is valid JSON
    data = json.loads(output)
    assert len(data['alerts']) == 1
    assert data['alerts'][0]['event'] == 'High Wind Watch'
    assert data['alerts'][0]['description'].startswith('* WHAT...West winds')
    assert 'high profile vehicles.' in data['alerts'][0]['description']
    assert data['alerts'][0]['instruction'].startswith('Monitor the latest')
