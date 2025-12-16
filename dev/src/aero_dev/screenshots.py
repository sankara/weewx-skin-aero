import argparse
import os
import sys
import time
from playwright.sync_api import sync_playwright
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

def main():
    parser = argparse.ArgumentParser(description="Generate Screenshots")
    parser.add_argument("--output", default="screenshots", help="Output directory")
    parser.add_argument("--report-dir", default="dev/public_html", help="Path to generated report")
    args = parser.parse_args()

    repo_root = os.getcwd()
    if os.path.basename(repo_root) == "dev":
        repo_root = os.path.dirname(repo_root)

    report_dir = os.path.abspath(os.path.join(repo_root, args.report_dir))
    output_dir = os.path.abspath(os.path.join(repo_root, args.output))

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Start server
    print(f"Serving {report_dir}...")
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

    print("Capturing screenshots...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1200, 'height': 800})

        # Desktop
        page.goto(url)
        page.wait_for_timeout(2000) # Wait for animations
        page.screenshot(path=os.path.join(output_dir, "desktop-light.png"))

        # Dark mode?
        # Aero skin detects system preference? Or has toggle?
        # It has toggle #unit-toggle (imperial/metric).
        # Dark mode might be CSS media query.
        page.emulate_media(color_scheme='dark')
        page.reload()
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(output_dir, "desktop-dark.png"))

        # Mobile
        page = browser.new_page(viewport={'width': 375, 'height': 667})
        page.goto(url)
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(output_dir, "mobile-light.png"))

        browser.close()

    httpd.shutdown()
    print("Screenshots captured.")

if __name__ == "__main__":
    main()
