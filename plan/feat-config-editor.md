---
goal: Dedicated, data-independent config editor for ensemble-viewer (preset authoring)
version: 1.0
date_created: 2026-05-29
last_updated: 2026-05-29
owner: Joseph Kasprzyk
status: 'Planned'
tags: [feature, config, ux, editor]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This is **Phase 6b**, split out of `plan/feat-rw-file-enhancements.md` during the 2026-05-29 design review (decision DR-07). That plan ships **Phase 6a**: XML config serialize/parse (`src/lib/config.js`), save/load UI (`src/components/ConfigControls.jsx`), and a publicly documented schema (`docs/config-schema.md`, root `<ensembleViewerConfig version="1">`).

This plan adds a **dedicated config editor**: a view that creates and edits a configuration **with no dataset loaded** (preset authoring), then saves it to the same XML format. It was deferred so it can be built against the **frozen, proven XML schema** that 6a produces in real use — rather than co-designed with a schema still in flux.

It corresponds to User Note 2 ("preconfigured plots, set things up in advance"; original ALT-004) and uses the owner's **pareto-explorer** project as the pattern reference for in-browser, data-independent config editing.

## Prerequisite

- **PRE-001**: Phase 6a must be merged and the XML schema (`docs/config-schema.md`, `version="1"`) stable. `serializeConfig` / `parseConfig` / `DEFAULT_CONFIG` from `src/lib/config.js` are reused unchanged; this plan adds **no new XML fields** and does not bump the schema version. If the editor surfaces a need for new fields, that is a schema change handled in `config.js` first (and would bump the version).

## 1. Requirements & Constraints

