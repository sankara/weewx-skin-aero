# Aero Skin - Agent Learnings & System Architecture

This document serves as a knowledge base for the Aero Skin project, capturing key architectural decisions, component behaviors, and development workflows.

## 1. UI Architecture

### Dark Mode & Theming
- **Mechanism**: Dark mode is controlled via a class toggle (`.dark`) on the `<html>` element.
- **Trigger**: The **Settings Modal** (or legacy Moon Icon) toggles this mode.
- **Implementation**:
    - **Variables**: All colors are defined as CSS variables in `:root` (e.g., `--color-text-primary`, `--card-bg`).
    - **Overrides**: Dark mode values are defined in `html.dark`.
    - **JS Integration**: `ui.js` uses `resolveThemeColor()` to read these computed styles when converting them for Canvas rendering (which requires hex strings).

### Design Variants
- **Aero Theme**: Enabled via `.theme-aero` class. It uses advanced glassmorphism (frosted glass) effects, multi-layered shadows, and vibrant gradients.
- **Simple Theme**: The default fallback with solid/semi-transparent cards and standard shadows.

### Mobile Strategy
- **Responsive Design**: Uses CSS Grid and Flexbox.
- **Breakpoints**: Major layout changes happen at `640px` (Mobile) and `1024px` (Desktop).
- **Navigation**: Uses a `mobile-select` dropdown for scope switching on small screens, while maintaining a tab bar for desktop.

## 2. Development Workflow (UV Based)

This project uses `uv` for dependency management and running development scripts. All commands should be prefixed with `uv run`.

### Core Development Commands
- **Dev Server**: Automates the build and watch loop.
  - `uv run aero-dev`
- **Data Generator**: Generates mock WeeWX data for testing.
  - `uv run aero-gen`
- **Report Builder**: Builds the skin report from templates.
  - `uv run aero-build`
- **Clean Artifacts**: Removes generated data and builds.
  - `uv run aero-clean`
- **Packaging**: Creates the skin installation archive.
  - `uv run aero-package`
- **Version Bumping**: Safely increments the project version.
  - `uv run aero-bump <major|minor|patch>`
- **Screenshots**: Captures high-resolution, full-page gallery images.
  - `uv run aero-screenshots [--sim]`

### Testing & Verification
- **Run Tests**: Executes the full test suite (pytest).
  - `uv run aero-test`
- **iOS Simulator**: Use the iOS Simulator for high-fidelity mobile verification.
  - Open URL: `xcrun simctl openurl booted http://localhost:8000`
  - Capture: `uv run aero-screenshots --sim`

## 3. Key Files
- `skins/Aero/index.html.tmpl`: Main Cheetah template.
- `skins/Aero/style.css`: All styling, variables, theme overrides.
- `skins/Aero/ui.js`: DOM manipulation, data binding, theme resolution.
- `skins/Aero/charts.js`: Canvas drawing logic (Gauges, Compass, Charts).
- `skins/Aero/app.js`: Application logic, data fetching, and routing.
- `skins/Aero/state.js`: Global state management.

## 4. Current Configuration (Learnings)
- **Compass Visibility**: High contrast is critical. We use Dark Slate colors in Light Mode and Lighter Slate in Dark Mode.
- **Retina Rendering**: Canvas elements must be drawn at 2x or 3x scale and downsized via CSS to maintain sharpness on modern displays.
- **Full Page Screenshots**: When capturing gallery images, `full_page=True` in Playwright is necessary to show the historical explorer and footer.

## 5. Test Plan

### 1. Navigation Scopes
- **Day**: Verify 24h charts and prev/next day navigation.
- **Week**: Verify 7-day aggregation and weekly trend charts.
- **Month**: Verify monthly stats and prev/next month navigation.
- **Year**: Verify yearly summary and prev/next year navigation.

### 2. Settings & Units
- **Presets**: Verify "Metric" and "Imperial" presets apply to all cards (Temp, Wind, Rain, Pressure).
- **Theme**: Verify Light/Dark toggle updates both CSS and Canvas colors.
- **Design**: Verify "Aero" vs "Simple" design toggle applies correctly.

### 3. Mobile Verification
- **Pull to Refresh**: Verify on touch devices.
- **Safe Areas**: Verify header/footer padding on notched devices (iPhone).
- **Touch Targets**: Ensure all buttons and toggles are at least 44x44px.
