# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Added
- Classification coloring now shows Success/Failure color swatches in the control panel (#24)
- On-figure color legend for any `colorBy` mode — exports with SVG/PNG; toggle via Display → "Show color legend on the figure" (#24)

### Fixed

## [0.2.0] — 2026-06-03

### Added
- **In-browser RDF support** — load RiverWare `.rdf` files directly; multi-slot parsing with auto label fallback, and multi-label RDF export
- **Filter/coloring persistence across RDF slots** — trace filters and color grouping survive switching between slots
- **Trace classification** — bundled and individual classification UI (e.g. horizon-based Failure/Success grouping)
- **Config save/load** — export and re-import the full view configuration (filters, coloring, omitted categories, axis bounds)
- **User-defined axis bounds** — datetime-aware x-axis bounds plus a reorganized plotting/customization sidebar
- **Line style controls** — adjustable width/opacity and tied numeric color parsing for denser, more legible ensembles
- **Plot download format picker** — choose the export image format
- **Label sorting/filtering** and an examples manifest with bundled sample datasets
- `LICENSE` — MIT license
- `README.md` — project overview, quick-start guide, data format reference, command table, and tech stack summary
- `CONTRIBUTING.md` — local setup, test instructions, project structure guide, PR workflow, JS gotchas for Python/R contributors, and license agreement note
- Vitest test infrastructure (`package.json` scripts: `test`, `test:watch`; `vite.config.js` `test` block)
- `src/lib/stats.test.js` — 8 tests for `computeGroupStats`: mean, median, percentiles, NaN propagation, empty-column edge cases
- `src/lib/labels.test.js` — 19 tests for `parseLabelsFromNames`, `summarizeLabels`, `detectIndexType`, `parseSidecarLabels`
- `src/lib/palette.test.js` — 7 tests for `OKABE_ITO`, `NEUTRAL_GRAY`, `buildColorMap` (ordering, wrap-around, empty input)
- `src/lib/parseCsv.test.js` — 11 tests covering happy path, type coercion, stacked label rows (1 and 2), and 4 error cases
- Explanatory comments in all `src/lib/*.js` files for non-JavaScript maintainers (data shape examples, math notes, JS-specific gotcha callouts)
- `ORDERING CONSTRAINT` comment in `EnsemblePlot.jsx` documenting the trace-insertion order required by Plotly's `fill: 'tonexty'`

### Fixed
- **`parseCsv.js` / `parseXlsx.js`**: vacuous-truth bug — `[].every(n => n === 0)` returns `true` in JS, causing a misleading "no numeric data" error when the file had *zero* data columns. Fix: explicit `columns.length === 0` guard with a clear error message fires first.
- **`App.jsx` — stale `colorBy` after file load**: loading a new file did not reset `colorBy`. If the new file lacked the previously selected category, the plot silently fell back to neutral gray with no feedback. Fix: `setColorBy(null)` after parsing each new file.
- **`App.jsx` — error banner persists after successful sidecar load**: `setError(null)` was never called at the start of `loadSidecar`, so a previous error message stayed visible even after a successful label file load. Fix: `setError(null)` added as the first statement in `loadSidecar`.
- **`labels.js` — `parseSidecarLabels` no-categories case**: function had no explicit early return when the sidecar CSV contained zero category columns; control fell through implicitly. Fix: explicit `if (!categoryKeys.length) return {}` with comment.
- **Filters** — reset split/sort/tie and force a fresh filter seed on fresh file load; keep coloring on slot switch when classifications are active.
- **Config load** — reset omitted categories when a config is loaded.
- **RDF** — error clearly on a malformed slot in `rdfToDataset`; fix auto-label fallback.
- **Classification** — unify Failure/Success colors and reset `colorBy` on deselect-all.
- **Plot bounds** — validate axis bounds, block inverted ranges, keep range inputs editable during backspace.
- **Examples** — fix local file reload after selecting an example dataset.

## [0.1.0] — 2026-04-22

### Added
- Initial release: browser-based ensemble timeseries viewer
- Drop-zone accepts wide CSV and XLSX files
- Stacked header rows encode label metadata per column
- Sidecar label CSV support
- Plotly.js WebGL (`scattergl`) rendering for large ensembles
- Okabe-Ito colorblind-safe palette
- Label-based filtering and color grouping
- Sample dataset loader
- Percentile band overlay (10th–90th with mean/median)

[Unreleased]: https://github.com/jrkasprzyk/ensemble-viewer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jrkasprzyk/ensemble-viewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jrkasprzyk/ensemble-viewer/releases/tag/v0.1.0
