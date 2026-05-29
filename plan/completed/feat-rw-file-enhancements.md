---
goal: Read/write & in-browser RDF conversion enhancements for ensemble-viewer
version: 1.2
date_created: 2026-05-29
last_updated: 2026-05-29
owner: Joseph Kasprzyk
status: 'Completed'
tags: [feature, rdf, config, plotting, labels, ux]
---

# User Notes

## Making it easier to create CSV files from RDF

The main list items came from user feedback, and the sub-items are comments from me, the developer of this tool

1. Generalize the process to generate the necessary CSV files from RDF. Ideally this would be done via a GUI, but in the meantime, a general script that is either easy to edit directly at the top of the script or for which details can be entered as arguments on the command line. 
	1. While testing, this was implemented by simplifying the .bat file and making it clear what parameters needed to change.
	2. However there is still the issue that the user needs Python installed, and they would also need to clone the repo in order to do the conversion. This is fine for developers, but not good for general users
2. Add the ability to save/load a configuration (all the information from the left panel). 
	1. This would enable a user to use preconfigured plots, and we could set things up in advance (such as preferred options for plotting Pool Elevation slots from RiverWare)
	2. In typical RiverWare applications, they create GUI to create configurations like this, but the configuration itself should be saved in XML and the schema should be publicly documented
3. Auto-generate the y axis label from the slot name and units. 
	1. This would require including the slot name and units in the CSV file somehow.
	2. Perhaps a look-up table could be added in the codebase, with nicely formatted labels for all the different types of RiverWare series slots
4. Show the Year labels without a decimal point (or more generally allow control over the precision of data used for labels).
5. Add the ability to set the line thickness and opacity directly by typing in a value, not only via slider.
	1. In a recent update, the slider was improved, but I agree that being able to enter the numbers directly would be nice
	2. We're using nonlinear scaling functions, and so it would be great to give the user more control over just specifying values rather than fiddling with the different tuning parameters that are used to calculate the opacity and thickness.
	3. This would be an *additional* feature, it would not replace the customizability we already have
6. It was not clear what the “Show mean + p10-p90 bands per group” option did. In my plots, it just seemed to make all the curves a bit lighter.
	1. It's possible that this is a bug. We haven't messed with the 10-90 features for a while, so it could be that they are not longer even working...

>These notes were given to Claude, and I provided feedback on the first version of the plan, which was subsequently updated.

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan turns the six user-feedback items in the **User Notes** above into discrete, independently shippable features for ensemble-viewer. After design review (2026-05-29) the scope deepened in two places: RDF→CSV conversion moves **into the browser** (not just nicer scripts), and the config feature gains a **dedicated, data-independent editor** (not just save-from-active-state). All work is now client-side in the React app (`src/`); the existing Python `scripts/` are retained as reference only and the standalone converter lives externally in the owner's **parasolpy** PyPI package.

The six features, in implementation order:

1. **Tick-label precision** — integer year ticks (no `2020.5`) plus per-axis precision control (User Note 4). Frontend-only.
2. **Direct numeric line styling** — type absolute width / opacity values that override the nonlinear `sqrt(N)` auto-scaling, additive to the sliders (User Note 5). Frontend-only.
3. **Bands investigation/fix** — diagnose and fix or clarify "Show mean + p10–p90 bands per group" (User Note 6). Frontend-only.
4. **In-browser RDF conversion** — drop a `.rdf` into the web tool, parse it client-side (JS port of `rdf_parser.py`), pick a slot, view it directly, and optionally download the CSV (User Note 1, expanded). No Python, no server.
5. **Auto y-axis label** — derive a formatted y-axis label from slot name + units, supplied directly by the in-browser parser and backed by a lookup table (User Note 3). Depends on Phase 4.
6. **Config save / load + dedicated editor** — serialize the full left-panel state to documented XML, and provide a config-editor view that creates/edits presets with no dataset loaded (User Note 2, expanded). Self-contained.

Phases 1–4 are independent. Phase 5 depends on Phase 4 (parser supplies units). Phase 6 is self-contained but best landed after the state it serializes is stable (after Phases 1, 2, 5).

## Design Review Decisions (grill, 2026-05-29)

A grill-the-plan review resolved the open design branches below. These supersede any conflicting task wording later in the document.

