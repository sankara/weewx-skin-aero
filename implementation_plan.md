# Aero Skin Layout & Graph Overhaul Plan (Phase 2)

## Goal
Refactor the Aero skin to separate "Current Conditions" from "Historical Exploration" and improve data visualization for historical trends.

## 1. Layout Restructure
**Objective**: Create a clear visual hierarchy.
- **Top Section ("Current")**: 
  - Fixed display of live observations (Temperature, Wind, Pressure, etc.).
  - Always visible regardless of historical browsing.
  - Sourced from `current.json` (or `today.json` latest).
- **Bottom Section ("History Explorer")**:
  - Tabbed interface or Toggle: `[Day] | [Month] | [Week] | [Year]`
  - Date Navigation: `< Prev | [Date Label] | Next >`
  - Content: Graphs and Summary Cards specific to the selected period.

## 2. Advanced Graphing Logic
**Objective**: Make historical data readable and meaningful (avoiding 1000+ point line charts for a Year).

### Data Aggregation (Client-Side)
Since we are serving static JSON files, we will aggregate data in JavaScript (`charts.js` / `utils.js`) before rendering.
- **Month View**:
  - Source: `month-YYYY-MM.json` with hourly/fractional data.
  - Process: Group data by **Day**.
  - Metric: Calculate `Min` and `Max` (and `Avg`) for each day.
- **Year View**:
  - Source: `year-YYYY.json`.
  - Process: Group data by **Month**.
  - Metric: Calculate `Min` and `Max` (and `Avg`) for each month.

### Visualization Types
- **Day View (High Resolution)**:
  - **Type**: Line Chart / Scatter (Wind).
  - **Resolution**: Hourly data points (existing behavior).
- **Month / Year View (Summary)**:
  - **Type**: **Floating Bar Chart** (aka Range Column).
  - **Representation**: A vertical bar spanning from `Min` to `Max` for that day/month.
  - **Extras**: A line overlay showing the `Average`.
  - **Wind**: Likely just Average Speed (Line) or Max Gust (Bar).
  - **Rain**: Standard Bar Chart (Sum).

## 3. Implementation Steps

### Step 3.1: Layout Code (`index.html`, `ui.js`)
- Modify `index.html` to have distinct `#current-section` and `#history-section`.
- Update `ui.js`:
  - `renderHeader()` & `renderOverview()` -> Focus on Top Section.
  - `renderHistory()` (New) -> Handles the Bottom Section logic.

### Step 3.2: Aggregation Logic (`utils.js`)
- Create generic helper: `aggregate(data, groupByFn)`.
- returns: `[{ time: timestamp, min: val, max: val, avg: val }, ...]`

### Step 3.3: Chart Updates (`charts.js`)
- Update `renderGraphs`:
  - Check `state.viewScope`.
  - If `Day`: Use existing Line chart logic.
  - If `Month` or `Year`:
    - Call aggregation helper.
    - Render `bar` chart with `data: [min, max]`.
    - Tooltip should read: "Day X: High 10° | Low 2° | Avg 6°".

## 4. Verification
- Verify Top Section remains static while browsing history.
- Verify Month view shows ~30 bars (Min/Max ranges).
- Verify Year view shows 12 bars (Min/Max ranges).
