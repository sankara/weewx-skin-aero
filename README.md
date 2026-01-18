# Aero Skin for WeeWX

A modern, responsive skin for [WeeWX](http://weewx.com/) focused on data visualization, featuring a glassmorphism "Aero" design, high-resolution charts, and a seamless dark mode.

![Aero Dark Desktop](screenshots/desktop-dark.png)

## Gallery

| Mode | Desktop (Retina) | Mobile (iPhone) |
| :--- | :--- | :--- |
| **Dark** | ![Desktop Dark](screenshots/desktop-dark.png) | ![Mobile Dark](screenshots/mobile-dark.png) |
| **Light** | ![Desktop Light](screenshots/desktop-light.png) | ![Mobile Light](screenshots/mobile-light.png) |

## Overview

Aero renders weather data using HTML5 Canvas for sharp, detailed charts and dials. It is designed to be easy to install with no external dependencies for the end user.

## Key Features

*   **Glassmorphism Design**: A modern "Aero" aesthetic with frosted glass effects and vibrant gradients.
*   **Live Dials**: Circular indicators for Temperature, Humidity, Pressure, and UV. The temperature dial visually shows the daily high/low range.
*   **Wind Compass**: A custom-drawn compass showing speed, gusts, and direction simultaneously.
*   **Interactive Graphs**: Full-width, responsive charts for rain, wind, and other metrics using `Chart.js`.
*   **Historical Explorer**: Seamlessly navigate through past days, weeks, months, and years with client-side routing.
*   **Unit Flexibility**: Toggle between Metric and Imperial units on the fly.
*   **Simple Install**: Works as a standard WeeWX extension. No Node.js or build process required for end users.

## Installation

### Quick Install (Latest)
Install the latest stable version automatically using `weectl` (WeeWX v5+):
```bash
weectl extension install https://github.com/sankara/weewx-skin-aero/releases/latest/download/weewx-aero.zip
```

### Manual Steps
1.  Restart WeeWX:
    ```bash
    sudo systemctl restart weewx
    ```
2.  The skin will be generated at your configured HTML root (usually `/var/www/html/weewx/aero`).

## Development

This project uses [uv](https://github.com/astral-sh/uv) for Python dependency management and development workflows.

To run the skin locally for development:

1.  **Clone the repository**.
2.  **Prepare Data**:
    *   **Option A (Auto-Generate)**: Generate random test data:
        ```bash
        uv run aero-gen --output test-data/weewx.sdb --days 7
        ```
    *   **Option B (Real Data)**: Copy your own `weewx.sdb` to `test-data/weewx.sdb` for realistic testing.
3.  **Start Dev Server**:
    ```bash
    uv run aero-dev
    ```
    This will build the skin, serve it at `http://localhost:8000`, and watch for file changes to auto-rebuild.
4.  **Capture Screenshots**:
    To update the gallery screenshots (requires Playwright):
    ```bash
    uv run aero-screenshots
    ```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
