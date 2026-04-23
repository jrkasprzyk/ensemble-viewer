/**
 * Label parsing strategies.
 *
 * "Labels" describe the metadata associated with each data column — things like
 * the climate scenario, GCM model, or run number.  Every part of the app below
 * this layer speaks one data shape:
 *
 *   labelsByColumn: { [columnName]: { [categoryName]: value } }
 *
 * Example:
 *   {
 *     "RCP85_CanESM5_run1": { scenario: "RCP85", gcm: "CanESM5", run: "run1" },
 *     "RCP45_MIROC6_run2":  { scenario: "RCP45", gcm: "MIROC6",  run: "run2" },
 *   }
 *
 * The three strategies below all produce that same shape from different inputs.
 */

/**
 * Parse labels from column names using a delimiter character.
 *
 * Example: 'RCP85_CanESM5_runA' with delimiter '_' and
 *          categories ['scenario', 'gcm', 'run']
 *   → { scenario: 'RCP85', gcm: 'CanESM5', run: 'runA' }
 *
 * If no categories are provided, positional names are used: 'part1', 'part2', …
 * If a column has fewer parts than the category list, the missing parts become ''.
 *
 * @param {string[]} columns     Column names to parse.
 * @param {object}   options
 * @param {string}   options.delimiter   Character to split on (default '_').
 * @param {string[]|null} options.categories  Category names (optional).
 * @returns {Record<string, Record<string, string>>}  labelsByColumn map.
 */
export function parseLabelsFromNames(columns, { delimiter = '_', categories = null } = {}) {
  const out = {}
  for (const col of columns) {
    const parts = col.split(delimiter)
    // Use provided category names, or fall back to "part1", "part2", …
    const cats = categories && categories.length ? categories : parts.map((_, i) => `part${i + 1}`)
    const labels = {}
    for (let i = 0; i < cats.length; i++) {
      // `?? ''` means "use '' if parts[i] is undefined (column has fewer parts than cats)"
      labels[cats[i]] = parts[i] ?? ''
    }
    out[col] = labels
  }
  return out
}

/**
 * Parse labels from a sidecar CSV file. Expected layout:
 *
 *   column,  scenario, gcm,    run
 *   series1, RCP45,    CanESM5, runA
 *   series2, RCP85,    MIROC6,  runB
 *   ...
 *
 * The first column holds data column names; remaining columns are label categories.
 * Rows whose first cell is empty are silently skipped.
 *
 * @param {File} file  A browser File (or any object with a `.text()` async method).
 * @returns {Promise<Record<string, Record<string, string>>>}  labelsByColumn map.
 */
export async function parseSidecarLabels(file) {
  const Papa = (await import('papaparse')).default
  const text = await file.text()
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (!data.length) return {}

  const keys = Object.keys(data[0])
  const colKey = keys[0]           // First CSV column = the data column name
  const categoryKeys = keys.slice(1)  // Remaining columns = label categories

  if (!categoryKeys.length) {
    // Sidecar has no category columns — nothing useful to return.
    return {}
  }

  const out = {}
  for (const row of data) {
    const colName = row[colKey]
    if (!colName) continue  // Skip rows where the column-name cell is blank
    const labels = {}
    for (const ck of categoryKeys) {
      // Convert to string in case the CSV value was parsed as a number
      labels[ck] = String(row[ck] ?? '')
    }
    out[colName] = labels
  }
  return out
}

/**
 * Summarize a labelsByColumn map into the unique values per category.
 *
 * Input:  { run1: { scenario: 'RCP85', gcm: 'CanESM5' }, run2: { scenario: 'RCP45', gcm: 'MIROC6' } }
 * Output: { scenario: ['RCP45', 'RCP85'], gcm: ['CanESM5', 'MIROC6'] }
 *
 * Values are sorted alphabetically so the UI renders consistently.
 *
 * @param {Record<string, Record<string, string>>} labelsByColumn
 * @returns {Record<string, string[]>}
 */
export function summarizeLabels(labelsByColumn) {
  // Use a Map<categoryName, Set<value>> to efficiently accumulate unique values.
  const categories = new Map()
  for (const col of Object.keys(labelsByColumn)) {
    const labels = labelsByColumn[col] || {}
    for (const [cat, val] of Object.entries(labels)) {
      if (!categories.has(cat)) categories.set(cat, new Set())
      categories.get(cat).add(val)
    }
  }
  // Convert Sets to sorted arrays for stable, deterministic UI order.
  const out = {}
  for (const [cat, set] of categories) out[cat] = [...set].sort()
  return out
}

/**
 * Auto-detect whether the index column holds dates or plain numbers.
 * Returns 'datetime' | 'numeric'.
 *
 * Strategy: inspect up to `sampleSize` non-empty values and count how many
 * look like dates vs. numbers.  Whichever wins determines the axis type.
 *
 * @param {object[]} rows         Parsed data rows.
 * @param {string}   indexColumn  Name of the index (x-axis) column.
 * @param {number}   sampleSize   How many rows to inspect (default 10).
 * @returns {'datetime' | 'numeric'}
 */
export function detectIndexType(rows, indexColumn, sampleSize = 10) {
  let dateHits = 0
  let numHits = 0
  let tried = 0

  for (const r of rows) {
    if (tried >= sampleSize) break
    const v = r[indexColumn]
    if (v === '' || v == null) continue
    tried++

    // Numeric check: JS `typeof` catches actual numbers; the second branch
    // catches numeric strings like '2020' while excluding pure-whitespace strings.
    if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) {
      numHits++
      continue
    }

    // Date check: `new Date(v)` returns an invalid date if the string is not
    // date-like; getTime() returns NaN for an invalid date.
    const d = new Date(v)
    if (!isNaN(d.getTime())) dateHits++
  }

  return dateHits > numHits ? 'datetime' : 'numeric'
}