- **DR-01 (Phase 4, trace mapping):** Each RDF `run` becomes one trace column `trace_<n>`; chosen series slot × N runs → N columns. Index column built from `runs[0].times`. Assume identical timestep lists across runs (RiverWare MRM guarantee); assert equal length and equal first/last date, throw a descriptive error on mismatch (SEC-001). No reindex/union.
- **DR-02 (Phase 4, scalar labels):** ALL scalar slots become label categories (no pruning of constants), each named by its full `ObjectName.SlotName` key to avoid cross-object collisions. `slot`/`units` injected as constant categories on every column.
- **DR-03 (Phase 4, annual detection):** Year case → index value is the 4-digit year **string** (`"2020"`) so `detectIndexType` → numeric → Phase 1 integer ticks apply. Annual is detected as "one timestamp per distinct year" (same month+day, ~1yr spacing) — NOT hardcoded Jan-1 (CRMMS annual stamps are often Dec-31 24:00). Capture the real CRMMS stamp during TASK-016. Supersedes ASSUMPTION-004.
- **DR-04 (Phase 2, override semantics):** Numeric width/opacity overrides are **truly absolute** — the `BAND_OPACITY_SCALE` band reduction is NOT applied on the override path (only on the computed/slider path). Supersedes TASK-006 / TEST-002 wording.
- **DR-05 (Phase 2, override granularity):** Overrides are **per-field**. A finite number in a field overrides that dimension; blank = `null` = that dimension stays on `sqrt(N)` auto. Drop the single coupling checkbox (TASK-008); disable only the slider whose dimension is overridden.
- **DR-06 (Phase 3, bands root cause):** Confirmed **defect**, not usage. `resolveLineStyling` dims every trace by `BAND_OPACITY_SCALE` whenever `showBands` is true — even when no band actually draws (no `colorBy`, or all groups size 1) — producing the "everything just got lighter" symptom. Fix: gate the dimming on **bands-actually-drawn** (`showBands && colorBy && at least one group has ≥2 traces`), computed before styling and passed to `resolveLineStyling` (not the raw `showBands` flag). Also bump fill alpha `0.18 → 0.25` and keep the TASK-014 UX note. Resolves RISK-006.
- **DR-07 (Phase 6 split):** Phase 6 splits. **Phase 6a — config save/load** (XML serialize/parse, save/load UI, schema docs) ships in this plan. **Phase 6b — dedicated no-data config editor** (former TASK-029) is deferred to a separate plan (`plan/feat-config-editor.md`) so it can be built against a frozen, proven XML schema. Supersedes ALT-004's "build now" implication.
- **DR-08 (Phase 6a load semantics):** `parseConfig` accepts exactly `version="1"`; any other version → descriptive `Error` via the existing error channel (no migration layer yet). On load, missing elements **reset to app default**: define `DEFAULT_CONFIG`, start from it, overlay parsed values (clean full-state restore, deterministic round-trip). Unknown elements remain ignored (forward-tolerant).
- **DR-09 (Phase 5, label precedence):** Y-label precedence = manual `yAxisLabel` (non-empty) > injected `slot`/`units` from data > `SLOT_LABELS` table > `''`. `SLOT_LABELS` is a **fallback only** (parsed units always win); it seeds known slots and covers CSV inputs lacking units. Keyed on `slot_name`.
- **DR-10 (Phase 4, CSV export):** Export only **wide** + **stacked** (long/enriched stay in parasolpy). Parity test (TEST-005) is **structural/semantic** — same column order, same index values, numeric values within epsilon, matching scalar header rows — NOT byte-exact (avoids JS/Python float-repr and line-ending false failures).

## 1. Requirements & Constraints

