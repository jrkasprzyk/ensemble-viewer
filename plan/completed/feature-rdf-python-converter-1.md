---
goal: Python CLI scripts to read RiverWare RDF files and convert to ensemble-viewer CSV format
version: 1.0
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Joseph Kasprzyk
status: 'Planned'
tags: [feature, data, cli, python]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Add a `scripts/` folder containing Python utilities to parse RiverWare `.rdf` files (multi-trace ensemble output) and export any selected slot as a CSV compatible with ensemble-viewer. A CLI provides `info` (list slots/metadata) and `convert` (export one slot to CSV) sub-commands.

## 1. Requirements & Constraints

- **REQ-001**: Parse all sections of the RDF text format: package preamble, run preamble, timestep list, slot preamble, scalar and series slot values, `END_COLUMN` / `END_SLOT` / `END_RUN` markers.
- **REQ-002**: Support both daily and other `time_step_unit` values in timestamps (RDF uses `YYYY-M-D 24:00` notation — treat 24:00 as end-of-day, normalize to `YYYY-MM-DD`).
- **REQ-003**: `info` command prints: package metadata, number of runs/traces, list of `object_name.slot_name` identifiers with units and slot_type.
- **REQ-004**: `convert` command accepts `--slot "ObjectName.SlotName"` and `--output <path>`. Exports a CSV where rows = timesteps, columns = trace numbers (header = trace ID from run preamble).
- **REQ-005**: Output CSV must be compatible with ensemble-viewer wide format: first column `date` (ISO 8601), subsequent columns named by trace (e.g. `trace_1`, `trace_2`, …).
- **REQ-006**: Handle scalar slots (1 value per run, not per timestep) gracefully — emit a warning and skip or broadcast the value.
- **REQ-007**: Pure Python stdlib + `csv` module only; no pandas/numpy required (keep install footprint minimal). Optional `--format stacked` may use no extra deps either.
- **CON-001**: Python 3.9+ only.
- **CON-002**: Scripts live in `scripts/` at repo root; no package install required — runnable as `python scripts/rdf_info.py` or via a thin entry-point wrapper.
- **GUD-001**: Follow existing repo code style (ESLint/prettier applies to JS only; Python uses PEP 8).
- **PAT-001**: Mirror the R parser logic from `private/read_rdf.R`: preamble → timesteps → repeated slot blocks terminated by `END_COLUMN`/`END_SLOT`/`END_RUN`.

## 2. Implementation Steps

### Implementation Phase 1 — RDF parser core

- GOAL-001: Implement a standalone Python module that can fully parse an `.rdf` file into an in-memory data structure mirroring the R `rdf` object: `meta` dict, list of `runs` each containing `preamble`, `times` list, and `objects` dict keyed by `object_name.slot_name`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `scripts/rdf_parser.py`. Implement `parse_rdf(path: str) -> dict` that reads the file line-by-line into a list, then calls sub-parsers. | | |
| TASK-002 | Implement `_parse_preamble(lines, pos, end_marker) -> (dict, pos)`: reads `key: value` lines until `end_marker`, returns dict and new position. Handles missing value (sets `None`). | | |
| TASK-003 | Implement `_parse_run(lines, pos, meta) -> (dict, pos)`: calls `_parse_preamble(..., 'END_RUN_PREAMBLE')`, reads `time_steps` timestep lines, then loops over slots until `END_RUN`. | | |
| TASK-004 | Implement `_parse_slot(lines, pos, nts) -> (dict, pos)`: calls `_parse_preamble(..., 'END_SLOT_PREAMBLE')`, reads `units` line, `scale` line, then values (either `nts` lines or 1 line for scalar slots), advances past `END_COLUMN` + `END_SLOT`. | | |
| TASK-005 | Normalize RDF timestamps: convert `YYYY-M-D 24:00` → `YYYY-MM-DD` using `datetime` stdlib. Store as ISO strings in `run['times']`. | | |
| TASK-006 | Unit test `scripts/test_rdf_parser.py`: parse `public/rw-sample-data/sample_traces.rdf` (3 runs, 5 slots) and `public/rw-sample-data/sample_subset.rdf` (2 runs). Assert correct run counts, slot names, value counts, and sample numeric values. | | |

### Implementation Phase 2 — CLI: `info` command

- GOAL-002: Implement `scripts/rdf_info.py` (or a sub-command in a unified `scripts/rdf.py`) that prints human-readable summary of an RDF file without writing any files.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Add `argparse` CLI entry point in `scripts/rdf.py` with sub-commands `info` and `convert`. | | |
| TASK-008 | Implement `info` sub-command: print package metadata (name, owner, create_date, number_of_runs), then a table of slots found in trace 1: `object_name`, `slot_name`, `slot_type`, `units`, `scale`. | | |
| TASK-009 | Print run date range (start/end from first and last run preamble) and time_step_unit. | | |

