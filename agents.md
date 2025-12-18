# Aero Skin - Agent Learnings & System Architecture

This document serves as a knowledge base for the Aero Skin project, capturing key architectural decisions, component behaviors, and development workflows.

## 1. UI Architecture

### Dark Mode & Theming
- **Mechanism**: Dark mode is controlled via a class toggle (`.dark`) on the `<html>` element.
- **Trigger**: The **Moon Icon** (`<button id="theme-toggle">`) in the main header toggles this mode.
- **Implementation**:
    - **Variables**: All colors are defined as CSS variables in `:root` (e.g., `--color-text-primary`, `--card-bg`).
    - **Overrides**: Dark mode values are defined in `html.dark`.
    - **JS Integration**: `ui.js` uses `resolveThemeColor()` to read these computed styles when converting them for Canvas rendering (which requires hex strings).

### Mobile Strategy
- **Responsive Design**: Uses CSS Grid and Flexbox.
- **Breakpoints**: Major layout changes happen at `640px` (Mobile) and `1024px` (Desktop).
- **Navigation**: The header controls (Theme Icon, Unit Switch) adapt their layout via Flexbox explicitly for mobile rows.

## 2. Development Workflow

### Watch Script (`aero-watch`)
- **Purpose**: Automates the build and verification loop.
- **Function**: Watches for file changes -> Rebuilds/copies files -> Refreshes browser (via live-server or manual reload).
- **Usage**: `uv run aero-watch`

## 3. Key Files
- `skins/Aero/index.html`: Main entry point, structure.
- `skins/Aero/style.css`: All styling, variables, theme overrides.
- `skins/Aero/ui.js`: DOM manipulation, data binding, theme resolution.
- `skins/Aero/charts.js`: Canvas drawing logic (Gauges, Compass).
- `skins/Aero/state.js`: Global state management.

## 4. Current Configuration (Learnings)
- **Compass Visibility**: Users prefer high contrast. We use Dark Slate colors (Slate 400-500) in Light Mode and Lighter Slate (Slate 200-300) in Dark Mode.
- **Layout**: "Gust" text needs to be carefully positioned at the bottom of the card to avoid overlap with the compass ring.

## 5. Test Plan

This plan covers the manual verification steps for the Aero Skin.

### 1. Navigation Scopes
Verify data loading and UI response for each scope:
- **Day**:
    - Click "Day". Verify header date says today (e.g., "Wed 17 Dec").
    - Verify charts show 24h data.
    - Click `<` (Prev Day). Verify date changes and data reloads.
    - Click `>` (Next Day). Verify disabled if future.
- **Week**:
    - Click "Week". Verify header says "Current Week".
    - Verify charts show weekly trend.
    - *Note*: Prev/Next navigation is intentionally disabled for Week view (current week only).
- **Month**:
    - Click "Month". Verify header says "December 2025".
    - Click `<`. Verify it goes to "November 2025".
    - Verify charts show monthly data.
- **Year**:
    - Click "Year". Verify header says "2025".
    - Click `<`. Verify it goes to "2024".

### 2. Units Toggle
- **Metric**:
    - Toggle switch to "Metric".
    - Verify: Temp (°C), Wind (km/h), Rain (mm), Pressure (hPa).
    - Check Pressure card has valid data (or "--" if missing).
- **Imperial**:
    - Toggle switch to "Imperial".
    - Verify: Temp (°F), Wind (mph), Rain (in), Pressure (inHg).
    - Check Pressure card handles missing data gracefully ("--").

### 3. Theme Toggle
- **Light Mode**:
    - Click Moon icon.
    - Verify white card backgrounds, dark text.
    - Compass ticks should be Dark Slate.
- **Dark Mode**:
    - Click Moon icon again.
    - Verify dark blue/gray backgrounds, light text.
    - Compass ticks should be Light Slate.
