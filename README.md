# Aero Skin for WeeWX

A modern, responsive skin for [WeeWX](http://weewx.com/) focused on data visualization.

![Aero Skin Screenshot](screenshots/desktop-dark.png)

## Overview

Aero renders weather data using HTML5 Canvas for sharp, detailed charts and dials. It is designed to be easy to install with no external dependencies.

## Key Features

*   **Live Dials**: Circular indicators for Temperature, Humidity, Pressure, and UV. The temperature dial visually shows the daily high/low range.
*   **Wind Charts**: Uses standard wind barbs to show speed and direction simultaneously.
*   **Interactive Graphs**: Full-width charts for rain, wind, and other metrics using `Chart.js`.
*   **Historical Data**: Navigate through past days, weeks, and months.
*   **Simple Install**: Works as a standard WeeWX extension. No node.js or build process required for end users.

## Installation

## Installation

1.  Install using the standard WeeWX extension utility:
    ```bash
    weectl extension install https://github.com/sankara/weewx-skin-aero/releases/download/v1.3.2/weewx-aero-v1.3.2.zip
    ```
2.  Restart WeeWX:
    ```bash
    sudo systemctl restart weewx
    ```
3.  The skin will be generated at your configured HTML root (usually `/var/www/html/weewx/aero`).

## Development

To run the skin locally for development:

1.  Clone the repository.
2.  **Prepare Data**:
    *   **Option A (Auto-Generate)**: Generate random test data:
        ```bash
        uv run aero-gen --output test-data/weewx.sdb --days 7
        ```
    *   **Option B (Real Data)**: Copy your own `weewx.sdb` to `test-data/weewx.sdb` for realistic testing.
3.  **Start Watch Server**:
    ```bash
    uv run aero-watch
    ```
    This will:
    *   Build the skin using the data in `test-data/weewx.sdb`.
    *   Serve it at `http://localhost:8000`.
    *   Watch for file changes and auto-rebuild.
4.  Open `http://localhost:8000` in your browser.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
