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
 * Combine multiple categories into a single tied category.
 *
 * Example:
 *   categories ['year', 'percent']
 *   values { year: '1988', percent: '95' }
 *   -> new category "year + percent" with value "1988 | 95"
 *
 * @param {Record<string, Record<string, string>>} labelsByColumn
 * @param {string[]} categories
 * @returns {Record<string, Record<string, string>>}
 */
export function tieLabelCategories(labelsByColumn, categories = []) {
  const cats = [...new Set(categories.filter(Boolean))]
  if (cats.length < 2) return labelsByColumn

  const tiedName = cats.join(' + ')
  const out = {}

  for (const [col, labels] of Object.entries(labelsByColumn)) {
    const nextLabels = { ...(labels || {}) }
    if (cats.some((cat) => !(cat in nextLabels))) {
      out[col] = labels
      continue
    }
    const tiedValue = cats.map((cat) => nextLabels[cat]).join(' | ')

    for (const cat of cats) delete nextLabels[cat]
    nextLabels[tiedName] = tiedValue
    out[col] = nextLabels
  }

  return out
}

/**
 * Parse a label value as a finite number.
 * Returns Number(value) when finite, null otherwise.
 *
 * @param {string} value
 * @returns {number|null}
 */
export function parseFiniteLabelNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Build sort metadata for a given sort category across all columns.
 *
 * Returns:
 *   sortableValueByColumn   – { [col]: string } raw label value for sortCategory
 *   sortableNumberByColumn  – { [col]: number|null } parsed numeric value (null if non-numeric)
 *   numericDomain           – { min, max } using only finite values, or null if none
 *
 * @param {Record<string, Record<string, string>>} labelsByColumn
 * @param {string} sortCategory
 * @returns {{ sortableValueByColumn: Record<string,string>, sortableNumberByColumn: Record<string,number|null>, numericDomain: {min:number,max:number}|null }}
 */
export function buildSortMetadata(labelsByColumn, sortCategory) {
  const sortableValueByColumn = {}
  const sortableNumberByColumn = {}

  if (!sortCategory) {
    return { sortableValueByColumn, sortableNumberByColumn, numericDomain: null }
  }

  const finiteValues = []
  for (const col of Object.keys(labelsByColumn)) {
    const val = labelsByColumn[col]?.[sortCategory] ?? ''
    sortableValueByColumn[col] = val
    const n = parseFiniteLabelNumber(val)
    sortableNumberByColumn[col] = n
    if (n !== null) finiteValues.push(n)
  }

  const numericDomain = finiteValues.length
    ? { min: Math.min(...finiteValues), max: Math.max(...finiteValues) }
    : null

  return { sortableValueByColumn, sortableNumberByColumn, numericDomain }
}

/**
 * Compute the set of data columns that pass label and numeric range filters.
 *
 * Columns can have different label schemas after categories are tied. A label
 * filter only applies to columns that actually carry that category.
 *
 * @param {object} args
 * @param {string[]} args.columns
 * @param {Record<string, Record<string, string>>} args.labelsByColumn
 * @param {Record<string, string[]>} args.categoryValues
 * @param {Record<string, Set<string>>} args.activeByCategory
 * @param {{min:number,max:number}|null} args.sortRange
 * @param {{min:number,max:number}|null} args.sortNumericDomain
 * @param {Record<string, number|null>} args.sortableNumberByColumn
 * @returns {Set<string>}
 */
export function buildVisibleColumnSet({
  columns,
  labelsByColumn,
  categoryValues,
  activeByCategory,
  sortRange = null,
  sortNumericDomain = null,
  sortableNumberByColumn = {},
}) {
  const cats = Object.keys(categoryValues || {})
  const out = new Set()

  for (const col of columns) {
    const labels = labelsByColumn[col] || {}
    let ok = true

    for (const cat of cats) {
      if (!Object.prototype.hasOwnProperty.call(labels, cat)) continue

      const active = activeByCategory[cat]
      if (!active || !active.has(labels[cat] ?? '')) {
        ok = false
        break
      }
    }

    if (ok && sortRange !== null && sortNumericDomain !== null) {
      const n = sortableNumberByColumn[col]
      if (n === null || n === undefined || n < sortRange.min || n > sortRange.max) ok = false
    }

    if (ok) out.add(col)
  }

  return out
}