- **REQ-001**: Numeric x-axis ticks must be displayable without fractional digits (e.g. `2020` not `2020.5`), with a user control for precision (auto / integer / 1 / 2 decimals) on both x and y axes. Datetime axes are unaffected.
- **REQ-002**: Users must be able to enter absolute line **width** (px) and **opacity** (0–1) numerically; these override the computed `sqrt(N)` styling when set. The slider/multiplier workflow remains the default and fully functional (additive, not a replacement — User Note 5.3).
- **REQ-003**: The "Show mean + p10–p90 bands per group" behavior must be demonstrably correct or fixed; the root cause of "it just makes the curves lighter" must be identified and documented, and the UI must communicate the prerequisites (a `colorBy` grouping and ≥2 traces per group).
- **REQ-004**: Users must be able to convert a RiverWare `.rdf` file to viewable timeseries **entirely within the web tool** — no Python install, no repo clone, no server round-trip. Flow: drop `.rdf` → client-side parse → choose a series slot → render directly in the existing plot pipeline, with an optional "download CSV" for the chosen slot.
- **REQ-005**: The in-browser converter must surface the available series slots (with units) and produce the same in-memory dataset shape that `parseCsvFile` produces (`{ columns, indexColumn, rows, labelsByColumn, labelRowCount }`), so RDF and CSV inputs share one downstream path. Scalar slots become label categories; the chosen slot's name and units are injected as `slot`/`units` label categories for Phase 5.
- **REQ-006**: The entire left-panel configuration must be serializable to XML and restorable from XML, with a publicly documented schema. Additionally, a **dedicated config editor** must allow viewing and editing a configuration field-by-field with **no dataset loaded** (preset authoring), then saving it — in addition to saving from the active session.
- **SEC-001**: All loaded/imported config, CSV, and RDF content is untrusted. XML parsing must not resolve external entities or fetch network resources; reject malformed or version-incompatible config files with a user-visible error rather than throwing. RDF parsing must fail gracefully (descriptive error, no crash) on malformed input.
- **SEC-002**: Numeric style overrides, tick precision, parsed RDF values, and config-restored values must be clamped/validated before reaching Plotly (no `NaN`, `Infinity`, or negative widths).
- **CON-001**: New runtime npm dependencies are permitted where they materially simplify the work, but must be justified in the plan. As designed, no new dependency is currently required (in-browser RDF parsing is a small custom JS module; XML uses native `DOMParser`/`XMLSerializer`; `chroma-js` already present).
- **CON-002**: No Python code is added or modified by this plan. The standalone Python converter is maintained externally as **parasolpy** (PyPI); the in-repo `scripts/` remain unchanged and serve as the reference implementation the JS port must match.
- **CON-003**: Keep pure logic in `src/lib/` modules; React components stay state-orchestration + rendering layers.
- **GUD-001**: Match existing code idiom: `useMemo`-derived state in `src/App.jsx`, sectioned controls in `src/components/LabelControls.jsx`, colocated `*.test.js`/`*.test.jsx` run via `vitest`.
- **GUD-002**: The JS RDF parser must be a faithful port of `scripts/rdf_parser.py` and validated against the same sample fixtures (`public/rw-sample-data/*.rdf`) so the two implementations stay in agreement.
- **PAT-001**: Plot styling stays centralized in `src/lib/plotStyle.js`; `resolveLineStyling(...)` remains the single source of truth for width/opacity.
- **PAT-002**: Label derivation stays centralized; new slot-label lookup lives in `src/lib/slotLabels.js`.
- **PAT-003**: RDF and CSV loading converge on a single `applyDataset(parsed)` path in `src/App.jsx` so all downstream state (labels, filters, plot) is source-agnostic.

## 2. Implementation Steps

### Implementation Phase 1 — Tick-label precision (User Note 4)

- **GOAL-001**: Render integer numeric ticks by default and expose a per-axis tick-precision control, without affecting datetime axes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `src/App.jsx`, add state `const [tickFormat, setTickFormat] = useState({ x: 'auto', y: 'auto' })` where each value ∈ `{'auto','int','1','2'}`. Pass to `EnsemblePlot` and `LabelControls`. | Yes | 2026-05-29 |
| TASK-002 | Add pure helper `tickFormatString(option, axisType)` to `src/lib/plotStyle.js` (or new `src/lib/tickFormat.js`). Map: `'int' → 'd'`, `'1' → '.1f'`, `'2' → '.2f'`, `'auto' → ''`. Return `''` when `axisType === 'datetime'`. | Yes | 2026-05-29 |
| TASK-003 | In `src/components/EnsemblePlot.jsx`, add `tickFormat` prop; set `layout.xaxis.tickformat = tickFormatString(tickFormat.x, indexType)` and `layout.yaxis.tickformat = tickFormatString(tickFormat.y, 'numeric')`; omit the key when the helper returns `''`. Add `tickFormat` to the `useMemo` deps. | Yes | 2026-05-29 |
| TASK-004 | In `src/components/LabelControls.jsx` Display section, add two `<select>`s ("X tick precision", "Y tick precision") with Auto / Integer / 1 decimal / 2 decimals, wired via new `onTickFormatChange(axis, value)`. Disable the X control (or show "n/a") when `indexType === 'datetime'`. | Yes | 2026-05-29 |
| TASK-005 | Add tests in `src/lib/plotStyle.test.js` (create if absent) for `tickFormatString`: each option maps correctly; datetime returns `''`. | Yes | 2026-05-29 |

### Implementation Phase 2 — Direct numeric line styling (User Note 5)

