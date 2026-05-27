---
goal: Add unified Classification panel with bundled AND/OR and compact individual scheme UI
version: 1.2
date_created: 2026-05-26
last_updated: 2026-05-26
owner: Joseph Kasprzyk
status: 'Ready'
tags: [feature, labels, classification, filtering]
---

# Introduction

![Status: Ready](https://img.shields.io/badge/status-Ready-green)

When classification files are loaded (e.g. EOWY1, EOWY2, EOWY5), each trace gets a Failure/Success label per time horizon. The current UI shows a repeated Failure/Success block per scheme — noisy and wasteful.

This feature replaces that with two compact sections:

1. **Bundled Classification** — pick horizons + AND/OR logic → derives `_bundled` Failure/Success per trace. Has its own Color radio and Failure/Success filter.
2. **Individual Classifications** — compact table of scheme rows with Color radio per row. Shared Failure/Success filter active only when a scheme is color-selected; grayed out otherwise.

Classification schemes are removed from the standard per-category loop entirely.

**AND mode** (strict): Failure only if ALL selected horizons = Failure.
**OR mode** (broad): Failure if ANY selected horizon = Failure.

---

## Requirements & Constraints

- **REQ-001**: Show a "Bundled Classification" box when classification data loaded. Contains: DESELECT ALL, horizon checkboxes, AND/OR radio, Failure/Success filter checkboxes, Color radio.
- **REQ-002**: Derive `_bundled` label per trace column. OR = Failure if any selected = Failure. AND = Failure only if all selected = Failure. Throw if selected horizon missing from any column.
- **REQ-003**: `_bundled` participates in existing color-by / visibility pipeline without modifying downstream consumers.
- **REQ-004**: Show an "Individual Classifications" box with compact scheme rows (scheme name + Color radio). Shared Failure/Success filter at top — active only when a scheme Color radio is selected.
- **REQ-005**: Semantic colors for `_bundled`: Success = `#009E73`, Failure = `#D55E00`.
- **REQ-006**: When no horizons selected, no `_bundled` injected; bundled filter/color inactive.
- **REQ-007**: Auto-reset `colorBy → null` when `selectedHorizons` empties and `colorBy === '_bundled'`.
- **REQ-008**: Reset `selectedHorizons` (empty Set), `horizonLogic` ('OR'), and `classificationFilter` ({Failure, Success}) when classification data cleared.
- **REQ-009**: Classification scheme categories removed from standard per-category loop.
- **CON-001**: Do not modify `buildVisibleColumnSet`, `summarizeLabels`, or other downstream consumers of `labelsByColumn`.
- **CON-002**: Default: no horizons selected. Individual section: no Color selected on load.

---

## Derived Label Rules

```
OR:  Failure if ANY selected horizon label === 'Failure', else Success
AND: Failure if ALL selected horizon labels === 'Failure', else Success
Missing horizon → throw Error
```

---

## UI Layout

```
┌─────────────────────────────────────────────┐
│ BUNDLED CLASSIFICATION                       │
│ DESELECT ALL                                 │
│ ☑ EOWY1  ☑ EOWY2  ☐ EOWY5  ...            │
│ Logic: ○ AND  ● OR                          │
│ Filter: ☑ Failure  ☑ Success   ○ COLOR      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ INDIVIDUAL CLASSIFICATIONS                   │
│ Filter: ☑ Failure  ☑ Success  (grayed when  │
│                                 none colored)│
│ EOWY1      ○ COLOR                          │
│ EOWY2      ● COLOR                          │
│ EOWY5      ○ COLOR                          │
└─────────────────────────────────────────────┘
```

---

## Implementation

### 1. `src/lib/labels.js` — new exports

```js
export const BUNDLED_CATEGORY = '_bundled'

export function buildBundledLabels(labelsByColumn, selectedHorizons, logic) {
  const out = {}
  for (const [col, labels] of Object.entries(labelsByColumn)) {
    for (const h of selectedHorizons) {
      if (!(h in labels)) throw new Error(`Horizon "${h}" missing from column "${col}"`)
    }
    const vals = selectedHorizons.map(h => labels[h])
    const derived = logic === 'OR'
      ? (vals.includes('Failure') ? 'Failure' : 'Success')
      : (vals.every(v => v === 'Failure') ? 'Failure' : 'Success')
    out[col] = { [BUNDLED_CATEGORY]: derived }
  }
  return out
}
```

### 2. `src/lib/palette.js` — new export

```js
export const BUNDLED_COLOR_MAP = {
  'Success': '#009E73',
  'Failure': '#D55E00',
}
```

### 3. `src/App.jsx` — state, memos, resets

**New state:**
```js
const [selectedHorizons, setSelectedHorizons] = useState(new Set())
const [horizonLogic, setHorizonLogic] = useState('OR')
const [classificationFilter, setClassificationFilter] = useState(new Set(['Failure', 'Success']))
const [bundledFilter, setBundledFilter] = useState(new Set(['Failure', 'Success']))
```

**Extract scheme names:**
```js
const classificationSchemeNames = useMemo(() => {
  if (!rawClassificationsByTrace) return []
  const first = Object.values(rawClassificationsByTrace)[0] || {}
  return Object.keys(first)
}, [rawClassificationsByTrace])
```

**Merged labels — feeds `effectiveLabelsByColumn` (replaces `labelsByColumn` there):**
```js
const mergedLabelsByColumn = useMemo(() => {
  if (!labelsByColumn || !selectedHorizons.size) return labelsByColumn
  const bundled = buildBundledLabels(labelsByColumn, [...selectedHorizons], horizonLogic)
  const out = {}
  for (const col of Object.keys(labelsByColumn)) {
    out[col] = { ...(labelsByColumn[col] || {}), ...(bundled[col] || {}) }
  }
  return out
}, [labelsByColumn, selectedHorizons, horizonLogic])
```

**Wire into pipeline:**
```js
// was: tieLabelCategories(labelsByColumn, ...)
const effectiveLabelsByColumn = useMemo(() =>
  tieLabelCategories(mergedLabelsByColumn, tieCategoryA, tieCategoryB),
  [mergedLabelsByColumn, tieCategoryA, tieCategoryB]
)
```

**`activeByCategory` override for classification schemes** — computed before passing to `buildVisibleColumnSet`. Classification scheme categories get full {Failure, Success} UNLESS they are the current `colorBy`, in which case `classificationFilter` applies. `_bundled` uses `bundledFilter`.

```js
const effectiveActiveByCategory = useMemo(() => {
  if (!classificationSchemeNames.length) return activeByCategory
  const overrides = {}
  for (const scheme of classificationSchemeNames) {
    overrides[scheme] = colorBy === scheme ? classificationFilter : new Set(['Failure', 'Success'])
  }
  if (selectedHorizons.size) {
    overrides[BUNDLED_CATEGORY] = bundledFilter
  }
  return { ...activeByCategory, ...overrides }
}, [activeByCategory, classificationSchemeNames, colorBy, classificationFilter, bundledFilter, selectedHorizons])
```

Pass `effectiveActiveByCategory` to `buildVisibleColumnSet` instead of `activeByCategory`.

**colorMap memo — bundled override:**
```js
const colorMap = useMemo(() => {
  if (!colorBy || !categoryValues[colorBy]) return {}
  if (colorBy === BUNDLED_CATEGORY) return BUNDLED_COLOR_MAP
  // ...existing logic unchanged
}, [colorBy, categoryValues, sortCategory])
```

**Resets:**
- Classification data cleared → reset `selectedHorizons`, `horizonLogic`, `classificationFilter`, `bundledFilter`; if `colorBy` is a scheme name or `_bundled` → reset `colorBy(null)`
- `selectedHorizons` becomes empty + `colorBy === BUNDLED_CATEGORY` → reset `colorBy(null)`

**New props to LabelControls:**
```
classificationSchemeNames,
selectedHorizons, horizonLogic, bundledFilter,
onHorizonToggle, onHorizonDeselectAll, onHorizonLogicChange, onBundledFilterChange,
classificationFilter, onClassificationFilterChange
```

### 4. `src/components/LabelControls.jsx` — two new sections, remove scheme categories from loop

**Per-category loop**: skip categories that are in `classificationSchemeNames` or equal `BUNDLED_CATEGORY` — these render in the new sections instead.

**Bundled section** (shown when `classificationSchemeNames.length > 0`):
- DESELECT ALL link
- Horizon checkboxes
- AND/OR radio
- Failure/Success checkboxes (bundledFilter)
- Color radio (sets `colorBy = BUNDLED_CATEGORY`)

**Individual section** (shown when `classificationSchemeNames.length > 0`):
- Filter row: Failure/Success checkboxes — disabled/grayed when `colorBy` is not a scheme name
- Scheme rows: scheme name + Color radio

### 5. `src/lib/labels.test.js` — new tests

- OR: single horizon Failure → 'Failure'
- OR: multi-horizon any Failure → 'Failure'
- OR: all Success → 'Success'
- AND: all Failure → 'Failure'
- AND: mixed → 'Success'
- AND: all Success → 'Success'
- Edge: empty `selectedHorizons` → empty output `{}`
- Edge: missing horizon → throws Error

---

## Critical Files

| File | Change |
|------|--------|
| `src/lib/labels.js` | Add `BUNDLED_CATEGORY`, `buildBundledLabels` |
| `src/lib/palette.js` | Add `BUNDLED_COLOR_MAP` |
| `src/App.jsx` | New state, `mergedLabelsByColumn`, `effectiveActiveByCategory`, wire into pipeline, colorMap override, resets, new props |
| `src/components/LabelControls.jsx` | Two new classification sections, skip scheme/bundled categories in standard loop |
| `src/lib/labels.test.js` | Tests for `buildBundledLabels` |

---

## Verification

1. `npm test` — new tests pass, existing unchanged
2. Load CRMMS Powell example (9 schemes auto-load)
3. Bundled section appears; individual section appears; no scheme boxes in standard per-category loop
4. Select EOWY1+EOWY2, OR → traces colored Failure/Success with semantic colors
5. Switch AND → stricter reclassification
6. Bundled Color radio → `#009E73`/`#D55E00` applied
7. Uncheck Failure in bundled filter → Failure traces hidden
8. Switch Color to EOWY1 in individual section → colorBy = EOWY1, individual filter activates
9. Uncheck Failure in individual filter → hides EOWY1-Failure traces only
10. Switch Color to EOWY2 → filter now applies to EOWY2; EOWY1 unfiltered
11. Deselect all horizons → bundled disappears, colorBy resets if was bundled
12. Clear classification data → all state resets
