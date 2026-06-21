# Ponytail Audit — Over-Engineering Report

**Date:** 2026-06-20
**Scope:** Whole repo. Over-engineering and complexity only — correctness,
security, and performance are out of scope (route those to a normal review).
**Status:** Findings only. Nothing applied.

Findings ranked biggest cut first.

---

## 1. `shrink:` XML config serialization hand-built node-by-node

**File:** `src/lib/config.js` (~388 lines)

`serializeConfig` / `parseConfig` construct and walk an XML DOM element by
element (`createElement`, `appendChild`, `querySelector(':scope > tag')`,
`<parsererror>` detection, per-field clamp helpers). `JSON.stringify` /
`JSON.parse` are native and roughly 5x shorter. Sets serialize as arrays on
write and rehydrate to Sets on read with a small reviver.

**Replacement:** JSON via the platform `JSON` global.

**Tradeoff — read before acting:** XML here is deliberate. It is a versioned,
publicly documented, hand-editable schema (`docs/config-schema.md`, DR-08).
Switching to JSON also deletes that documented contract and changes the saved
config file format for existing users. This is the largest single cut available
but it is a product decision, not a free one.

**Net:** ~-300 lines in `config.js`, plus `docs/config-schema.md`.

---

## 2. `delete:` Dead sample-file helpers

**File:** `src/lib/sampleData.js`

`getSampleFile` and `fetchHostedSample` have zero callers — not in `src/`, not
in `index.html`/`main.jsx`, not even in `sampleData.test.js`.

**Replacement:** nothing. Delete both.

**Net:** ~-13 lines.

---

## 3. `yagni:` Identical one-line example-fetch wrappers

**File:** `src/lib/sampleData.js`

```js
export async function fetchExampleFile(entry)     { return fetchFileAsUpload(entry) }
export async function fetchExampleSidecar(sidecar) { return fetchFileAsUpload(sidecar) }
```

Two named wrappers, one body. Both just delegate to the private
`fetchFileAsUpload`.

**Replacement:** export `fetchFileAsUpload`, call it directly from
`FileDropzone.jsx`. Drop both wrappers.

**Net:** ~-6 lines.

---

## 4. `stdlib:` Hand-rolled RFC-4180 CSV quoting

**File:** `src/lib/csvExport.js`

`csvField` / `csvRow` re-implement RFC-4180 field quoting. `papaparse` is
already a dependency and ships `Papa.unparse`, which does this.

**Replacement:** `Papa.unparse` for the WIDE path (`datasetToWideCsv`). The
STACKED path keeps custom output — its scalar header rows and the
formula-injection guard (`guardFormulaInjection`) don't fit `unparse`'s tabular
model.

**Net:** ~-15 lines (partial — wide only).

---

## 5. `yagni:` `long` / `enriched` CSV formats in the Python CLI

**File:** `scripts/rdf.py`

`csvExport.js` states the `long` / `enriched` formats "stay in the external
parasolpy package" (DR-10), yet `_write_long` and `_write_enriched` are also
implemented here. If the standalone CLI never needs them, drop them; if it does,
note the comment is stale.

**Replacement:** remove `_write_long`, `_write_enriched`, and their `--format`
choices, OR fix the DR-10 comment. Decide which is true.

**Net:** ~-35 lines if removed.

---

## Earns its keep — checked, no cut

- **chroma-js** — real color interpolation in `buildSequentialColorMap`.
  Hand-rolling HCL scales = more code, not less.
- **papaparse / xlsx / plotly** — all pull weight.
- **JS `rdfParser.js` vs Python `rdf_parser.py`** — browser vs CLI, not
  duplication. Two runtimes, one format.
- **3 label strategies** (`labels.js`) — 3 real input sources (names / sidecar /
  headers), not speculative abstraction.
- **`SLOT_LABELS`** (`slotLabels.js`) — domain data table, not over-engineering.

---

## Bottom line

**net: -70 lines easy** (items 2–4, no behavior change, no tradeoff).
**-350 lines** if the XML→JSON config switch (item 1) is accepted.
**-0 deps** — every dependency earns its place.