- **GOAL-002**: Allow absolute width/opacity entry that overrides the `sqrt(N)` auto-scaling, additive to the multiplier sliders.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | In `src/lib/plotStyle.js`, extend `resolveLineStyling(lineCount, bandsActive, lineStyleControls)` to honor optional `lineStyleControls.widthOverride` and `lineStyleControls.opacityOverride`. When a finite override is present, return it (clamped to `[MIN_LINE_WIDTH, MAX_LINE_WIDTH]` / `[MIN_LINE_OPACITY, MAX_LINE_OPACITY]`) instead of the computed value. **Per DR-04, the band-opacity reduction is NOT applied on the override path** — overrides are absolute; the `BAND_OPACITY_SCALE` reduction applies only on the computed (slider) path. **Per DR-06, the second argument is `bandsActive` (bands-actually-drawn), not the raw `showBands` flag.** Document precedence in the file header. | Yes | 2026-05-29 |
| TASK-007 | In `src/App.jsx`, extend `lineStyleControls` initial state with `widthOverride: null, opacityOverride: null`; ensure reset/serialization paths preserve them. | Yes | 2026-05-29 |
| TASK-008 | In `src/components/LabelControls.jsx` "Line styling" `<details>`, add a "Manual values" subsection with two `type="number"` inputs (Width px, step 0.1, range `[MIN_LINE_WIDTH, MAX_LINE_WIDTH]`; Opacity, step 0.05, range `[0,1]`). **Per DR-05, overrides are per-field and there is no coupling checkbox:** a finite value in a field sets that override and disables only the matching slider; clearing the field to blank sets it back to `null` (that slider re-activates, dimension returns to `sqrt(N)` auto). Import MIN/MAX from `plotStyle.js`. | Yes | 2026-05-29 |
| TASK-009 | Verify the `src/App.jsx` header readout (`resolvedLineStyle` line) reflects overridden values, since it reads from `resolveLineStyling`. | Yes | 2026-05-29 |
| TASK-010 | Add tests in `src/lib/plotStyle.test.js` for override precedence: override present → returned value (clamped); `null` → computed fallback; **per DR-04, band reduction NOT applied to an opacity override (absolute), still applied on the computed path when `bandsActive`**; per-field independence (width override + opacity auto, and vice versa). | Yes | 2026-05-29 |

### Implementation Phase 3 — Bands investigation & fix (User Note 6)

- **GOAL-003**: Determine why bands appear only to dim traces, then fix the defect or clarify the UX so the feature is understandable and demonstrably working.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | **Diagnosis complete (DR-06).** Root cause: `resolveLineStyling` dims every trace by `BAND_OPACITY_SCALE` (0.7) whenever `showBands` is true (plotStyle.js:59), but bands only draw when `showBands && colorBy && groupCols.length >= 2` (EnsemblePlot.jsx:80,88). With no `colorBy` or all size-1 groups, traces are dimmed while zero bands render → the user's "everything just got lighter" symptom. This is a defect, not usage. | Yes | 2026-05-29 |
| TASK-012 | Confirm fix direction (DR-06): compute `bandsActive = showBands && !!colorBy && (at least one colorBy group has ≥2 visible traces)` in `EnsemblePlot`/`App`, pass it to `resolveLineStyling` in place of the raw `showBands` flag. Verify against `public/crmms-es/` data with and without a `colorBy` set. | Yes | 2026-05-29 |
| TASK-013 | Apply the fix: (1) gate dimming on `bandsActive` (no bands → no dimming); (2) raise band fill alpha `0.18 → 0.25` and ensure the mean line renders above traces. | Yes | 2026-05-29 |
| TASK-014 | UX clarity in `src/components/LabelControls.jsx`: when `showBands` is on but no group has ≥2 visible traces, show an inline note ("Bands need ≥2 traces per colored group"); reword the checkbox helper to state bands require a color-by grouping. | Yes | 2026-05-29 |
| TASK-015 | Extend `src/components/EnsemblePlot.test.js` and `src/lib/stats.test.js`: band traces produced for a ≥2-member group, skipped for 1-member; `computeGroupStats` p10 ≤ median ≤ p90 ignoring NaN. | Yes | 2026-05-29 |

### Implementation Phase 4 — In-browser RDF conversion (User Note 1, expanded)

