import argparse
import os
import subprocess
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright


def capture_from_simulator(url, output_path):
    """Captures a screenshot from the booted iOS Simulator."""
    print("📱 Attempting to capture from iOS Simulator...")
    try:
        # Check if a simulator is booted
        result = subprocess.run(["xcrun", "simctl", "list", "devices", "booted"], capture_output=True, text=True)
        if "Booted" not in result.stdout:
            print("   Skipping: No booted simulator found.")
            return

        # Open the URL
        subprocess.run(["xcrun", "simctl", "openurl", "booted", url], check=True)
        time.sleep(6)  # Give it extra time to load and animate

        # Take the screenshot using 'io' subcommand
        # Usage: simctl io <device> screenshot [path]
        subprocess.run(["xcrun", "simctl", "io", "booted", "screenshot", output_path], check=True)
        print(f"   ✅ Simulator screenshot saved to {output_path}")
    except Exception as e:
        print(f"   ❌ Simulator capture failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="Generate Screenshots")
    parser.add_argument("--output", default="screenshots", help="Output directory")
    parser.add_argument("--report-dir", default="public_html", help="Path to generated report")
    parser.add_argument("--db", default="test-data/weewx.sdb", help="Path to sqlite database")
    parser.add_argument("--sim", action="store_true", help="Also capture from booted iOS Simulator")
    args = parser.parse_args()

    repo_root = os.getcwd()
    report_dir = os.path.abspath(os.path.join(repo_root, args.report_dir))
    output_dir = os.path.abspath(os.path.join(repo_root, args.output))
    db_path = os.path.abspath(os.path.join(repo_root, args.db))

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 1. Build
    if not os.path.exists(db_path):
        subprocess.run(["uv", "run", "aero-gen", "--output", db_path, "--days", "7"], check=True)
    subprocess.run(["uv", "run", "aero-build", "--db", db_path, "--output", report_dir], check=True)

    # 2. Start server
    server_address = ('localhost', 0)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=report_dir, **kwargs)

    httpd = HTTPServer(server_address, Handler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever)
    thread.daemon = True
    thread.start()

    url = f"http://localhost:{port}"

    # 3. Playwright Captures (Automated & Full Page)
    print("📸 Capturing high-res full-page screenshots via Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Desktop (MacBook Pro 14")
        desktop = browser.new_context(viewport={'width': 1512, 'height': 982}, device_scale_factor=2)
        page = desktop.new_page()
        page.goto(url)
        page.wait_for_load_state('networkidle')

        # Set Aero Design
        page.click('#settings-btn')
        page.wait_for_selector('.modal', state='visible')
        page.click('.segment-control-sm[data-type="design"] button[data-val="aero"]')
        page.click('#close-modal-btn')
        time.sleep(2)

        page.screenshot(path=os.path.join(output_dir, "desktop-light.png"), full_page=True)

        # Dark Mode
        page.click('#settings-btn')
        page.wait_for_selector('.modal', state='visible')
        page.click('.segment-control-sm[data-type="theme"] button[data-val="dark"]')
        page.click('#close-modal-btn')
        time.sleep(1)
        page.screenshot(path=os.path.join(output_dir, "desktop-dark.png"), full_page=True)

        # Mobile (iPhone 16 Pro)
        mobile = browser.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=3, is_mobile=True)
        m_page = mobile.new_page()
        m_page.goto(url)
        m_page.wait_for_load_state('networkidle')

        # Set Aero + Light
        m_page.click('#settings-btn')
        m_page.wait_for_selector('.modal', state='visible')
        m_page.click('.segment-control-sm[data-type="design"] button[data-val="aero"]')
        m_page.click('.segment-control-sm[data-type="theme"] button[data-val="light"]')
        m_page.click('#close-modal-btn')
        time.sleep(2)
        m_page.screenshot(path=os.path.join(output_dir, "mobile-light.png"), full_page=True)

        # Mobile Dark
        m_page.click('#settings-btn')
        m_page.wait_for_selector('.modal', state='visible')
        m_page.click('.segment-control-sm[data-type="theme"] button[data-val="dark"]')
        m_page.click('#close-modal-btn')
        time.sleep(1)
        m_page.screenshot(path=os.path.join(output_dir, "mobile-dark.png"), full_page=True)

        browser.close()

    # 4. Optional Simulator Capture
    if args.sim:
        capture_from_simulator(url, os.path.join(output_dir, "simulator-hero.png"))

    httpd.shutdown()
    print(f"\n✨ Done! Screenshots are in: {output_dir}")


if __name__ == "__main__":
    main()
