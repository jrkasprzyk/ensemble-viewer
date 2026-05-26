---
goal: Add trace classification bundle as a new label source type
version: 1.0
date_created: 2026-05-26
last_updated: 2026-05-26 (data confirmed)
owner: Joseph Kasprzyk
status: 'Implemented'
tags: [feature, data, labels]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Add support for a "trace classification bundle" — a set of files (one per classification scheme) that each map integer trace numbers to a class label (e.g. `Success` / `Failure`). The 9 files in `public/crmms-es/` are the concrete driver: each file is a different way to classify the same 400-trace dataset. The feature enables the user to ask "which traces are `Failure` in EOWY1 but `Success` in EOWY2?" by reusing the existing `labelsByColumn` filtering pipeline.

The key design insight: a classification bundle is structurally identical to a sidecar, but arrives transposed — rows are trace numbers, columns are scheme names. After parsing and pivoting, the data fits `labelsByColumn` exactly, so all downstream coloring, filtering, and summary-band logic works without modification.

## 1. Requirements & Constraints

- **REQ-001**: Parse files with CSV format `"TraceNumber","Class"` (quoted headers, integer trace numbers, string class values).
- **REQ-002**: Accept a bundle of N files (N ≥ 1). Each file = one classification scheme. N files → N label categories in `labelsByColumn`.
- **REQ-003**: Derive a human-readable scheme name from each filename by stripping the longest common prefix/suffix shared across all files in the bundle, then stripping the file extension.
- **REQ-004**: Map integer `TraceNumber` values to data column names by extracting the numeric suffix of each column name via regex (`/(\d+)$/`). TraceNumber 42 maps to the column whose suffix equals `42`.
- **REQ-005**: Columns with no matching TraceNumber entry receive no label (treated as unlabeled, consistent with existing sidecar behavior).
- **REQ-006**: Support loading classification bundles from the `examples.json` manifest so that the CRMMS-ES example dataset auto-loads its classifications.
- **REQ-007**: Support user-uploaded classification bundles via multi-file drop/select in the UI.
- **CON-001**: Do not modify `buildVisibleColumnSet`, `summarizeLabels`, `tieLabelCategories`, or any downstream consumer of `labelsByColumn` — the bundle must conform to existing shape.
- **GUD-001**: Scheme name derivation must be deterministic and produce short, readable names (e.g. `EOWY1`, `EOWY1_20pct`) not full filenames.
- **PAT-001**: Follow the `parseSidecarLabels` pattern in `src/lib/labels.js` — async function, accepts `File[]`, returns `Promise<labelsByColumn>`.

## 2. Implementation Steps

### Implementation Phase 1: Core Parser

- GOAL-001: Implement `parseClassificationBundle(files)` in `src/lib/labels.js` — accepts an array of `File` objects, returns `labelsByColumn`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `deriveSchemeNames(fileNames: string[]): string[]` to `src/lib/labels.js`. Algorithm: (1) strip file extensions, (2) find longest common prefix among all names, (3) strip it, (4) find longest common suffix among remainders, (5) strip it. If result is empty string for any file, fall back to the full basename without extension. | ✓ | 2026-05-26 |
| TASK-002 | Add `parseClassificationBundle(files: File[]): Promise<rawByTraceNum>` to `src/lib/labels.js`. For each file: parse CSV with PapaParse (`header: true, skipEmptyLines: true`), expect columns `TraceNumber` and `Class`. If either column is absent, throw `Error(\`Classification file "${file.name}" is missing column '${col}'\`)`. Build intermediate map `{ [traceNumber: string]: { [schemeName]: classValue } }`. After processing all files, return the map (keyed by string trace number — column mapping happens at integration time). | ✓ | 2026-05-26 |
| TASK-003 | Add `applyClassificationMapping(rawByTraceNum: Record<string, Record<string, string>>, columns: string[]): labelsByColumn` to `src/lib/labels.js`. For each column, extract numeric suffix via `/(\d+)$/`, look up that number in `rawByTraceNum`, assign labels. Columns with no match get no entry. | ✓ | 2026-05-26 |
| TASK-004 | Export all three new functions from `src/lib/labels.js`. | ✓ | 2026-05-26 |

### Implementation Phase 2: Examples Manifest Support

