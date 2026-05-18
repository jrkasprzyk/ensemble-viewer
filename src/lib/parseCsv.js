import Papa from 'papaparse'

/**
 * Scan a 2-D raw row array and return how many stacked label rows precede the
 * column header row.
 *
 * Strategy: walk from the top; the first row whose first cell looks like a
 * data value (finite number, Date object, numeric string, or date string) is
 * the first *data* row at index i.  The row immediately before it (index i-1)
 * is the column header, so labelRowCount = i - 1.
 *
 * Only cell[0] is inspected — label *values* in the remaining cells may be
 * numeric (e.g. historical years) without affecting detection.
 *
 * @param {Array<Array<unknown>>} raw  2-D array from Papa.parse or XLSX.
 * @returns {number}
 */
export function detectLabelRowCount(raw) {
  for (let i = 0; i < raw.length; i++) {
    const cell = raw[i][0]
    if (cell === '' || cell == null) continue
    // Native number or Date (XLSX parsed types) — definitely a data row.
    if (typeof cell === 'number' || cell instanceof Date) return i > 0 ? i - 1 : 0
    const s = String(cell).trim()
    if (s === '') continue
    if (Number.isFinite(Number(s))) return i > 0 ? i - 1 : 0
    if (!isNaN(new Date(s).getTime())) return i > 0 ? i - 1 : 0
  }
  return 0
}

/**
 * Parse a CSV file with optional stacked header rows for labels.
 *
 * Two modes:
 *   - labelRowCount = null (default): auto-detect from file structure.
 *   - labelRowCount = N: treat exactly N rows as label rows (0 = none).
 *
 * Example with two label rows:
 *   scenario, RCP45,   RCP45,   RCP85,   RCP85      ← label row 1
 *   gcm,      CanESM5, MIROC6,  CanESM5, MIROC6     ← label row 2
 *   year,     run1,    run2,    run3,    run4        ← column header row
 *   2020,     101.2,   99.8,    110.1,   108.4      ← data rows
 *   ...
 *
 * @param {File|{text: () => Promise<string>}} file
 *   A browser File or any object with an async `.text()` method.
 * @param {object} options
 * @param {number|null} options.labelRowCount  Label rows above the header (null = auto-detect).
 *
 * @returns {Promise<{
 *   columns:        string[],
 *   indexColumn:    string,
 *   rows:           object[],
 *   labelsByColumn: Record<string, Record<string, string>>,
 *   labelRowCount:  number
 * }>}
 */
export async function parseCsvFile(file, { labelRowCount = null } = {}) {
  const text = await file.text()

  // Parse the whole file as a 2-D array of raw strings first.
  // We'll re-interpret the header ourselves so we can handle stacked label rows.
  const raw = Papa.parse(text, { skipEmptyLines: true }).data

  const lrc = labelRowCount == null ? detectLabelRowCount(raw) : labelRowCount

  if (raw.length < lrc + 1) {
    throw new Error(
      `CSV has fewer rows than the declared label header rows. ` +
      `Expected at least ${lrc + 1} row(s), got ${raw.length}.`
    )
  }

  // Slice the 2-D array into logical sections.
  const labelRows  = raw.slice(0, lrc)          // [categoryName, val, val, ...]
  const headerRow  = raw[lrc]                    // [indexName, col1, col2, ...]
  const dataRows   = raw.slice(lrc + 1)

  const indexColumn = headerRow[0]
  const columns     = headerRow.slice(1)

  if (columns.length === 0) {
    throw new Error(
      'CSV has no data columns. The file must have at least two columns: ' +
      'one index column (x-axis) and one data column.'
    )
  }

  // Build labelsByColumn from the stacked header rows.
  // Each label row: first cell = category name, remaining cells = per-column values.
  const labelsByColumn = {}
  for (const col of columns) labelsByColumn[col] = {}
  for (const lr of labelRows) {
    const category = lr[0]
    for (let i = 0; i < columns.length; i++) {
      labelsByColumn[columns[i]][category] = String(lr[i + 1] ?? '')
    }
  }

  // Convert each data row into an object keyed by column name.
  // Index column stays as a raw string (could be a date like "2020-01-01").
  // Data columns are coerced to numbers; non-numeric cells become NaN.
  const rows = dataRows.map((r) => {
    const obj = { [indexColumn]: r[0] }
    for (let i = 0; i < columns.length; i++) {
      const v = r[i + 1]
      const num = v === '' || v == null ? NaN : Number(v)
      obj[columns[i]] = Number.isFinite(num) ? num : NaN
    }
    return obj
  })

  // Guard: at least one data column must contain a finite number.
  // This catches the common mistake of loading a labels/sidecar CSV as the
  // main data file — those files are all text and would produce all-NaN traces,
  // which causes confusing behavior in Plotly/WebGL.
  const numericCounts = columns.map((c) =>
    rows.reduce((acc, r) => acc + (Number.isFinite(r[c]) ? 1 : 0), 0)
  )
  if (numericCounts.every((n) => n === 0)) {
    throw new Error(
      'CSV contains no numeric data. If this is a labels/sidecar file, ' +
      'attach it using the sidecar option.'
    )
  }

  return { columns, indexColumn, rows, labelsByColumn, labelRowCount: lrc }
}
