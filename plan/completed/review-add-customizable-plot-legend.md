# Review: copilot/add-customizable-plot-legend

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

## App.jsx

`L131-139`: 🔴 bug: `tieCategoryA`/`tieCategoryB` not reset when `categoryValues` changes. Loading new file with different schema silently keeps stale tie values → `tieLabelCategories` ties nonexistent categories, deletes valid ones from new data. Add:
```js
if (tieCategoryA && !baseCategoryValues[tieCategoryA]) setTieCategoryA('')
if (tieCategoryB && !baseCategoryValues[tieCategoryB]) setTieCategoryB('')
```
(use `baseCategoryValues`, not `categoryValues`, since tie cats come from pre-tie options)

`L157-169`: 🟡 risk: `plotGroups` uses full `columns` array, not `Array.from(visibleColumns)`. Split groups can render subplots containing zero visible traces (all filtered out) with a title but blank chart. Not a crash, but confusing. Filter: `columns: columns.filter((c) => visibleColumns.has(c) && ...)`.

## FileDropzone.jsx

`L63-64`: 🟡 risk: fetch error silently swallowed — `console.error` only. User sees spinner disappear, no feedback. Set an error state or propagate via a callback.

`L8-10`: 🔵 nit: `useEffect(() => { mountedRef.current = true; ... }, [])` — `useRef(true)` already initializes to `true`; the assignment in the effect body is redundant.

## labels.js

`tieLabelCategories`: 🟡 risk: both source categories deleted from `nextLabels` even when one doesn't exist in that column. A column missing `tieCategoryB` still loses `tieCategoryA` (valid label deleted, replaced with `"realVal | "`). Could guard: skip the tie (or warn) if any `cats` key is absent from `labels`.

## LabelControls.jsx

Tie selects: 🟡 risk: user can pick `tieCategoryA === tieCategoryB`. `tieLabelCategories` dedupes via `new Set(categories.filter(Boolean))` → `cats.length < 2` → returns input unchanged silently. No UI feedback. Consider disabling the matching option in each select, or showing a hint.
