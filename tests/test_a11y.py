from playwright.sync_api import Page
import pytest
import os

# Inject axe-core script
AXE_CORE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js"

@pytest.fixture
def axe_script(page: Page):
    # Try to fetch from CDN, fallback if not available (not implemented here, assuming internet access or local file)
    # Since we can't easily download in fixture without requests/etc, we'll let page.add_script_tag handle it
    # But for a robust test we might want to bundle it.
    # For now, we'll use the URL.
    return AXE_CORE_URL

def run_axe(page: Page):
    page.add_script_tag(url=AXE_CORE_URL)
    results = page.evaluate("""
        () => {
            return new Promise((resolve, reject) => {
                axe.run((err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
        }
    """)
    return results

def test_accessibility(page: Page):
    # Load the generated index.html.
    # This assumes the report has been built to build/index.html
    # We need to run the build step first or assume it is there.
    # The agent instructions say "Frontend verification must use generated synthetic data ... and built reports".

    # We'll assume the user runs `uv run aero-build` before testing, or we trigger it.
    # But pytest usually runs on existing files.
    # Let's check if build/index.html exists.

    # The output is in public_html/index.html based on aero-build output
    if not os.path.exists("public_html/index.html"):
        pytest.skip("public_html/index.html not found. Run 'uv run aero-build' first.")

    # Use the running server to avoid CORS issues with file:// and fetch
    page.goto("http://localhost:8000/public_html/index.html")

    # Wait for the page to load and JS to render elements
    page.wait_for_selector("#current-dials canvas")

    results = run_axe(page)

    violations = results['violations']
    if violations:
        # Filter out some potential false positives or known issues if any
        # For now, print them
        messages = []
        for v in violations:
            nodes = [n['html'] for n in v['nodes']]
            messages.append(f"{v['id']}: {v['help']} ({len(nodes)} occurrences)\n" + "\n".join(nodes))

        pytest.fail(f"Accessibility violations found:\n\n" + "\n\n".join(messages))
