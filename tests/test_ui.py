import pytest
from playwright.sync_api import Page, expect
import subprocess
import time
import sys
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

DEV_DIR = Path(__file__).parent.parent
REPORT_OUT = DEV_DIR / "public_html"

@pytest.fixture(scope="session")
def report_server(report_output):
    server_address = ('localhost', 0)
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(REPORT_OUT), **kwargs)
    httpd = HTTPServer(server_address, Handler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever)
    thread.daemon = True
    thread.start()
    yield f"http://localhost:{port}"
    httpd.shutdown()

def test_homepage_loads(page: Page, report_server):
    page.goto(report_server)
    expect(page).to_have_title("Aero - WeeWX")

def test_current_conditions_visible(page: Page, report_server):
    page.goto(report_server)
    # Scope to current dials to avoid ambiguity
    expect(page.locator("#current-dials").get_by_text("Temperature", exact=True)).to_be_visible()

def test_history_tabs(page: Page, report_server):
    page.goto(report_server)
    page.get_by_role("button", name="Week").click()
    page.wait_for_timeout(1000)
    expect(page.locator("canvas").first).to_be_visible()

def test_charts_render(page: Page, report_server):
    page.goto(report_server)
    page.wait_for_timeout(1000)
    expect(page.locator("canvas").first).to_be_visible()
