import pytest
import subprocess
import os
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

# Paths are now relative to the root, since tests is at root level
ROOT_DIR = Path(__file__).parent.parent
BUILD_DIR = ROOT_DIR / "build"
DEFAULT_DB_PATH = BUILD_DIR / "weewx.sdb"
REPORT_OUT = BUILD_DIR / "public_html"

def pytest_addoption(parser):
    parser.addoption(
        "--db-path", action="store", default=str(DEFAULT_DB_PATH), help="Path to weewx.sdb"
    )

@pytest.fixture(scope="session")
def test_db_path(request):
    """Returns the path to the database to be used for testing."""
    db_path = Path(request.config.getoption("--db-path"))

    # If the default path is used and it doesn't exist, we'll need to generate it.
    # If a custom path is provided, we assume it exists or will be generated if it matches the default logic.
    return db_path

@pytest.fixture(scope="session")
def generated_data(test_db_path):
    """Generates the test database if it doesn't exist."""
    # Ensure build dir exists if we are using the default path
    if test_db_path == DEFAULT_DB_PATH:
        BUILD_DIR.mkdir(exist_ok=True)

    if not test_db_path.exists():
        print(f"Generating test database at {test_db_path}...")
        # Run the generator module
        subprocess.run(["uv", "run", "aero-gen", "--output", str(test_db_path), "--days", "7"],
                       cwd=ROOT_DIR, check=True)
    return test_db_path

@pytest.fixture(scope="session")
def report_output(generated_data):
    """Builds the report if it doesn't exist or is empty."""
    # Ensure build dir exists
    BUILD_DIR.mkdir(exist_ok=True)

    # Always rebuild to be safe in dev, or check existence for speed.
    # For now, let's check existence.
    if not REPORT_OUT.exists() or not any(REPORT_OUT.iterdir()):
        print("Building report...")
        subprocess.run(["uv", "run", "aero-build", "--db", str(generated_data), "--output", str(REPORT_OUT)],
                       cwd=ROOT_DIR, check=True)
    return REPORT_OUT

@pytest.fixture(scope="session")
def report_server(report_output):
    """Start a local HTTP server serving the report output."""
    server_address = ('127.0.0.1', 0)
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(report_output), **kwargs)
        def log_message(self, format, *args):
            pass  # Suppress logging
    httpd = HTTPServer(server_address, Handler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever)
    thread.daemon = True
    thread.start()
    yield f"http://127.0.0.1:{port}"
    httpd.shutdown()
