---
goal: Add curated examples manifest so public/ datasets are accessible from the UI
version: 1.0
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Joseph Kasprzyk
status: 'Planned'
tags: [feature, ux, data]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Replace the single "Load sample" button with an "Examples" dropdown populated from a curated `public/examples.json` manifest. Pattern mirrors ArborView (`public/data/manifest.json` + `fetchJson` + `<select>`). A curated subset of data from the three dataset groups in `public/` become accessible without a local file browse.

## 1. Requirements & Constraints

- **REQ-001**: Selected datasets in `public/` must be reachable from the UI without a local file browse.
- **REQ-002**: Manifest must support an optional sidecar labels file per entry (existing feature parity).
- **REQ-004**: Existing "Browse" (local file) and drag-and-drop flows must remain unchanged.
- **REQ-005**: The RDF files themselves should be ignored; this focuses on only CSVs.
- **GUD-001**: Pattern mirrors ArborView `public/data/manifest.json` → `fetchJson` → `<select>` flow.
- **GUD-002**: Display names and descriptions are human-authored in the manifest (not auto-derived from filenames).
- **CON-001**: No build-time manifest generation — manifest is hand-maintained. Acceptable because sample datasets change infrequently.

## 2. Implementation Steps

### Implementation Phase 1 — Manifest file

- GOAL-001: Create `public/examples.json` with a curated set of ≤5 CSV entries, prioritizing Powell and Mead CRMMS datasets.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `public/examples.json` with curated CSV entries (see table below) | | |
| TASK-002 | Verify each `entry` path resolves via `fetch()` in dev (`npm run dev`) | | |

**Manifest schema:**
```json
[
  {
    "id": "string",
    "label": "Human-readable name shown in dropdown",
    "description": "One-line description shown as tooltip or subtitle",
    "entry": "/relative/path/to/entry-file.csv",
    "sidecar": "/relative/path/to/labels.csv or null"
  }
]
```

**Initial entries (≤5, Powell/Mead prioritized):**
| id | label | entry | sidecar |
|----|-------|-------|---------|
| `sample-ensemble` | Sample Ensemble | `/sample-data/ensemble.csv` | null |
| `sample-ensemble-anon` | Sample Ensemble (anonymous) | `/sample-data/ensemble_anon.csv` | `/sample-data/ensemble_anon_labels.csv` |
| `crmms-powell-elevation` | CRMMS: Lake Powell Pool Elevation | `/crmms/res_Powell_Pool_Elevation.csv` | null |
| `crmms-powell-evap` | CRMMS: Lake Powell Evaporation | `/crmms/res_Powell_Evaporation.csv` | null |
| `crmms-powell-inflow` | CRMMS: Unregulated Inflow to Lake Powell | `/crmms/streamflow_PowellInflow_Unregulated.csv` | null |

### Implementation Phase 2 — Data loading helper

- GOAL-002: Add `fetchExamples()` and `fetchExampleFile()` functions to `src/lib/sampleData.js`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-003 | Add `fetchExamples()` — fetches `/examples.json`, returns parsed array | | |
| TASK-004 | Add `fetchExampleFile(entry)` — fetches the entry path, returns a `File` object (same type as browse/drop input) so existing `onFile` callback works unchanged | | |
| TASK-005 | If entry has `sidecar`, expose a parallel `fetchExampleSidecar(sidecar)` returning a `File` | | |

### Implementation Phase 3 — UI: replace "Load sample" with "Examples" dropdown

- GOAL-003: Update `src/components/FileDropzone.jsx` to show an examples picker.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | On mount, call `fetchExamples()` and store results in state; show loading indicator while pending | | |
| TASK-007 | Replace "Load sample" button with a `<select>` (or styled dropdown) showing all manifest entries; first option is a placeholder ("Examples…") | | |
| TASK-008 | On selection change: call `fetchExampleFile(entry)` → `onFile(file)`; if sidecar present, also call `onSidecar(sidecarFile)` | | |
| TASK-009 | Show inline loading state on the dropdown while fetching the selected file | | |
| TASK-010 | Reset dropdown to placeholder after successful load (so user can reload same example) | | |

### Implementation Phase 4 — Smoke test

- GOAL-004: Verify all examples load correctly end-to-end.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Start dev server (`npm run dev`), load each manifest entry, confirm plot renders | | |
| TASK-012 | Test `sample-ensemble-anon` — confirm sidecar auto-attaches and label controls appear | | |
| TASK-014 | Confirm Browse + drag-and-drop still work after the change | | |

## 3. Alternatives

- **ALT-001**: Build-time auto-manifest (Vite plugin scans `public/`). Rejected — adds build complexity; display names would be ugly raw filenames requiring extra logic.
- **ALT-002**: Hardcode examples list inside `sampleData.js`. Rejected — mixes data config with code; harder to update without a rebuild.
- **ALT-003**: Separate "Examples" modal/panel. Possible UX upgrade later, but dropdown is sufficient and matches ArborView precedent.

## 4. Dependencies

- **DEP-001**: No new npm packages required. Uses native `fetch()` and `File` constructor.
- **DEP-002**: Existing `onFile` and `onSidecar` callback signatures in `FileDropzone.jsx` — must remain compatible.

## 5. Files

- **FILE-001**: `public/examples.json` — new manifest file (created in Phase 1)
- **FILE-002**: `src/lib/sampleData.js` — add `fetchExamples`, `fetchExampleFile`, `fetchExampleSidecar`
- **FILE-003**: `src/components/FileDropzone.jsx` — replace "Load sample" button with examples dropdown

## 6. Testing

- **TEST-001**: Each manifest entry fetches without 404 in dev and production build (`npm run build && npm run preview`)
- **TEST-002**: `sample-ensemble-anon` loads with sidecar; label controls activate automatically
- **TEST-003**: Browse and drag-and-drop still work after FileDropzone change
- **TEST-004**: Dropdown resets to placeholder after each successful load

## 7. Risks & Assumptions

- **ASSUMPTION-001**: `public/` is served at the root path (`/`) in both dev and production — standard Vite behavior.
- **ASSUMPTION-002**: The existing `onFile(File)` callback accepts a `File` constructed from a `fetch` response blob without changes to App.jsx.

## 8. Related Specifications / Further Reading

- ArborView manifest pattern: `C:/GitHub/ArborView/public/data/manifest.json`
- ArborView bootstrap/load flow: `C:/GitHub/ArborView/src/main.ts` lines 175–254
- Existing sample load: `src/lib/sampleData.js`, `src/components/FileDropzone.jsx`
