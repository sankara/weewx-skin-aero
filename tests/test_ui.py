import pytest
from playwright.sync_api import Page, expect
import subprocess
import time
import sys
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading



@pytest.fixture(scope="session")
def report_server(report_output):
    server_address = ('127.0.0.1', 0)
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(report_output), **kwargs)
    httpd = HTTPServer(server_address, Handler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever)
    thread.daemon = True
    thread.start()
    yield f"http://127.0.0.1:{port}"
    httpd.shutdown()

def test_homepage_loads(page: Page, report_server):
    page.goto(report_server)
    expect(page).to_have_title("Test Station")

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

def test_theme_toggle(page: Page, report_server):
    page.goto(report_server)
    # Check if dark class exists (default might be light or dark based on system)
    initial_is_dark = page.evaluate("document.documentElement.classList.contains('dark')")
    
    page.locator("#theme-toggle").click()
    new_is_dark = page.evaluate("document.documentElement.classList.contains('dark')")
    assert new_is_dark != initial_is_dark

def test_unit_toggle(page: Page, report_server):
    page.goto(report_server)
    # Get initial unit text from the toggle button or a dial
    initial_text = page.locator("#unit-toggle").inner_text()
    
    page.locator("#unit-toggle").click()
    new_text = page.locator("#unit-toggle").inner_text()
    assert new_text != initial_text