// ---------------------------------------------------------------------------
// Classification bundle parsing
// ---------------------------------------------------------------------------

/**
 * Strip common prefix and suffix from a list of basenames to produce short
 * scheme names. Falls back to the full basename when stripping leaves an
 * empty string.
 *
 * @param {string[]} fileNames
 * @returns {string[]}
 */
export function deriveSchemeNames(fileNames) {
  const bases = fileNames.map((n) => n.replace(/\.[^.]+$/, ''))

  function longestCommonPrefix(strs) {
    if (!strs.length) return ''
    let prefix = strs[0]
    for (let i = 1; i < strs.length; i++) {
      while (!strs[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1)
        if (!prefix) return ''
      }
    }
    return prefix
  }

  function longestCommonSuffix(strs) {
    const reversed = strs.map((s) => [...s].reverse().join(''))
    return [...longestCommonPrefix(reversed)].reverse().join('')
  }

  const rawPrefix = longestCommonPrefix(bases)
  // Trim prefix back to last separator so names start at a word boundary.
  const sepIdx = Math.max(rawPrefix.lastIndexOf('_'), rawPrefix.lastIndexOf('-'), rawPrefix.lastIndexOf('.'))
  const prefix = sepIdx >= 0 ? rawPrefix.slice(0, sepIdx + 1) : rawPrefix

  const stripped = bases.map((b) => b.slice(prefix.length))

  const rawSuffix = longestCommonSuffix(stripped)
  const sufSepIdx = Math.max(rawSuffix.indexOf('_'), rawSuffix.indexOf('-'), rawSuffix.indexOf('.'))
  const suffix = sufSepIdx >= 0 ? rawSuffix.slice(sufSepIdx) : rawSuffix

  const result = stripped.map((s) => s.slice(0, s.length - suffix.length))

  return result.map((r, i) => r || bases[i])
}

/**
 * Parse a bundle of classification `.txt` files (CSV format `"TraceNumber","Class"`).
 * Returns a raw map keyed by string trace number.
 *
 * @param {File[]} files
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
export async function parseClassificationBundle(files) {
  const Papa = (await import('papaparse')).default
  const schemeNames = deriveSchemeNames(files.map((f) => f.name))
  const seenNames = new Set()
  for (const name of schemeNames) {
    if (seenNames.has(name))
      throw new Error(`Duplicate scheme name "${name}" derived from file names. Rename files to disambiguate.`)
    seenNames.add(name)
  }
  const rawByTraceNum = {}

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const schemeName = schemeNames[i]
    const text = await file.text()
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    if (!data.length) continue

    const keys = Object.keys(data[0])
    for (const col of ['TraceNumber', 'Class']) {
      if (!keys.includes(col))
        throw new Error(`Classification file "${file.name}" is missing column '${col}'`)
    }

    for (const row of data) {
      const rawTrace = row['TraceNumber']
      if (rawTrace === null || rawTrace === undefined || String(rawTrace).trim() === '') continue
      const traceNum = String(rawTrace)
      if (!rawByTraceNum[traceNum]) rawByTraceNum[traceNum] = {}
      rawByTraceNum[traceNum][schemeName] = String(row['Class'] ?? '')
    }
  }

  return rawByTraceNum
}

/**
 * Map a raw trace-keyed classification map onto data column names.
 * Columns whose name has no numeric suffix, or whose suffix has no entry in
 * `rawByTraceNum`, are omitted from the output.
 *
 * @param {Record<string, Record<string, string>>} rawByTraceNum
 * @param {string[]} columns
 * @returns {Record<string, Record<string, string>>}  labelsByColumn shape
 */
export function applyClassificationMapping(rawByTraceNum, columns) {
  const out = {}
  for (const col of columns) {
    const match = col.match(/(\d+)$/)
    if (!match) continue
    const schemeLabels = rawByTraceNum[match[1]]
    if (!schemeLabels) continue
    out[col] = { ...schemeLabels }
  }
  return out
}

// ---------------------------------------------------------------------------

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
