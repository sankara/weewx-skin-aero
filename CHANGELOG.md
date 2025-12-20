# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2025-12-20
### Added
- Comprehensive code review and refactoring of backend and frontend.
- Unified test runner `aero-test` for Python and JavaScript suites.
- GitHub Actions CI integration for automated testing.
- Enhanced logging with configurable verbosity levels (`--verbose`, `--debug`).
- Parallel data fetching for weekly history views.
- JSDoc documentation for utility functions.

### Fixed
- Improved null/undefined handling in data conversions and aggregation.
- Fixed `rainRate` vs `rain_total` inconsistencies.
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
