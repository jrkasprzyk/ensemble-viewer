import Papa from 'papaparse'

/**
 * Parse a CSV file with optional stacked header rows for labels.
 *
 * Two modes:
 *   - labelRowCount = 0: first row is column names, rest is data.
 *   - labelRowCount > 0: the first N rows are label categories (the first cell
 *     of each row is the category name), the (N+1)th row is column names, and
 *     the rest is data.
 *
 * Example with labelRowCount = 2:
 *   scenario, RCP45,   RCP45,   RCP85,   RCP85      ← label row 1
 *   gcm,      CanESM5, MIROC6,  CanESM5, MIROC6     ← label row 2
 *   year,     run1,    run2,    run3,    run4        ← column header row
 *   2020,     101.2,   99.8,    110.1,   108.4      ← data rows
 *   ...
 *
 * @param {File|{text: () => Promise<string>}} file
 *   A browser File or any object with an async `.text()` method.
 * @param {object} options
 * @param {number} options.labelRowCount  Number of stacked label rows (default 0).
 *
 * @returns {Promise<{
 *   columns:        string[],                               // data column names (excludes index col)
 *   indexColumn:    string,                                 // name of the x-axis column
 *   rows:           object[],                              // one object per data row
 *   labelsByColumn: Record<string, Record<string, string>> // metadata per column
 * }>}
 */
export async function parseCsvFile(file, { labelRowCount = 0 } = {}) {
  const text = await file.text()

  // Parse the whole file as a 2-D array of raw strings first.
  // We'll re-interpret the header ourselves so we can handle stacked label rows.
  const raw = Papa.parse(text, { skipEmptyLines: true }).data

  if (raw.length < labelRowCount + 1) {
    throw new Error(
      `CSV has fewer rows than the declared label header rows. ` +
      `Expected at least ${labelRowCount + 1} row(s), got ${raw.length}.`
    )
  }

  // Slice the 2-D array into logical sections.
  const labelRows  = raw.slice(0, labelRowCount)          // [categoryName, val, val, ...]
  const headerRow  = raw[labelRowCount]                    // [indexName, col1, col2, ...]
  const dataRows   = raw.slice(labelRowCount + 1)

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

  return { columns, indexColumn, rows, labelsByColumn }
}