### Implementation Phase 3 — CLI: `convert` command

- GOAL-003: Export a single named slot across all traces to a CSV compatible with ensemble-viewer wide format.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Implement `convert` sub-command: required args `--slot "ObjectName.SlotName"` and `--output <path>`. | | |
| TASK-011 | Build wide-format CSV: column 0 = `date` (ISO 8601 from trace 1 timesteps), columns 1..N = `trace_<id>` for each run, using run preamble `trace` value as the column label. | | |
| TASK-012 | Add optional `--format stacked` flag: output long-format CSV with columns `date`, `trace`, `value` instead of wide. | | |
| TASK-013 | Add `--list-slots` flag as shortcut alias for `info` (convenience). | | |
| TASK-014 | Validate that all traces have identical timestep lists; warn (do not abort) if mismatched. | | |

### Implementation Phase 4 — Docs and packaging

- GOAL-004: Make scripts discoverable and usable without reading source.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Add `scripts/README.md` documenting: installation (none needed), usage examples for `info` and `convert`, CSV output format description, and known limitations (scalar slots, 24:00 time notation). | | |
| TASK-016 | Add `scripts/requirements.txt` listing Python version constraint only (stdlib-only; file is informational). | | |

## 3. Alternatives

- **ALT-001**: Use `pandas` for CSV output — rejected to keep zero-dependency footprint; stdlib `csv` is sufficient.
- **ALT-002**: Single script (no sub-commands) with positional args — rejected; sub-commands (`info` / `convert`) are cleaner UX and easier to extend.
- **ALT-003**: Port the R code 1:1 using `rpy2` — rejected; adds a heavy R dependency that defeats the purpose of a Python rewrite.
- **ALT-004**: Use `pathlib` + regex instead of line-by-line parsing — rejected; the R parser is explicitly positional (line index arithmetic), so a direct port is safer and easier to validate.

## 4. Dependencies

- **DEP-001**: Python 3.9+ (stdlib only: `csv`, `argparse`, `datetime`, `pathlib`).
- **DEP-002**: Synthetic sample RDF files in `public/rw-sample-data/` used by tests.

## 5. Files

- **FILE-001**: `scripts/rdf.py` — unified CLI entry point (`python scripts/rdf.py info|convert ...`).
- **FILE-002**: `scripts/rdf_parser.py` — pure-Python RDF parser; importable module.
- **FILE-003**: `scripts/test_rdf_parser.py` — unit/integration tests using the two sample RDF files.
- **FILE-004**: `scripts/README.md` — usage documentation.
- **FILE-005**: `scripts/requirements.txt` — Python version constraint.

## 6. Testing

- **TEST-001**: Parse `public/rw-sample-data/sample_traces.rdf`: assert `meta['number_of_runs'] == '3'`, 3 runs, each with 5 slot keys, each time-series slot has 5 values.
- **TEST-002**: Parse `public/rw-sample-data/sample_subset.rdf`: assert 2 runs, 4 timesteps each.
- **TEST-003**: `info` command stdout contains slot name `Example Reservoir.Pool Elevation` and unit `feet`.
- **TEST-004**: `convert --slot "Example Reservoir.Pool Elevation"` produces wide CSV with 6 rows (header + 5 data) and 4 columns (date + 3 traces).
- **TEST-005**: `convert --format stacked` produces long CSV with `date`, `trace`, `value` columns and 3×5 = 15 data rows.
- **TEST-006**: Timestamp normalization: `2024-1-1 24:00` → `2024-01-01` in output CSV.

## 7. Risks & Assumptions

- **RISK-001**: RDF files from other RiverWare models may have different slot types (table slots, periodic slots) not covered by the two sample files. The parser should log a warning and skip unsupported slot types rather than crashing.
- **RISK-002**: The `24:00` timestamp convention (end of day) may be ambiguous for other time_step_units (monthly, etc.). Currently assume daily only; document limitation.
- **ASSUMPTION-001**: All traces in a single RDF file contain the same set of slots in the same order (consistent with how RiverWare generates RDF output).
- **ASSUMPTION-002**: The `trace` key in run preamble is always present (both sample files confirm this). Fall back to sequential integer if absent.
- **ASSUMPTION-003**: ensemble-viewer expects ISO 8601 date strings in the first column, matching the format used in `dist/sample-data/ensemble.csv`.

## 8. Related Specifications / Further Reading

- `private/read_rdf.R` — R reference implementation (line-by-line positional parser)
- `dist/sample-data/ensemble.csv` — target wide-format CSV example
- `dist/sample-data/ensemble_stacked.csv` — target stacked-format CSV example
- [RiverWare RDF documentation](https://riverware.org/HelpSystem/CurrentVersion/index.html)
