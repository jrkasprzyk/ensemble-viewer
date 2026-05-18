---
goal: Fix multi-label handling in RDF-to-CSV export scripts and add stacked-header wide format
version: 1.0
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Joseph Kasprzyk
status: 'Planned'
tags: [feature, bug, data, cli, python]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Two bugs / gaps exist in `scripts/rdf.py` regarding multi-label ensemble output:

1. **Label bug**: Scalar slots (per-trace metadata like scenario, GCM, run ID) are not flowing through to output correctly. Instead of each trace carrying its own distinct label values, the same constant value appears across all output rows — scalar slot values are being treated as a timeseries repeated over timesteps rather than as per-trace metadata.

2. **Missing format**: `--format stacked` currently emits long format (`date, trace, value`). But `public/sample-data/ensemble_stacked.csv` shows a **wide format with multi-row label headers** stacked at the top — one header row per label dimension, followed by the data header (`year/date`), then data rows. This format does not exist in the scripts.

**Target output formats** (defined by sample CSVs in `public/sample-data/`):

| Format | Sample file(s) | Description |
|--------|----------------|-------------|
| Wide + sidecar | `ensemble_anon.csv` + `ensemble_anon_labels.csv` | Wide data CSV; separate sidecar CSV maps column→label values |
| Stacked-header wide | `ensemble_stacked.csv` | Wide data CSV but with N label header rows above the data header |

## 1. Requirements & Constraints

- **REQ-001**: `--format wide` (default) → wide CSV + `_labels.csv` sidecar. Sidecar format must match `ensemble_anon_labels.csv`: first column = `column` (trace/series ID), subsequent columns = one per label dimension. Each row = one trace.
- **REQ-002**: `--format stacked` → single wide CSV whose structure is exactly:
  ```
  <label_dim_1>,<val_col1>,<val_col2>,...   ← one row per label dimension (scalar slot)
  <label_dim_2>,<val_col1>,<val_col2>,...
  ...
  <date_col>,<series_col1>,<series_col2>,...  ← data header row (column IDs)
  <date_val>,<data_val1>,<data_val2>,...      ← data rows
  ```
  The first cell of each label row = scalar slot name (label dimension). Remaining cells = that slot's value for each trace, in trace order. The data header row follows immediately after the last label row. There is no blank line separator. This matches `public/sample-data/ensemble_stacked.csv` exactly.
