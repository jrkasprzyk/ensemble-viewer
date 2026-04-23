import * as XLSX from 'xlsx'

/**
 * Parse an XLSX (or XLS) file. Same semantics as parseCsvFile: optional
 * `labelRowCount` stacked header rows where the first cell of each row is the
 * category name.
 *
 * Reads the first sheet by default; pass `sheetName` to target another sheet.
 *
 * @param {File|{arrayBuffer: () => Promise<ArrayBuffer>}} file
 *   A browser File or any object with an async `.arrayBuffer()` method.
 * @param {object} options
 * @param {number} options.labelRowCount  Number of stacked label rows (default 0).
 * @param {string} [options.sheetName]    Sheet to read (default: first sheet).
 *
 * @returns {Promise<{
 *   columns:        string[],
 *   indexColumn:    string,
 *   rows:           object[],
 *   labelsByColumn: Record<string, Record<string, string>>,
 *   sheetNames:     string[]   // all sheet names in the workbook
 * }>}
 */
export async function parseXlsxFile(file, { labelRowCount = 0, sheetName } = {}) {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(buf, { type: 'array' })
  const ws  = wb.Sheets[sheetName ?? wb.SheetNames[0]]

  // `header: 1` → returns a 2-D array (like CSV).
  // `defval: ''` → ensures blank cells are '' rather than undefined, keeping
  //   row lengths consistent and preventing index-out-of-bounds access below.
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (raw.length < labelRowCount + 1) {
    throw new Error(
      `Sheet has fewer rows than the declared label header rows. ` +
      `Expected at least ${labelRowCount + 1} row(s), got ${raw.length}.`
    )
  }

  const labelRows  = raw.slice(0, labelRowCount)
  const headerRow  = raw[labelRowCount]
  const dataRows   = raw.slice(labelRowCount + 1)

  const indexColumn = headerRow[0]
  // XLSX cells can be numbers (e.g. a column named "2020"); coerce to string.
  const columns = headerRow.slice(1).map(String)

  if (columns.length === 0) {
    throw new Error(
      'Sheet has no data columns. The file must have at least two columns: ' +
      'one index column (x-axis) and one data column.'
    )
  }

  // Build labelsByColumn from stacked header rows (same logic as parseCsvFile).
  const labelsByColumn = {}
  for (const col of columns) labelsByColumn[col] = {}
  for (const lr of labelRows) {
    const category = String(lr[0])
    for (let i = 0; i < columns.length; i++) {
      labelsByColumn[columns[i]][category] = String(lr[i + 1] ?? '')
    }
  }

  // Convert data rows to objects; coerce data cells to numbers (NaN if blank).
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
  // Prevents confusing all-NaN traces from accidentally loading a label-only sheet.
  const numericCounts = columns.map((c) =>
    rows.reduce((acc, r) => acc + (Number.isFinite(r[c]) ? 1 : 0), 0)
  )
  if (numericCounts.every((n) => n === 0)) {
    throw new Error(
      'Sheet contains no numeric data. If this is a labels file, ' +
      'attach it using the sidecar option.'
    )
  }

  return { columns, indexColumn, rows, labelsByColumn, sheetNames: wb.SheetNames }
}
