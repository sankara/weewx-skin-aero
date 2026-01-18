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
    """Test that forecast view displays hourly and daily forecast."""
    page.goto(f"{report_server}#/forecast")
    page.wait_for_timeout(1000)

    # Check for forecast sections
    hourly_heading = page.get_by_role("heading", name="Hourly Forecast")
    daily_heading = page.get_by_role("heading", name="7-Day Forecast")

    # At least one should be visible (if forecast is enabled) or
    # unavailable message should show (if disabled)
    forecast_unavailable = page.locator(".forecast-unavailable")

    is_hourly_visible = hourly_heading.is_visible()
    is_daily_visible = daily_heading.is_visible()
    is_unavailable_visible = forecast_unavailable.is_visible()

    # Either forecast content is shown OR unavailable message is shown
    assert is_hourly_visible or is_daily_visible or is_unavailable_visible, \
        "Forecast view should show either forecast data or unavailable message"


def test_forecast_date_navigation_disabled(page: Page, report_server):
    """Test that date navigation is disabled in forecast view."""
    page.goto(f"{report_server}#/forecast")
    page.wait_for_timeout(500)

    # Previous and Next buttons should be disabled
    prev_btn = page.locator("#date-prev")
    next_btn = page.locator("#date-next")

    expect(prev_btn).to_be_disabled()
    expect(next_btn).to_be_disabled()
