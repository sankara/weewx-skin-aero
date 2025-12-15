# Aero Skin for WeeWX

**Aero** is a premium, modern, and high-performance skin for [WeeWX](http://weewx.com/), designed to visualize your weather data with stunning aesthetics and clarity.

![Aero Skin Screenshot](https://raw.githubusercontent.com/placeholder/screenshot.png) 
*(Note: Replace with actual screenshot link after hosting)*

## Features

*   **Premium Dials**: Canvas-rendered circular dials for Temperature, Humidity, Pressure, and UV.
    *   **Dynamic Gradient**: Temperature dial features a beautiful Blue-to-Red gradient arc representing the daily low/high range.
    *   **Context Aware**: Dials display "Current" values for today and "Average" values for historical days.
*   **Advanced Wind Visualization**:
    *   **Wind Barb Chart**: Standard meteorological wind barbs (knots) showing speed and direction.
    *   **Smart Tooltips**: Hover to see speed and cardinal direction (e.g., "15 mph (NNE)").
*   **Robust Graphing**:
    *   **Precipitation Bar Chart**: dedicated visualization for rain data.
    *   **Consistent Scaling**: All graphs look back 24 hours (12 AM to 12 AM) for perfect daily comparisons.
    *   **Responsive**: Full-width implementation using `Chart.js`.
*   **Archive Navigation**: Built-in support for navigating historical data (Previous/Next day).
*   **Zero Dependencies**: No complex build steps required for the user; just install and run.

## Installation

1.  Download the latest release (`weewx-aero-x.x.x.zip`) from the [Releases](latest) page.
2.  Install using the standard WeeWX extension utility:
    ```bash
    weectl extension install weewx-aero-x.x.x.zip
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
