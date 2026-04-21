import Papa from 'papaparse'

/**
 * Parse a CSV file with optional stacked header rows for labels.
 *
 * Two modes:
 *   - labelRowCount = 0: first row is column names, rest is data.
 *   - labelRowCount > 0: first N rows are label categories (the first cell of
 *     each row is the category name), the (N+1)th row is column names, and the
 *     rest is data.
 *
 * Example with labelRowCount = 2:
 *   scenario, RCP45,   RCP45,   RCP85,   RCP85
 *   gcm,      CanESM5, MIROC6,  CanESM5, MIROC6
 *   year,     run1,    run2,    run3,    run4
 *   2020,     101.2,   99.8,    110.1,   108.4
 *   ...
 *
 * @returns {{ columns: string[], indexColumn: string, rows: object[],
 *             labelsByColumn: Record<string, Record<string, string>> }}
 */
export async function parseCsvFile(file, { labelRowCount = 0 } = {}) {
  const text = await file.text()
  // We parse twice: first as raw rows to pull off the label header, then as
  // objects with the final header for clean data access.
  const raw = Papa.parse(text, { skipEmptyLines: true }).data

  if (raw.length < labelRowCount + 1) {
    throw new Error('CSV has fewer rows than the declared label header rows.')
  }

  const labelRows = raw.slice(0, labelRowCount) // each: [categoryName, val, val, ...]
  const headerRow = raw[labelRowCount]          // [indexName, col1, col2, ...]
  const dataRows = raw.slice(labelRowCount + 1)

  const indexColumn = headerRow[0]
  const columns = headerRow.slice(1)

  // Build labelsByColumn: { "run1": { scenario: "RCP45", gcm: "CanESM5" }, ... }
  const labelsByColumn = {}
  for (const col of columns) labelsByColumn[col] = {}
  for (const lr of labelRows) {
    const category = lr[0]
    for (let i = 0; i < columns.length; i++) {
      labelsByColumn[columns[i]][category] = String(lr[i + 1] ?? '')
    }
  }

  // Convert data rows into objects keyed by column name, coercing numerics.
  const rows = dataRows.map((r) => {
    const obj = { [indexColumn]: r[0] }
    for (let i = 0; i < columns.length; i++) {
      const v = r[i + 1]
      const num = v === '' || v == null ? NaN : Number(v)
      obj[columns[i]] = Number.isFinite(num) ? num : NaN
    }
    return obj
  })

  // Validate: ensure at least one data column has numeric values. This
  // catches cases where a user accidentally loads a labels/sidecar CSV as
  // the main data file (those files are non-numeric and would produce
  // all-NaN traces that can trigger Plotly/WebGL warnings).
  const numericCounts = columns.map((c) =>
    rows.reduce((acc, r) => acc + (Number.isFinite(r[c]) ? 1 : 0), 0)
  )
  if (numericCounts.every((n) => n === 0)) {
    throw new Error(
      'CSV contains no numeric data. If this is a labels/sidecar file, attach it using the sidecar option.'
    )
  }

  return { columns, indexColumn, rows, labelsByColumn }
}
