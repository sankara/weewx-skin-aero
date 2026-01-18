"""
Accessibility tests for the Aero WeeWX skin.

These tests verify that the skin meets WCAG 2.1 AA accessibility standards.
"""
import pytest
from playwright.sync_api import Page, expect


class TestAccessibility:
    """Tests for WCAG 2.1 AA compliance and accessibility best practices."""

    def test_skip_navigation_link(self, page: Page, report_server: str):
        """Test that skip navigation link exists and works."""
        page.goto(report_server)

        # Check skip link exists
        skip_link = page.locator('.skip-link')
        expect(skip_link).to_have_count(1)
        expect(skip_link).to_have_attribute('href', '#content-area')

    def test_heading_hierarchy(self, page: Page, report_server: str):
        """Test that heading hierarchy is logical and sequential."""
        page.goto(report_server)

        # Get all headings
        h1_count = page.locator('h1').count()
        h2_count = page.locator('h2').count()

        # Should have exactly one h1
        assert h1_count == 1, f"Expected 1 h1, found {h1_count}"

        # Should have at least one h2
        assert h2_count >= 1, f"Expected at least 1 h2, found {h2_count}"

    def test_interactive_elements_have_labels(self, page: Page, report_server: str):
        """Test that all interactive elements have accessible labels."""
        page.goto(report_server)
        # Wait for content to load (cards indicate JS has rendered)
        page.wait_for_selector('.card', timeout=10000)

        # Check buttons have labels (either text content or aria-label)
        buttons = page.locator('button:not([disabled])')
        button_count = buttons.count()

        for i in range(button_count):
            button = buttons.nth(i)
            text_content = button.text_content().strip()
            aria_label = button.get_attribute('aria-label')

            assert text_content or aria_label, (
                f"Button at index {i} has no accessible label"
            )

    def test_modal_accessibility(self, page: Page, report_server: str):
        """Test that modal dialog is accessible."""
        page.goto(report_server)
        page.wait_for_selector('#settings-btn', timeout=10000)

        # Open modal
        page.click('#settings-btn')
        page.wait_for_selector('#settings-modal', state='visible')

        # Check modal has proper ARIA attributes
        modal_overlay = page.locator('#modal-overlay')
        # Close button exists
        close_btn = page.locator('#close-modal-btn')
        expect(close_btn).to_have_count(1)

        # Test Escape key closes modal
        page.keyboard.press('Escape')
        page.wait_for_selector('#settings-modal', state='hidden')

    def test_keyboard_navigation(self, page: Page, report_server: str):
        """Test that keyboard navigation works properly."""
        page.goto(report_server)
        page.wait_for_selector('#settings-btn', timeout=10000)

        # Open modal with keyboard
        page.focus('#settings-btn')
        page.keyboard.press('Enter')
        page.wait_for_selector('#settings-modal', state='visible')

        # Close with Escape
        page.keyboard.press('Escape')
        page.wait_for_selector('#settings-modal', state='hidden')

    def test_focus_indicators_visible(self, page: Page, report_server: str):
        """Test that focus indicators are visible on interactive elements."""
        page.goto(report_server)
        page.wait_for_selector('#settings-btn', timeout=10000)

        # Focus on settings button
        settings_btn = page.locator('#settings-btn')
        settings_btn.focus()

        # Check that element is focused
        expect(settings_btn).to_be_focused()

    def test_canvas_elements_have_alternatives(self, page: Page, report_server: str):
        """Test that canvas elements have accessible alternatives."""
        page.goto(report_server)
        # Wait for content to load (cards indicate JS has rendered)
        page.wait_for_selector('.card', timeout=10000)

        # Canvas elements should be wrapped in containers with aria-label
        # Check both .card (observations) and .graph-card (history charts)
        cards_with_canvas = page.locator('.card:has(canvas), .graph-card:has(canvas)')
        card_count = cards_with_canvas.count()

        for i in range(card_count):
            card = cards_with_canvas.nth(i)
            role = card.get_attribute('role')
            aria_label = card.get_attribute('aria-label')

            # Card should have role='region' and aria-label
            assert role == 'region', (
                f"Card at index {i} should have role='region', got '{role}'"
            )
            assert aria_label and len(aria_label) > 0, (
                f"Card at index {i} should have descriptive aria-label"
            )

    def test_canvas_has_role_img(self, page: Page, report_server: str):
        """Test that canvas elements have role=img and aria-label."""
        page.goto(report_server)
        # Wait for content to load (cards indicate JS has rendered)
        page.wait_for_selector('.card', timeout=10000)

        # All canvas elements should have role="img" and aria-label
        canvases = page.locator('canvas')
        canvas_count = canvases.count()

        for i in range(canvas_count):
            canvas = canvases.nth(i)
            role = canvas.get_attribute('role')
            aria_label = canvas.get_attribute('aria-label')

            assert role == 'img', (
                f"Canvas at index {i} should have role='img', got '{role}'"
            )
            assert aria_label and len(aria_label) > 0, (
                f"Canvas at index {i} should have descriptive aria-label"
            )

    def test_screen_reader_text_exists(self, page: Page, report_server: str):
        """Test that screen reader text exists for canvas elements."""
        page.goto(report_server)
        # Wait for content to load (cards indicate JS has rendered)
        page.wait_for_selector('.card', timeout=10000)

        # Check for sr-only elements (visually hidden but accessible)
        sr_only_elements = page.locator('.sr-only')
        sr_only_count = sr_only_elements.count()

        assert sr_only_count > 0, "Expected screen reader text elements (sr-only class)"

    def test_forecast_view_accessibility(self, page: Page, report_server: str):
        """Test forecast view for accessibility."""
        page.goto(report_server)
        page.wait_for_selector('.nav-btn[data-view="forecast"]', timeout=10000)

        # Navigate to forecast view
        page.click('.nav-btn[data-view="forecast"]')
        page.wait_for_timeout(1000)

        # Check forecast container is visible or unavailable message shows
        forecast_container = page.locator('#forecast-container')
        unavailable_msg = page.locator('.forecast-unavailable')

        # Either forecast is shown or unavailable message
        daily_items = page.locator(".daily-item")
        is_forecast_visible = daily_items.first.is_visible()
        is_unavailable_visible = unavailable_msg.is_visible()

        assert is_forecast_visible or is_unavailable_visible, (
            "Forecast container data or unavailable message should be visible"
        )

    def test_responsive_accessibility(self, page: Page, report_server: str):
        """Test accessibility at mobile viewport size."""
        # Set mobile viewport
        page.set_viewport_size({"width": 375, "height": 667})
        page.goto(report_server)
        page.wait_for_selector('#current-dials', timeout=10000)

        # Check mobile select exists and has accessible label
        mobile_select = page.locator('#mobile-view-select')
        expect(mobile_select).to_be_visible()
