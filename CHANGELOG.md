# Changelog

All notable changes to this project will be documented in this file.

## [2.3.3] - 2026-01-01
### Fixed
- **UI**: Improved rain chart tooltip clarity by renaming labels to "Rainfall" and "Cumulative".

## [2.3.2] - 2026-01-01
### Fixed
- **CI/CD**: Resolved UI test timeout issues in GitHub Actions by fixing report path logic and optimizing the build server.
- **Maintenance**: Merged redundant test and package workflows into a single streamlined `pipeline.yml`.

## [2.3.1] - 2026-01-01
### Fixed
- **Build & Tests**: Resolved test failures in GitHub Actions by renaming script identifiers and cleaning up redundant fixtures. Standardized test output to `build/` directory.

## [2.3.0] - 2026-01-01 (Internal)
### Features
- **Unit Persistence**: User unit preference (Metric/Imperial) is now saved to local storage and persists across reloads.
- **Cumulative Precip Graph**: Day view rain chart now displays a cumulative total line instead of rate.

### Fixes
- **Max Gust**: Fixed missing "Max Gust" value in Weekly Summary (updated aggregation, templates, and UI).
- **UI Improvements**: Standardized History Summary grid layout and fixed alignment issues.
- **Documentation**: Updated debug workflow documentation to prioritize `aero-dev`.

## [2.2.2] - 2025-12-27
### Fixed
- **Historical Wind Data**: Resolved issue where wind data was missing from Month and Year views due to outdated templates.
- **Improved History Summary**: Added Humidity and Pressure cards to historical views for a more comprehensive summary.

## [2.2.0] - 2025-12-26
## Features
- **Mobile Layout Refinement**: Optimized header with left-aligned station name and right-aligned controls.
- **Improved Information Density**: Enforced 2-column card grid on mobile viewports (iPhone Pro).
- **Aesthetic Improvements**: Enhanced glassmorphism effects (40px blur), softer shadows, and deeper dark mode background.
- **Notch Gap Fix**: Implemented `viewport-fit=cover` and safe-area padding for seamless mobile experience.
- **Developer Workflow**: Standardized `uv run` commands, added `aero-clean` script, and documented iOS Simulator verification process.
- **Mobile PWA Support**: Dynamic `theme-color` meta tag updates based on theme toggle.

## [2.1.0] - 2025-12-26
## Features
- **Homebridge Integration**: Added a new template `weatherplus.json` for seamless integration with the Homebridge WeatherPlus plugin.
- **Improved Documentation**: Added comprehensive setup instructions for Homebridge integration.

## Fixes
- **Packaging Robustness**: Fixed a critical issue in `aero-package` where the `node_modules` directory was incorrectly handled, causing build failures.
- **Enhanced Diagnostics**: Improved error handling and logging in the bundler for better troubleshooting of asset builds.

## [2.0.0] - 2025-12-20
## Features
- Major stable release marking a milestone in project maturity.
- **Refined Rain Card**: Added "Rain Last Hour" (last 60 minutes) to current conditions.
- **Unit Consistency**: Fixed unit conversion logic for rain rates and ensured all components respect user unit preferences.
- **Stable Release Tooling**: Implemented persistent "latest" download links in README using generic asset naming (`weewx-aero.zip`).
- **Automated Workflows**: Updated release process with automated changelog management and hardened report building.
- Standardized project-wide versioning and dependency management.

## Documentation
- Added comprehensive historical `CHANGELOG.md`.
- Updated README with stable installation commands and improved development instructions.
- Refined release workflow with automated changelog and asset management.

## [1.4.0] - 2025-12-20
## Features
- Complete code review and refactoring of backend and frontend for improved modularity.
- Unified test runner `aero-test` for Python and JavaScript suites.
- GitHub Actions CI integration for automated testing.
- Enhanced logging with configurable verbosity levels (`--verbose`, `--debug`).
- Parallel data fetching for weekly history views.
- JSDoc documentation for utility functions.

## Fixes
- Minor UI fixes for style and consistency.
- Fixed `rainRate` vs `rain_total` inconsistencies.
- Improved null/undefined handling in data conversions and aggregation.
- Corrected unit conversion logic for pressure in Imperial mode.
- Resolved Webpack warnings for missing exports.

## [1.3.2] - 2025-12-19
### Fixed
- Mobile layout optimizations for dials and charts.

## [1.3.1] - 2025-12-19
### Fixed
- Testing infrastructure minor fixes.

## [1.3.0] - 2025-12-19
### Added
- Templated `index.html.tmpl` for dynamic station titles.
- Screenshots for mobile dark mode.
### Changed
- Refactored bundler to process HTML templates.
- Updated README with clearer installation instructions.

## [1.2.1] - 2025-12-19
### Fixed
- Configuration naming issue in `skin.conf`.

## [1.2.0] - 2025-12-18
### Added
- Cumulative rain line graph for historical and daily views.

## [1.1.2] - 2025-12-18
### Fixed
- Alignment issues in UI cards.

## [1.1.1] - 2025-12-18
### Fixed
- Extension packaging issues.
- Initial release workflow setup.

## [1.1.0] - 2025-12-18
### Added
- Webpack asset bundling for CSS and JS.
### Fixed
- Mobile layout responsiveness fixes.

## [1.0.0] - 2025-12-15
### Added
- Initial release of Aero: A modern WeeWX skin with premium dials and wind barbs.
- High-resolution canvas-based dials.
- Real-time updating charts.
- Dark/Light theme support.
- Unit switching between Metric and Imperial.