- GOAL-002: Allow `examples.json` entries to declare a classification bundle so the CRMMS-ES dataset auto-loads its 9 classification files.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Update `examples.json` schema: add optional `"classifications": string[] \| null` field alongside existing `"sidecar"`. Update the 3 existing CRMMS entries (powell-elevation, powell-evap, powell-inflow) to use corrected `/crmms-es/` paths and add `"classifications": ["/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY1.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY1_20pct.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY1_30pct.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY2.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY2_10pct.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY2_20pct.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY5.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY5_10pct.txt", "/crmms-es/SE_Oct2025_vTC_Trace_Classes_P3500_EOWY5_20pct.txt"]`. Note: path fix already applied 2026-05-26. | ✓ | 2026-05-26 |
| TASK-006 | Add `fetchClassificationBundle(paths: string[]): Promise<File[]>` to `src/lib/sampleData.js`. Fetches each path via `fetchFileAsUpload` (existing private helper) and returns array of `File` objects. | ✓ | 2026-05-26 |
| TASK-007 | Update `handleExampleChange` in `src/components/FileDropzone.jsx`: when loading an example, if `example.classifications` is present, call `fetchClassificationBundle(example.classifications)` then pass the resulting `File[]` to the `onClassifications` prop. The `onClassifications` prop (`loadClassifications` in App.jsx) handles parsing and state update via the reactive pattern (TASK-010b). | ✓ | 2026-05-26 |
| TASK-007b | Fix sidecar ordering bug in `handleExampleChange`: call `onFile(file)` before `onSidecar`/`onClassifications`. Also update `loadFile` in `App.jsx` to not overwrite `labelsByColumn` when `labelStrategy` is already `'sidecar'` or `'classifications'` — or, simpler, call sidecar/classifications after `onFile` resolves so they always win. | ✓ | 2026-05-26 |

### Implementation Phase 3: UI — File Upload

- GOAL-003: Let users select multiple classification `.txt` files to load a bundle manually.

> **Design note:** No drag target for classifications — the window-level drag handler sends `files[0]` to `loadFile`, so multi-file drops would misfire. Classifications use a browse button only (`<input type="file" multiple accept=".txt">`).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Add a multi-file browse button section to `src/components/FileDropzone.jsx` for classification bundles (no drag target). Accept multiple `.txt` files. On select, call `onClassifications(files)` prop (defined in Phase 4). Label: "Classification files (optional)" with browse button. | ✓ | 2026-05-26 |
| TASK-009 | Add a visual indicator in `FileDropzone.jsx` showing how many classification schemes are loaded (e.g. "3 schemes loaded"). Receive count via `classificationSchemeCount` prop from App.jsx (derived from `rawClassificationsByTrace`). | ✓ | 2026-05-26 |

### Implementation Phase 4: App State Integration

- GOAL-004: Wire `labelsByColumn` population from classification bundle into `App.jsx`.

> **Design note (reactive pattern):** `applyClassificationMapping` needs `columns`, which is async state — it won't be settled when `loadClassifications` is called from FileDropzone. Instead, store the raw trace-keyed map in state and derive `labelsByColumn` reactively via `useMemo`. This also fixes a pre-existing bug where sidecar labels loaded from examples are silently overwritten by `loadFile`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add `'classifications'` as a valid value of `labelStrategy` state in `App.jsx`. | ✓ | 2026-05-26 |
| TASK-010b | Add `rawClassificationsByTrace` state (`useState(null)`) in `App.jsx`. Add `useMemo` that calls `applyClassificationMapping(rawClassificationsByTrace, columns)` when both are non-empty, producing `classificationLabels`. Add `useEffect` watching `classificationLabels`: when non-null, call `setLabelsByColumn(classificationLabels)` and `setLabelStrategy('classifications')`. | ✓ | 2026-05-26 |
| TASK-011 | Add `loadClassifications(files: File[])` async function in `App.jsx`. Calls `parseClassificationBundle(files)` to get `rawByTraceNum`, then calls `setRawClassificationsByTrace(rawByTraceNum)`. No direct `columns` dependency — the reactive memo handles mapping. | ✓ | 2026-05-26 |
| TASK-012 | Ensure `loadClassifications` is passed as a prop to `FileDropzone` and called from the example loader. Note: TASK-007 reference to `src/App.jsx` is correct for the `loadClassifications` function; the FileDropzone calls `fetchClassificationBundle` then invokes the prop. | ✓ | 2026-05-26 |
| TASK-013 | Clear `rawClassificationsByTrace` (set to `null`) when a new primary data file is loaded. The reactive memo will then produce `null`, suppressing any stale label application. | ✓ | 2026-05-26 |

### Implementation Phase 5: UI — LabelControls Display

- GOAL-005: Verify that existing `LabelControls` renders classification schemes correctly and the "in A but not B" use case works via checkboxes.

> **Design note (`LabelStrategyPicker`):** No new picker option needed. When `labelStrategy === 'classifications'`, `LabelStrategyPicker` shows a read-only indicator ("Classification bundle"). Users switch away by applying a sidecar or name strategy, which overwrites `labelsByColumn` and `labelStrategy` as normal.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Manual verification: load 2+ classification files, confirm each scheme appears as a separate category in `LabelControls` with `Success`/`Failure` checkboxes. | | |
| TASK-015 | Manual verification: uncheck `Success` in scheme EOWY1 and uncheck `Failure` in scheme EOWY2 — confirm only traces that are `Failure` in EOWY1 AND `Success` in EOWY2 remain visible. | | |
| TASK-016 | Manual verification: color-by a scheme — confirm `Success` traces get one color, `Failure` another. | | |

## 3. Alternatives

