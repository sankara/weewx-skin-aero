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

1.  Download the latest release:
    ```bash
    wget https://github.com/sankara/weewx-skin-aero/releases/download/v1.2.1/weewx-aero-v1.2.1.zip
    ```
2.  Install using the standard WeeWX extension utility:
    ```bash
    weectl extension install weewx-aero-v1.2.1.zip
    ```
3.  Restart WeeWX:
    ```bash
    sudo systemctl restart weewx
    ```
4.  The skin will be generated at your configured HTML root (usually `/var/www/html/weewx/aero`).

## Development

To run the skin locally for development:

1.  Clone the repository.
2.  Run the mock server (requires Python 3):
    ```bash
    python3 -m http.server 8000
    ```
3.  Open `http://localhost:8000` in your browser.
4.  The `data/` folder contains sample WeeWX JSON data for testing.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