- **GOAL-004**: Let users drop a `.rdf` into the web tool, parse it client-side, pick a slot, view it directly, and optionally download the CSV — no Python, no server. Decision: in-browser JS port (not Vercel Python serverless — ALT-001).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Create `src/lib/rdfParser.js` — a faithful JS port of `scripts/rdf_parser.py`. Export `parseRdf(text) → { meta, runs }` and `listSlots(rdf) → [{ key, object_name, slot_name, object_type, slot_type, units, scale, scalar }]`. Replicate: package/run/slot preamble `key:value` parsing, timestep normalization (`YYYY-M-D 24:00 → YYYY-MM-DD`), bare units/scale lines, scalar-vs-series detection via `slot_type` and `END_COLUMN` value count, `END_SLOT` handling. Operate purely on string text (no filesystem). | Yes | 2026-05-29 |
| TASK-017 | Add `rdfToDataset(rdf, slotKey) → { columns, indexColumn, rows, labelsByColumn, labelRowCount }` (in `rdfParser.js` or new `src/lib/rdfDataset.js`), matching `parseCsvFile` output. **Per DR-01:** each run → column `trace_<n>`; assert identical timesteps across runs (length + first/last date), else throw. **Per DR-03:** `indexColumn` = `'year'` with a 4-digit year-string index when annual (one timestamp per distinct year, NOT Jan-1-only), else `'date'` with ISO date. `rows` = per-timestep objects keyed by column. **Per DR-02:** every scalar slot → a label category named by full `Object.Slot` key (value per trace), PLUS inject `slot` (chosen slot name) and `units` categories on every column for Phase 5. | Yes | 2026-05-29 |
| TASK-018 | Add `src/lib/csvExport.js`: `datasetToWideCsv(dataset)` and `datasetToStackedCsv(dataset)` (mirror Python `_write_wide` / `_write_stacked_header`), returning CSV strings for the optional download. **Per DR-10, only wide + stacked are ported** (long/enriched stay in parasolpy). Stacked emits scalar `labelsByColumn` as header rows. | Yes | 2026-05-29 |
| TASK-019 | In `src/App.jsx`, refactor `loadFile` so CSV/XLSX/RDF all converge on one `applyDataset(parsed)` setter path (PAT-003). Add `rdf` state and handlers: `loadRdf(file)` (read text → `parseRdf` → store) and `selectRdfSlot(slotKey)` (→ `rdfToDataset` → `applyDataset`). | Yes | 2026-05-29 |
| TASK-020 | In `src/components/FileDropzone.jsx`, accept `.rdf`; on RDF, call `onRdf(file)` instead of the CSV path. Add a `RdfSlotPicker` (new component or inline section) listing series slots with units; selecting one calls `onSelectSlot(slotKey)`. Add a "Download CSV" button that serializes the current RDF-derived dataset via `csvExport.js` and triggers a `Blob` download. | Yes | 2026-05-29 |
| TASK-021 | Create `src/lib/rdfParser.test.js` using `public/rw-sample-data/sample_traces.rdf` and `sample_subset.rdf` as fixtures (shared with the Python suite per GUD-002). Assert: slot list + units + scalar flags, timestamp normalization, `rdfToDataset` shape parity with `parseCsvFile`, and `slot`/`units` label injection. | Yes | 2026-05-29 |

### Implementation Phase 5 — Auto y-axis label from slot + units (User Note 3)

- **GOAL-005**: Auto-populate the y-axis label from slot name + units (supplied by the Phase 4 parser, backed by a lookup table), with manual override precedence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Create `src/lib/slotLabels.js`: export `SLOT_LABELS` (lookup table mapping known RiverWare slot names → `{ label, units }`, e.g. `'Pool Elevation' → { label: 'Pool Elevation', units: 'ft' }`) and pure `deriveYAxisLabel(labelsByColumn, columns)` that reads the `slot`/`units` label categories injected by `rdfToDataset` (or present in a stacked CSV), falls back to `SLOT_LABELS`, and returns a formatted string like `"Pool Elevation (ft)"`, or `''` when nothing is derivable. | Yes | 2026-05-29 |
| TASK-023 | In `src/App.jsx`, add `defaultYAxisLabel = useMemo(() => deriveYAxisLabel(effectiveLabelsByColumn, columns), [...])`; pass to `EnsemblePlot` and `LabelControls`. | Yes | 2026-05-29 |
| TASK-024 | In `src/components/EnsemblePlot.jsx`, use `yAxisLabel || defaultYAxisLabel` for `layout.yaxis.title`. In `src/components/LabelControls.jsx`, show `defaultYAxisLabel` as the Y-axis-label input placeholder. **Per DR-09, precedence is: manual `yAxisLabel` (non-empty) > injected `slot`/`units` from data > `SLOT_LABELS` table > `''`; the table is fallback only — parsed units always win.** | Yes | 2026-05-29 |
| TASK-025 | Add `src/lib/slotLabels.test.js`: lookup hits, units from injected label categories, formatting, and empty-result fallback. | Yes | 2026-05-29 |

