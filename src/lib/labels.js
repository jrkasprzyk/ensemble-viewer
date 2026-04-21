/**
 * Label parsing strategies.
 *
 * Everything in the app below speaks one data shape:
 *   labelsByColumn: { [columnName]: { [categoryName]: value } }
 *
 * Strategies in this file produce that shape from different input conventions.
 */

/**
 * Parse labels from column names using a delimiter.
 *
 * Example: 'RCP85_CanESM5_runA' with delimiter '_' and
 *          categories ['scenario', 'gcm', 'run']
 *   → { scenario: 'RCP85', gcm: 'CanESM5', run: 'runA' }
 *
 * If categories are not provided, we use positional names 'part1', 'part2', ...
 */
export function parseLabelsFromNames(columns, { delimiter = '_', categories = null } = {}) {
  const out = {}
  for (const col of columns) {
    const parts = col.split(delimiter)
    const cats = categories && categories.length ? categories : parts.map((_, i) => `part${i + 1}`)
    const labels = {}
    for (let i = 0; i < cats.length; i++) {
      labels[cats[i]] = parts[i] ?? ''
    }
    out[col] = labels
  }
  return out
}

/**
 * Parse labels from a sidecar CSV. Expected layout:
 *   column,  scenario, gcm,    run
 *   series1, RCP45,    CanESM5, runA
 *   series2, RCP85,    MIROC6,  runB
 *   ...
 * First column holds the data column names; remaining columns are categories.
 */
export async function parseSidecarLabels(file) {
  const Papa = (await import('papaparse')).default
  const text = await file.text()
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (!data.length) return {}
  const keys = Object.keys(data[0])
  const colKey = keys[0]
  const categoryKeys = keys.slice(1)
  const out = {}
  for (const row of data) {
    const colName = row[colKey]
    if (!colName) continue
    const labels = {}
    for (const ck of categoryKeys) labels[ck] = String(row[ck] ?? '')
    out[colName] = labels
  }
  return out
}

/**
 * Given a labelsByColumn map, return the set of unique categories and, for
 * each category, its unique values.
 */
export function summarizeLabels(labelsByColumn) {
  const categories = new Map() // name -> Set of values
  for (const col of Object.keys(labelsByColumn)) {
    const labels = labelsByColumn[col] || {}
    for (const [cat, val] of Object.entries(labels)) {
      if (!categories.has(cat)) categories.set(cat, new Set())
      categories.get(cat).add(val)
    }
  }
  const out = {}
  for (const [cat, set] of categories) out[cat] = [...set].sort()
  return out
}

/**
 * Auto-detect the index column's nature. Returns 'datetime' | 'numeric'.
 * We inspect the first handful of non-empty values.
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
    // Accept numeric strings as numeric
    if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) {
      numHits++
      continue
    }
    const d = new Date(v)
    if (!isNaN(d.getTime())) dateHits++
  }
  return dateHits > numHits ? 'datetime' : 'numeric'
}
