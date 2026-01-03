import pytest
from playwright.sync_api import Page, expect
import subprocess
import time
import sys
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import re


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

    # Open settings modal
    page.locator("#settings-btn").click()
    expect(page.locator("#settings-modal")).to_be_visible()

    # Get initial theme
    initial_is_dark = page.evaluate("document.documentElement.classList.contains('dark')")
    
    # Click the *other* theme button
    target_theme = "light" if initial_is_dark else "dark"
    page.locator(f".segment-control-sm[data-type='theme'] button[data-val='{target_theme}']").click()

    # Verify change
    new_is_dark = page.evaluate("document.documentElement.classList.contains('dark')")
    assert new_is_dark != initial_is_dark

def test_unit_toggle(page: Page, report_server):
    page.goto(report_server)
    
    # Open settings modal
    page.locator("#settings-btn").click()
    expect(page.locator("#settings-modal")).to_be_visible()

    # Toggle temp unit
    # First, see what's active (we assume one has class 'active' or similar, but for now just click the opposite)
    # Let's force click '°F' then '°C' and verify state changes or at least UI updates

    btn_f = page.locator(".segment-control-sm[data-type='temp'] button[data-val='°F']")
    btn_c = page.locator(".segment-control-sm[data-type='temp'] button[data-val='°C']")

    # Ensure one is clicked
    btn_c.click()
    expect(btn_c).to_have_class(re.compile(r"active"))

    btn_f.click()
    expect(btn_f).to_have_class(re.compile(r"active"))