### Implementation Phase 6a — Config save/load (User Note 2)

> **Per DR-07, Phase 6 is split.** This plan ships **6a** (save/load + schema docs). The **dedicated no-data config editor (6b)** is deferred to `plan/feat-config-editor.md`, to be built against the frozen XML schema this phase produces. Former TASK-029 lives there.

- **GOAL-006**: Serialize the full left-panel state to documented, versioned XML and restore it (save from active session; load into the running viewer).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-026 | Create `src/lib/config.js` with pure `serializeConfig(state) → string` and `parseConfig(xmlString) → state` using `XMLSerializer`/`DOMParser`. Root `<ensembleViewerConfig version="1">`. Serialize: `labelStrategy, delimiter, categoriesText, activeByCategory` (Sets→lists), `colorBy, showBands, xAxisLabel, yAxisLabel, lineStyleControls` (incl. overrides), `axisRanges, tickFormat, splitBy, tieCategoryA, tieCategoryB, sortCategory, sortRange, selectedHorizons` (Set→list), `horizonLogic, bundledFilter, classificationFilter`. Reconstruct `Set`s on parse. | Yes | 2026-05-29 |
| TASK-027 | Harden `parseConfig`: parse as `text/xml`; **per DR-08, accept exactly `version="1"`, reject missing root or any other version with a descriptive `Error`**; check for a `<parsererror>` node (DOMParser does not throw); ignore unknown elements; do not enable external entity resolution (SEC-001); validate/clamp numeric fields (SEC-002). | Yes | 2026-05-29 |
| TASK-028 | Create `src/components/ConfigControls.jsx`: "Save config" (→ `serializeConfig` → `Blob` → download `ensemble-viewer-config.xml`) and "Load config" file input (→ read `.xml` → `parseConfig` → `onLoadConfig(state)`). Surface parse errors via the existing error channel. | Yes | 2026-05-29 |
| TASK-029 | *(Moved to Phase 6b — `plan/feat-config-editor.md`, per DR-07.)* Dedicated no-data `ConfigEditor.jsx` is deferred until the XML schema below is proven in real use. |  |  |
| TASK-030 | In `src/App.jsx`, render `ConfigControls` in the viewer sidebar. Implement `getCurrentConfig()` (gathers all serialized state) and `applyConfig(parsed)`. **Per DR-08, `applyConfig` starts from a `DEFAULT_CONFIG` object and overlays parsed values** (missing elements → defaults), reconstructing Sets, guarding against categories absent from the current dataset, mirroring the existing reset `useEffect`. Loading config restores controls only — never re-parses data. (No view toggle in this plan; the editor view ships in 6b.) | Yes | 2026-05-29 |
| TASK-031 | Author public schema docs `docs/config-schema.md` (create `docs/` if absent): every element, type, allowed values, the `version` attribute, and a complete example XML. Link from `README.md`. | Yes | 2026-05-29 |
| TASK-032 | Add `src/lib/config.test.js`: round-trip (`parseConfig(serializeConfig(state))` deep-equals state incl. Sets), version-mismatch rejection, malformed-XML rejection, unknown-element tolerance. | Yes | 2026-05-29 |

## 3. Alternatives

- **ALT-001**: Vercel Python serverless conversion (upload `.rdf`, server returns CSV). **Rejected.** Vercel serverless body cap (~4.5 MB) is exceeded by real CRMMS RDFs; it adds backend infra, cold starts, and cost to a currently zero-backend static SPA, and sends user data off the browser. In-browser JS parsing (Phase 4) avoids all of this. The standalone Python converter is preserved externally as **parasolpy** (PyPI).
- **ALT-002**: Keep RDF conversion in scripts only (original v1.0 plan: `--all-series`, config block, simplified `.bat`). **Superseded** by the in-browser requirement (REQ-004); script work moves to parasolpy.
- **ALT-003**: Store configuration as JSON. **Rejected** — User Note 2.2 requires XML with a publicly documented schema (RiverWare convention).
- **ALT-004**: Config editing via the live left panel only (no dedicated editor). The dedicated no-data editor remains desirable for preset authoring, but **per DR-07 it is deferred to a separate plan (`plan/feat-config-editor.md`)** rather than shipped here — save-from-active-session (load a representative dataset, configure, save, redistribute) already satisfies User Note 2's "set things up in advance," and the editor is best built against the frozen XML schema 6a produces.
- **ALT-005**: Replace the nonlinear `sqrt(N)` styling entirely with direct entry. **Rejected** per User Note 5.3 — direct entry is additive; auto-scaling stays the default.
- **ALT-006**: Auto y-axis label from a hardcoded table only (no units in the data). **Rejected** as brittle; the parser now carries units directly (TASK-017), with the table as a formatting fallback.
- **ALT-007**: Plotly `tickformatstops` instead of a fixed `tickformat`. **Rejected** for simplicity; one `tickformat` per axis covers the requirement.

