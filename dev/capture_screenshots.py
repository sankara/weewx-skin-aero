from playwright.sync_api import sync_playwright
import time
import os

def capture():
    output_dir = "screenshots"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to a nice desktop size
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        print("Loading page...")
        try:
            page.goto("http://localhost:8000/index.html")
            page.wait_for_load_state("networkidle")
            time.sleep(2) # Allow JS animations

            # Capture main preview - Full Page to see history section too
            page.screenshot(path=f"{output_dir}/aero-preview.png", full_page=True)
            print(f"Saved {output_dir}/aero-preview.png")

        except Exception as e:
            print(f"Error: {e}")

        browser.close()

if __name__ == "__main__":
    capture()
