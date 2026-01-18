import pytest
from playwright.sync_api import Page, expect
import re


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


def test_forecast_view_navigation(page: Page, report_server):
    """Test that clicking Forecast button navigates to forecast view."""
    page.goto(report_server)
    page.get_by_role("button", name="Forecast").click()
    page.wait_for_timeout(500)

    # URL should include #/forecast
    expect(page).to_have_url(re.compile(r"#/forecast"))


def test_forecast_view_displays_content(page: Page, report_server):
    """Test that forecast view displays the 7-day forecast."""
    page.goto(f"{report_server}#/forecast")
    page.wait_for_timeout(1000)

    # Check for forecast items instead of headings (which were removed for aesthetics)
    daily_items = page.locator(".daily-item")
    forecast_unavailable = page.locator(".forecast-unavailable")

    is_daily_visible = daily_items.first.is_visible()
    is_unavailable_visible = forecast_unavailable.is_visible()

    assert is_daily_visible or is_unavailable_visible, \
        "Forecast view should show either forecast data items or unavailable message"