- **ALT-001**: Treat each `.txt` file as a standalone sidecar (one category: `Class`) and let users load them one at a time. Rejected — loses the cross-scheme filtering use case; the user would have to reload the whole dataset to switch schemes.
- **ALT-002**: Build a dedicated "set logic" UI (explicit AND/NOT/OR operators between scheme membership). Rejected for v1 — the existing checkbox filter already implements AND across categories and Success/Failure within each, which covers the stated use case without new complexity.
- **ALT-003**: Require the user to pre-merge the 9 files into a single wide CSV (one column per scheme) before uploading, matching the sidecar format exactly. Rejected — the files come from a collaborator and shouldn't need transformation; the app should handle the format as delivered.
- **ALT-004**: Use `webkitdirectory` folder input to load an entire directory. Rejected for v1 — multi-file select is sufficient and more broadly compatible; folder input has Safari/Firefox edge cases.

## 4. Dependencies

- **DEP-001**: PapaParse — already used by `parseSidecarLabels`; no new dependency required.
- **DEP-002**: ~~The CRMMS-ES data CSV (400-trace file) — not yet available from collaborator.~~ **Resolved 2026-05-26**: `public/crmms-es/` now contains ~100 CSV files with columns `date, trace_1 … trace_400`. `res_Powell_Pool_Elevation.csv` confirmed as the flagship entry point.

## 5. Files

- **FILE-001**: `src/lib/labels.js` — add `deriveSchemeNames`, `parseClassificationBundle`, `applyClassificationMapping`.
- **FILE-002**: `src/lib/sampleData.js` — add `fetchClassificationBundle`.
- **FILE-003**: `src/App.jsx` — add `loadClassifications`, `rawClassificationsByTrace` state, reactive memo, `'classifications'` label strategy, wire to example loader.
- **FILE-004**: `src/components/FileDropzone.jsx` — add classification bundle browse UI; fix sidecar ordering bug (call `onFile` before `onClassifications`/`onSidecar`).
- **FILE-005**: `public/examples.json` — add `classifications` field to schema; update 3 existing CRMMS entries with corrected `/crmms-es/` paths and `classifications` array. Path fix already applied 2026-05-26.
- **FILE-006**: `public/crmms-es/*.txt` — existing source files; no modification needed.

## 6. Testing

- **TEST-001**: Unit test `deriveSchemeNames` with the 9 actual filenames — assert output is `['EOWY1', 'EOWY1_20pct', 'EOWY1_30pct', 'EOWY2', 'EOWY2_10pct', 'EOWY2_20pct', 'EOWY5', 'EOWY5_10pct', 'EOWY5_20pct']`.
- **TEST-002**: Unit test `parseClassificationBundle` with 2 mock `File` objects — assert output shape `{ "1": { schemeA: "Success", schemeB: "Failure" }, ... }`.
- **TEST-002b**: Unit test `parseClassificationBundle` error case — mock `File` missing `TraceNumber` column — assert throws with message containing the filename and column name.
- **TEST-003**: Unit test `applyClassificationMapping` with columns `['trace_1', 'trace_2', 'trace_99']` and mock `rawByTraceNum` — assert correct column mapping and that columns with no match are absent from output.
- **TEST-004**: Unit test `applyClassificationMapping` edge case: column name with no numeric suffix (e.g. `"date"`) — assert it is silently skipped.
- **TEST-005**: Manual regression — load the `sample-ensemble-anon` example; confirm sidecar labels are applied (not overwritten by `loadFile`). This verifies the sidecar ordering bug fix — previously sidecar labels were silently lost because `onSidecar` was called before `onFile`.

## 7. Risks & Assumptions

- **~~RISK-001~~**: ~~The CRMMS-ES data CSV column naming convention is unknown until received.~~ **Resolved 2026-05-26**: All `public/crmms-es/*.csv` files use `trace_1` … `trace_400` column naming. Regex `/(\d+)$/` approach confirmed correct. No mitigation needed.
- **RISK-002**: `TraceNumber` values in the `.txt` files may not be contiguous or 1-based. `applyClassificationMapping` handles this gracefully (hash lookup, not array index), so sparse or offset numbering works without code changes.
- **ASSUMPTION-001**: All 9 classification files in a bundle cover the same set of trace numbers (1–400, confirmed contiguous and 1-based). If a trace number appears in some files but not others, the missing schemes will have no label for that trace — this is acceptable and consistent with how sidecar handles missing rows.
- **ASSUMPTION-002**: Class values are always `"Success"` or `"Failure"` (as observed in the 9 existing files). The parser makes no assumptions about valid class values — any string is accepted — but tests and UI copy reference these two values.

## 8. Related Specifications / Further Reading

- [Completed: feature-examples-manifest-1.md](completed/feature-examples-manifest-1.md) — how `examples.json` is structured and loaded.
- [Completed: feature-label-sorting-filtering-1.md](completed/feature-label-sorting-filtering-1.md) — the `labelsByColumn` pipeline this feature plugs into.