- **REQ-001**: A dedicated editor view must let a user create or edit a configuration **without any dataset loaded**, then save it as a `version="1"` XML file byte-identical in shape to one produced by the live viewer's "Save config".
- **REQ-002**: The editor must be able to **load an existing XML config** (via the shared `parseConfig`) to edit it, and **start from blank** (the shared `DEFAULT_CONFIG`) to author a new one.
- **REQ-003**: A round-trip through the editor must not silently drop or corrupt fields: `serializeConfig(editorState)` for an unchanged loaded config must deep-equal the original parsed config (Sets reconstructed).
- **REQ-004**: Data-dependent fields (those that normally enumerate options from the loaded dataset — `colorBy`, `activeByCategory`, category lists, `selectedHorizons`, `sortCategory`, `splitBy`, `tieCategoryA/B`) must be editable as **free text / free-form entry**, with inline guidance that values are matched against a dataset only when the preset is later applied in the viewer.
- **REQ-005**: Data-independent fields (`tickFormat`, `lineStyleControls` incl. overrides, `xAxisLabel`, `yAxisLabel`, `axisRanges`, `showBands`, `delimiter`, `labelStrategy`, `horizonLogic`, `bundledFilter`, `classificationFilter`) reuse the same control widgets as the live `LabelControls` where practical, for consistency.
- **REQ-006**: A view toggle must switch between "Viewer" and "Config editor" without a router dependency (state-based tab), preserving the viewer's loaded dataset when switching back.
- **SEC-001**: The editor performs no new parsing beyond the shared, hardened `parseConfig` (no external entities; descriptive errors; numeric clamping per 6a's SEC rules). Free-text fields are stored as strings and clamped/validated by the existing `applyConfig` guards when applied to a dataset.
- **CON-001**: No new runtime npm dependencies. View toggle is local React state.
- **CON-002**: No changes to `src/lib/config.js` serialization format or the schema version. This plan is purely additive UI on top of 6a.
- **GUD-001**: Reuse 6a's `DEFAULT_CONFIG`, `serializeConfig`, `parseConfig`. Match existing idiom (sectioned controls like `LabelControls`, colocated `*.test.jsx` via `vitest`).
- **PAT-001**: The editor edits a plain config object (the same shape `getCurrentConfig()` returns), never touching dataset state (`rows`, `columns`, `labelsByColumn`).

## 2. Implementation Steps

### Implementation Phase 6b — Dedicated config editor

- **GOAL-001**: Provide a data-independent editor that authors/edits a `version="1"` config and saves it, reusing 6a's serialize/parse and the existing control widgets.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `src/App.jsx`, add a state-based view toggle (`const [view, setView] = useState('viewer')`, values `{'viewer','configEditor'}`); a small tab/segmented control in the header. Switching to `configEditor` must NOT clear dataset state; switching back restores the viewer untouched. (Former Phase 6a TASK-030 view-toggle clause lands here.) |  |  |
| TASK-002 | Create `src/components/ConfigEditor.jsx`: renders a config object (initialized from `DEFAULT_CONFIG`) as an editable form, grouped to mirror the viewer panel sections (Display, Line styling, Faceting, Filters). Holds its own working-copy state; emits the edited config on save. |  |  |
| TASK-003 | Data-independent fields (REQ-005): reuse/extract the same widgets `LabelControls` uses (tick-precision selects, line-style inputs incl. per-field overrides, axis labels, axis ranges, `showBands`, delimiter, label strategy, horizon logic, bundled/classification filters). Refactor those widgets into shared presentational components if needed so both `LabelControls` and `ConfigEditor` consume them. |  |  |
| TASK-004 | Data-dependent fields (REQ-004): free-text inputs for `colorBy`, `splitBy`, `sortCategory`, `tieCategoryA/B`; free-form list entry for `activeByCategory` (category → values), `selectedHorizons`, category list. Inline helper text: "Matched against the dataset when this preset is loaded in the viewer." No enumeration/validation against a dataset here. |  |  |
| TASK-005 | "Load config" in the editor: file input → shared `parseConfig` → populate the working copy (start from `DEFAULT_CONFIG`, overlay parsed, per 6a DR-08). Surface parse/version errors via the existing error channel. "Start blank" resets to `DEFAULT_CONFIG`. |  |  |
| TASK-006 | "Save config" in the editor: `serializeConfig(workingCopy)` → `Blob` → download `ensemble-viewer-config.xml`. Identical output path/shape as 6a's `ConfigControls` save. |  |  |
| TASK-007 | Create `src/components/ConfigEditor.test.jsx`: blank-start produces a `serializeConfig(DEFAULT_CONFIG)`-equivalent document; load→edit-nothing→save round-trips deep-equal (Sets reconstructed); free-text data-dependent fields serialize as plain string/list values; a field edit is reflected in serialized output. |  |  |
| TASK-008 | Update `docs/config-schema.md` (created in 6a) with a short "Authoring presets without data" subsection and a note that free-text data-dependent values are matched on load. Link the editor from `README.md`. |  |  |

## 3. Alternatives

- **ALT-001**: Edit configs via the live left panel only (no dedicated editor). **Rejected** — the live panel needs a loaded dataset to enumerate most categories, so it cannot author a preset from scratch. This was the original ALT-004; the dedicated editor exists precisely to cover the no-data case.
- **ALT-002**: Build the editor in Phase 6a alongside save/load. **Rejected (DR-07)** — building it against an unproven schema risks rework; save-from-active-session already delivers the core "set things up in advance" value, so the editor follows once the schema is frozen.
- **ALT-003**: Schema-driven auto-generated form (introspect `DEFAULT_CONFIG` to render fields). **Deferred** — attractive for maintenance but heavier; start with an explicit form mirroring the viewer sections (TASK-003/004), revisit auto-generation if field count grows.

## 4. Dependencies

- **DEP-001**: Phase 6a — `src/lib/config.js` (`serializeConfig`, `parseConfig`, `DEFAULT_CONFIG`), `src/components/ConfigControls.jsx`, `docs/config-schema.md` (PRE-001).
- **DEP-002**: Existing React stack; `vitest`. No additions (CON-001).
- **DEP-003**: Shared control widgets from `src/components/LabelControls.jsx` (extracted in TASK-003).
- **DEP-004**: **pareto-explorer** (owner's GitHub) — pattern reference for in-browser, data-independent config editing.

## 5. Files

- **FILE-001**: `src/App.jsx` — view toggle (`view` state), render `ConfigEditor` when active, preserve dataset across toggles.
- **FILE-002**: `src/components/ConfigEditor.jsx` *(new)* — data-independent preset editor.
- **FILE-003**: `src/components/LabelControls.jsx` — extract shared widgets so the editor reuses them (no behavior change in the viewer).
- **FILE-004**: `src/components/ConfigEditor.test.jsx` *(new)* — blank-start, round-trip, free-text serialization, edit-reflection tests.
- **FILE-005**: `docs/config-schema.md` — "Authoring presets without data" subsection.
- **FILE-006**: `README.md` — link/note the config editor view.

## 6. Testing

- **TEST-001**: Blank-start editor → save produces a document equivalent to `serializeConfig(DEFAULT_CONFIG)`. (TASK-007)
- **TEST-002**: Load an XML config → edit nothing → save → `parseConfig` of the result deep-equals the original parsed config (Sets reconstructed). (TASK-007)
- **TEST-003**: Editing a data-independent field (e.g. `tickFormat.y`) and a data-dependent field (e.g. `colorBy` free text) is reflected in serialized output. (TASK-007)
- **TEST-004**: Loading a config with an unsupported `version` or malformed XML surfaces a descriptive error via the existing error channel (delegated to 6a's `parseConfig`; assert the editor wires the error through, does not crash). (TASK-005)
- **TEST-005**: View toggle — switching to the editor and back does not alter the viewer's loaded dataset/derived state. (TASK-001)
- **TEST-006**: Regression — Phase 6a `config.test.js` still passes; the widget extraction (TASK-003) does not change `LabelControls` behavior in the viewer.
- **TEST-007**: Manual — with no dataset loaded, author a preset in the editor, save it, then load that preset in the viewer against a real RDF/CSV and confirm controls populate and missing-category guards behave.

## 7. Risks & Assumptions

- **RISK-001**: Widget extraction (TASK-003) could regress the live `LabelControls`. Mitigation: pure presentational extraction, props-driven; TEST-006 regression check.
- **RISK-002**: Free-text data-dependent fields let users author presets that don't match any real dataset. Mitigation: inline guidance (TASK-004); the viewer's existing `applyConfig` guards already drop/ignore categories absent from the loaded dataset (6a DR-08).
- **RISK-003**: Editor and live-viewer save paths could drift in output shape. Mitigation: both call the single shared `serializeConfig`; round-trip tests (TEST-001/002).
- **ASSUMPTION-001**: Phase 6a's schema is stable and versioned at `"1"`; this plan adds no fields and does not bump the version (CON-002, PRE-001).
- **ASSUMPTION-002**: The viewer's `applyConfig` (6a) already handles loading editor-authored presets — this plan only authors/saves; loading-into-viewer behavior is 6a's.

## 8. Related Specifications / Further Reading

- `plan/feat-rw-file-enhancements.md` — Phase 6a (save/load + schema); decision DR-07 split this editor out.
- `docs/config-schema.md` — the XML schema this editor reads/writes (created in 6a).
- **pareto-explorer** (owner's GitHub) — pattern reference for in-browser, data-independent config editing.
- `plan/completed/feature-plot-customization-panel-reorg-1.md` — the Display/Faceting/Filter panel structure the editor mirrors.
