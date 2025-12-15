# Aero Skin for WeeWX

**Aero** is a premium, modern, and high-performance skin for [WeeWX](http://weewx.com/), designed to visualize your weather data with stunning aesthetics and clarity.

## Screenshots

| Overview | Month View | Year View |
| :---: | :---: | :---: |
| ![Overview](overview.png) | ![Month View](month_view.png) | ![Year View](year_view.png) |

## Features

*   **Premium Dials**: Canvas-rendered circular dials for Temperature, Humidity, Pressure, and UV.
    *   **Dynamic Gradient**: Temperature dial features a beautiful Blue-to-Red gradient arc representing the daily low/high range.
*   **Current & History Split**: Clear separation between "Current Conditions" (live data) and "History Explorer" (navigable graphs).
*   **Advanced Graphing**:
    *   **Day View**: High-resolution line and scatter charts.
    *   **Month/Year View**: Aggregated "Range Column" charts showing Min/Max spreads and Average lines.
    *   **Wind Barb Chart**: Standard meteorological wind barbs (knots) showing speed and direction.
*   **Archive Navigation**: Built-in support for navigating historical data (Day, Week, Month, Year).
*   **Responsive Design**: Mobile-friendly layout.

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
    python3 dev/debug_server.py
    ```
3.  Open `http://localhost:8080/index.html` in your browser.
4.  The `dev/test-data/` folder contains sample WeeWX JSON data for testing.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
