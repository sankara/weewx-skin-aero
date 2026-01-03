from playwright.sync_api import Page
import pytest
import os

# Inject axe-core script from local node_modules
AXE_CORE_PATH = os.path.join(os.path.dirname(__file__), "../skins/Aero/node_modules/axe-core/axe.min.js")

def run_axe(page: Page):
    if not os.path.exists(AXE_CORE_PATH):
        pytest.fail(f"axe-core not found at {AXE_CORE_PATH}. Run 'npm install' in skins/Aero/")

    page.add_script_tag(path=AXE_CORE_PATH)
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