## 4. Dependencies

- **DEP-001**: Existing runtime stack — React, Plotly.js (`plotly.js-dist-min`, `react-plotly.js`), `papaparse`, `chroma-js`, `xlsx`. No additions required as designed (CON-001 permits them if justified).
- **DEP-002**: Browser-native APIs — `DOMParser`, `XMLSerializer`, `Blob`, `File.text()`, download anchor — for Phases 4 and 6.
- **DEP-003**: `scripts/rdf_parser.py` + `scripts/rdf.py` as the reference implementation the JS port must match (read-only; not modified — CON-002).
- **DEP-004**: Phase 5 depends on Phase 4 (TASK-017 injects `slot`/`units`); the lookup table makes Phase 5 partially functional for CSV inputs lacking units.
- **DEP-005**: Sample RDF fixtures `public/rw-sample-data/sample_traces.rdf`, `sample_subset.rdf` (shared by JS and Python tests).
- **DEP-006**: External — **parasolpy** (PyPI) hosts the maintained standalone Python converter; out of this repo's build.
- **DEP-007**: `vitest` test runner (existing).

## 5. Files

- **FILE-001**: `src/App.jsx` — `tickFormat`, line-style overrides, `applyDataset` convergence, RDF state/handlers, view toggle, `defaultYAxisLabel`, config get/apply. (Phases 1, 2, 4, 5, 6)
- **FILE-002**: `src/components/LabelControls.jsx` — tick-precision selects, manual line-style inputs, bands helper text, y-label placeholder. (Phases 1–3, 5)
- **FILE-003**: `src/components/EnsemblePlot.jsx` — axis `tickformat`, override-aware styling, `yAxisLabel || defaultYAxisLabel`, band visibility tweak. (Phases 1–3, 5)
- **FILE-004**: `src/lib/plotStyle.js` — override precedence in `resolveLineStyling`; `tickFormatString` (or new `src/lib/tickFormat.js`). (Phases 1–2)
- **FILE-005**: `src/lib/rdfParser.js` *(new)* — `parseRdf`, `listSlots`, `rdfToDataset` (JS port). (Phase 4)
- **FILE-006**: `src/lib/csvExport.js` *(new)* — `datasetToWideCsv`, `datasetToStackedCsv`. (Phase 4)
- **FILE-007**: `src/components/FileDropzone.jsx` — accept `.rdf`, slot picker, CSV download. (Phase 4)
- **FILE-008**: `src/lib/slotLabels.js` *(new)* — `SLOT_LABELS`, `deriveYAxisLabel`. (Phase 5)
- **FILE-009**: `src/lib/config.js` *(new)* — `serializeConfig`, `parseConfig`. (Phase 6)
- **FILE-010**: `src/components/ConfigControls.jsx` *(new)* — save/load UI. (Phase 6)
- **FILE-011**: ~~`src/components/ConfigEditor.jsx`~~ — moved to Phase 6b (`plan/feat-config-editor.md`), per DR-07.
- **FILE-012**: `docs/config-schema.md` *(new)* — public XML schema docs. (Phase 6)
- **FILE-013**: `README.md` — link config-schema docs; note in-browser RDF support + parasolpy. (Phases 4, 6)
- **FILE-014**: Test files — `src/lib/plotStyle.test.js` *(new)*, `src/lib/rdfParser.test.js` *(new)*, `src/lib/slotLabels.test.js` *(new)*, `src/lib/config.test.js` *(new)*, `src/components/EnsemblePlot.test.js`, `src/lib/stats.test.js`. (All phases)

## 6. Testing