- **REQ-003**: Label source = scalar slots in RDF (one value per run). Each scalar slot becomes one label dimension. Each run's scalar slot value = that trace's label value for that dimension.
- **REQ-004**: Label values must vary per trace (each run's scalar slot parsed independently). A single constant value across all traces indicates a parser or output bug.
- **REQ-005**: Scalar slots are required for `--format stacked` to produce label rows. If no scalar slots exist, `--format stacked` must exit with a clear error message; it is not a supported use case to emit a stacked CSV with zero label rows. For `--format wide`, no scalar slots → no sidecar file is written (wide data CSV only, no error).
- **REQ-006**: Column IDs in data CSV header match the `column` values in the sidecar (wide format) and the column positions in the label rows (stacked format). All three must use the same identifier string per trace.
- **CON-001**: Python 3.9+ stdlib only; no third-party packages.
- **CON-002**: `--format stacked` (currently long format) will be renamed `--format long`. `--format stacked` will be redefined as the multi-label-header wide format. No aliases or backwards compat shims — pick the right name and use it.
- **GUD-001**: Tests use `public/rw-sample-data/` sample RDF files, not synthetic in-memory data.

## 2. Implementation Steps

### Phase 1 — Diagnose the label bug

- GOAL-001: Identify the exact code path that causes scalar slot values to appear as a repeated constant rather than per-trace label values. Confirm whether the bug is in the parser (`rdf_parser.py`) or the output writers (`rdf.py`).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Run `python scripts/rdf.py convert public/rw-sample-data/sample_traces.rdf --slot "Example Reservoir.Pool Elevation" --output /tmp/out.csv --format wide` and inspect the generated `_labels.csv`. Verify whether `Run Management.Trace Historical Year` values differ across rows (1988, 1990, 1992) or are all the same. | | |
| TASK-002 | In `rdf_parser.py::_parse_slot`, add a debug print of `n_values`, `nts`, and the raw value lines for scalar slots. Confirm `n_values == 1` is reached for scalar slots and that `slot["values"]` is set to a single-element list with the correct per-run value. | | |
| TASK-003 | In `rdf.py::_write_sidecar`, trace whether `run["slots"][sk]["values"][0]` yields different values for each run. If all runs return the same value, the bug is in `_parse_run` sharing state across runs (e.g., mutable default argument or slot dict reuse). | | |
| TASK-004 | Document the root cause as a comment in the plan under this task before proceeding to fix. | | |

### Phase 2 — Fix the label bug

- GOAL-002: Ensure each run's scalar slots hold their own per-run values, so label output varies correctly across traces.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Fix the identified root cause in `rdf_parser.py` or `rdf.py`. Likely candidates: (a) slot dict mutated in place across runs; (b) `slot["values"]` reference shared; (c) `_parse_slot` reading the wrong line offset due to units/scale line count assumption. | | |
| TASK-006 | Add test `TestCLIConvert::test_sidecar_label_values_vary_per_trace` in `test_rdf_parser.py`: parse `sample_traces.rdf`, run `convert --format wide`, open `_labels.csv`, assert that the `Trace Historical Year` column contains three distinct values (`1988.0`, `1990.0`, `1992.0`) one per trace row. | | |

### Phase 3 — Add stacked-header wide format

- GOAL-003: Implement `--format stacked` as wide-with-label-header-rows output matching `ensemble_stacked.csv` structure. Rename current long-format output to `--format long` to avoid collision.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Rename existing `_write_stacked` → `_write_long`; update `--format` choices in argparse: `long` replaces old `stacked`, `stacked` is the new multi-label-header wide format. Update help text. No aliases. | | |
| TASK-008 | Implement `_write_stacked_header(runs, slot_key, ref_times, out_path)` in `rdf.py`: (1) detect scalar slots for label dimensions; (2) write one row per scalar slot: `[slot_label_name, val_run1, val_run2, ...]`; (3) write data header row: `[date_col_name, trace_id_run1, trace_id_run2, ...]`; (4) write data rows. Column names in the data header must match the label row cell positions. | | |
| TASK-009 | Determine `date_col_name`: use `"year"` if time values look like annual data (all dates end in `-01-01`), otherwise `"date"`. This matches ensemble_stacked.csv which uses `year`. | | |
| TASK-010 | Add test `TestCLIConvert::test_stacked_header_format` in `test_rdf_parser.py`: run `convert --format stacked` on `sample_traces.rdf`; assert row 1 starts with `"Trace Historical Year"` and has 4 cells (label name + 3 trace values); assert row 4 (data header) starts with `"date"` or `"year"` followed by 3 trace IDs; assert row 5+ are data rows. | | |

### Phase 4 — Ensure sidecar column name alignment

- GOAL-004: Guarantee that column IDs in the data CSV and the sidecar CSV use the same naming convention, mirroring `ensemble_anon.csv` + `ensemble_anon_labels.csv`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | In `_write_wide`, column names default to `trace_<id>`. Verify `_write_sidecar` uses the exact same column name strings (call the same `_trace_id(run)` function). Confirm no divergence in naming. | | |
| TASK-012 | Add test `TestCLIConvert::test_wide_sidecar_column_alignment` in `test_rdf_parser.py`: open both wide CSV and sidecar CSV; assert every value in sidecar `column` column appears as a header in the wide CSV; assert count matches. | | |

### Phase 5 — Add sample RDF fixtures for label testing

- GOAL-005: Ensure `public/rw-sample-data/` contains at least one RDF file with multiple distinct scalar-slot label values across traces, so tests are data-driven rather than relying solely on the existing `sample_traces.rdf`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Verify `public/rw-sample-data/sample_traces.rdf` already has two scalar slots (`Run Management.Trace Historical Year`, `Run Management.Historical Year Percent of Average`) with values that differ across all 3 runs. If confirmed, no new RDF file needed — use it as the fixture. | | |
| TASK-014 | If values do NOT differ across runs in the existing file (indicating the bug is in the source fixture, not code), create `public/rw-sample-data/sample_traces_labeled.rdf` — a 3-run, 5-timestep file with 1 series slot and 2 scalar slots that have distinct values per run (`1988/wet`, `1990/average`, `1992/dry`). | | |

### Phase 6 — Update documentation

- GOAL-006: `scripts/README.md` accurately describes all output formats including renamed/new ones.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Update `scripts/README.md` to document: `--format wide` (default, wide + sidecar), `--format stacked` (multi-header wide), `--format long` (long/stacked rows), `--format enriched` (long with label columns). Add example output structure for each. | | |

## 3. Alternatives

- **ALT-001**: Keep `--format stacked` as long format, add `--format stacked-wide` for the multi-header format — rejected; confusing naming, and ensemble-viewer calls the multi-header format "stacked" in its sample data filename.
- **ALT-002**: Auto-detect format from content and drop explicit `--format` flag — rejected; ambiguous, breaks scripting reproducibility.
- **ALT-003**: Embed label logic in the parser and return a unified labeled data structure — rejected; adds complexity to the parser module which should stay focused on RDF parsing only.

## 4. Dependencies

- **DEP-001**: `public/rw-sample-data/sample_traces.rdf` — existing fixture with scalar slots (labels) per run.
- **DEP-002**: `public/sample-data/ensemble_anon.csv`, `ensemble_anon_labels.csv`, `ensemble_stacked.csv` — reference format specs (read-only, not modified).

## 5. Files

- **FILE-001**: `scripts/rdf_parser.py` — may need fix for scalar slot value isolation across runs.
- **FILE-002**: `scripts/rdf.py` — add `_write_stacked_header`, rename `_write_stacked` → `_write_long`, fix `_write_sidecar` if bug is here.
- **FILE-003**: `scripts/test_rdf_parser.py` — add TASK-006, TASK-010, TASK-012 tests.
- **FILE-004**: `scripts/README.md` — update format descriptions.
- **FILE-005**: `public/rw-sample-data/sample_traces_labeled.rdf` — new fixture only if TASK-013 finds the existing fixture insufficient.

## 6. Testing

- **TEST-001**: `test_sidecar_label_values_vary_per_trace` — sidecar contains 3 distinct `Trace Historical Year` values (1988.0, 1990.0, 1992.0), one per trace row.
- **TEST-002**: `test_stacked_header_format` — `--format stacked` output: row 1 cell[0] == scalar slot label name; row N+1 cell[0] == `"date"` or `"year"`; total rows == N_label_dims + 1 + N_timesteps.
- **TEST-003**: `test_wide_sidecar_column_alignment` — sidecar `column` values exactly match data CSV column headers (excluding `date` column).
- **TEST-004**: `test_long_format_still_works` — `--format long` produces same output as old `--format stacked` (regression guard after rename).
- **TEST-005**: Existing enriched-format test (`test_enriched_csv_dimensions`) must still pass after refactor.

## 7. Risks & Assumptions

- **RISK-001**: `--format stacked` meaning changes (long format → multi-label-header wide). This project has no existing users; no backwards compat shims or aliases needed. Just rename cleanly.
- **RISK-002**: If the scalar-slot bug is in the parser and affects real RDF files differently than sample files, the fix may need more extensive testing against real RiverWare output.
- **ASSUMPTION-001**: `ensemble_stacked.csv` is the authoritative reference for the stacked-header wide format; column ordering, label row order, and date column naming follow that file exactly.
- **ASSUMPTION-002**: Label dimension names in the stacked-header output come from scalar slot names (the `slot_name` portion after the dot), matching the behavior of `_write_sidecar` and `_write_enriched`.
- **ASSUMPTION-003**: TASK-001 can be executed by running the existing code before any fixes are made, to confirm the bug is reproducible.

## 8. Related Specifications / Further Reading

- `public/sample-data/ensemble_anon.csv` — wide data format reference
- `public/sample-data/ensemble_anon_labels.csv` — sidecar label format reference
- `public/sample-data/ensemble_stacked.csv` — stacked-header wide format reference
- `plan/completed/feature-rdf-python-converter-1.md` — original converter plan
- `scripts/rdf_parser.py` — RDF parser
- `scripts/rdf.py` — CLI and output writers