- **TEST-001**: `tickFormatString` — each option maps to the correct format code; datetime returns no override. (Phase 1)
- **TEST-002**: `resolveLineStyling` overrides — finite overrides returned and clamped; `null` falls through to computed; band reduction still applied to overridden opacity. (Phase 2)
- **TEST-003**: Bands — `EnsemblePlot` produces band traces for a ≥2-member colored group, skips 1-member groups; `computeGroupStats` returns p10 ≤ median ≤ p90 ignoring NaN. (Phase 3)
- **TEST-004**: `rdfParser` — against sample fixtures: slot list/units/scalar flags, timestamp normalization, `rdfToDataset` shape parity with `parseCsvFile`, `slot`/`units` injection; malformed input yields a descriptive error, not a crash. (Phase 4)
- **TEST-005**: `csvExport` — wide and stacked CSV achieve **structural/semantic parity** with the Python reference for a known fixture slot (same column order, same index values, numeric values within epsilon, matching scalar header rows), NOT byte-exact (DR-10). (Phase 4)
- **TEST-006**: `deriveYAxisLabel` — `"Pool Elevation (ft)"` from injected `slot`/`units`, from the lookup table, and `''` fallback; manual `yAxisLabel` precedence verified at the component level. (Phase 5)
- **TEST-007**: `config.js` round-trip — `parseConfig(serializeConfig(state))` deep-equals original (Sets reconstructed); version mismatch and malformed XML rejected with descriptive errors; unknown elements ignored. (Phase 6)
- **TEST-008**: Regression — `parseCsv.test.js`, `labels.test.js`, `palette.test.js`, `stats.test.js` still pass; `applyDataset` refactor does not change CSV/XLSX loading behavior.
- **TEST-009**: Manual verification against `public/crmms-es/res.rdf`: drop RDF → pick a slot → integer year ticks render → manual width/opacity takes effect → bands visibly shade with a color-by → download CSV → save+reload config. (No-data preset authoring is verified in Phase 6b.)

## 7. Risks & Assumptions

- **RISK-001**: `tickformat: 'd'` on a linear axis may interact oddly with non-integer numeric indices. Mitigation: `'auto'` default; precision is opt-in.
- **RISK-002**: Two RDF parsers (JS + parasolpy/Python) risk drift. Mitigation: GUD-002 — port validated against shared sample fixtures; parity assertions in TEST-004/005.
- **RISK-003**: Large RDF files parsed in-browser could stress memory/UI thread. Mitigation: parser is linear single-pass; if needed, parsing can later move to a Web Worker (not in scope). Note current CRMMS file sizes during TASK-016.
- **RISK-004**: XML round-tripping of `Set`-valued state risks drift if state shape changes. Mitigation: versioned root element, single serialize/parse module, round-trip tests (TASK-032).
- **RISK-005**: Loaded config may reference categories/values absent in the current dataset (or none loaded). Mitigation: `applyConfig` guards against missing categories; the dedicated editor uses free-text for data-dependent fields (TASK-029).
- **RISK-006**: *(Resolved by DR-06.)* The "bands bug" is a confirmed defect — dimming fires on the raw `showBands` flag even when no band draws. Fixed by gating dimming on `bandsActive`. TASK-014 UX clarity still ships for the size-1-group case.
- **ASSUMPTION-001**: `rdf_parser.py` exposes per-slot `units` and scalar flags (confirmed in source), so the JS port and y-axis labels need no new parsing concepts.
- **ASSUMPTION-002**: `vitest` executes colocated `*.test.js`/`*.test.jsx`; new tests follow suit.
- **ASSUMPTION-003**: Browser-native `DOMParser` does not resolve external entities by default in target browsers (SEC-001).
- **ASSUMPTION-004**: *(Superseded by DR-03.)* Annual data is NOT assumed Jan-1 — RiverWare annual stamps are often Dec-31 24:00. Annual is detected as "one timestamp per distinct year"; the year-string index then drives integer ticks. Confirm the real CRMMS stamp in TASK-016.
- **ASSUMPTION-005**: The owner's parasolpy package covers the standalone/CLI conversion need, so no in-repo Python enhancement is required.

## 8. Related Specifications / Further Reading

- `scripts/README.md`, `scripts/rdf_parser.py`, `scripts/rdf.py` — reference RDF parsing/conversion the JS port mirrors.
- **parasolpy** (PyPI) — owner-maintained standalone Python RDF converter (external successor to in-repo scripts; RDF functionality not currently published but will come in a future update).
- **pareto-explorer** (owner's GitHub) — pattern reference for the in-browser, data-independent config editor (Phase 6).
- `plan/completed/feature-rdf-python-converter-1.md` — original RDF converter design.
- `plan/completed/feature-label-sorting-filtering-1.md` — established `src/lib/` + `useMemo` patterns reused here.
- `plan/completed/feature-plot-customization-panel-reorg-1.md` — Display/Faceting/Filter panel structure extended in Phases 1–3.
- [Plotly axis `tickformat` (d3-format)](https://plotly.com/javascript/tick-formatting/) — Phase 1 format codes.
- [MDN: DOMParser](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser) / [XMLSerializer](https://developer.mozilla.org/en-US/docs/Web/API/XMLSerializer) — Phase 6 XML APIs.
