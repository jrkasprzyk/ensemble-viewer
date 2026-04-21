import * as XLSX from 'xlsx'

/**
 * Parse an XLSX file. Same semantics as parseCsvFile: optional labelRowCount
 * stacked header rows where the first cell of each row is the category name.
 *
 * Reads the first sheet by default.
 */
export async function parseXlsxFile(file, { labelRowCount = 0, sheetName } = {}) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[sheetName ?? wb.SheetNames[0]]
  // defval: '' keeps shape stable even for blank cells
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (raw.length < labelRowCount + 1) {
    throw new Error('Sheet has fewer rows than the declared label header rows.')
  }

  const labelRows = raw.slice(0, labelRowCount)
  const headerRow = raw[labelRowCount]
  const dataRows = raw.slice(labelRowCount + 1)

  const indexColumn = headerRow[0]
  const columns = headerRow.slice(1).map(String)

  const labelsByColumn = {}
  for (const col of columns) labelsByColumn[col] = {}
  for (const lr of labelRows) {
    const category = String(lr[0])
    for (let i = 0; i < columns.length; i++) {
      labelsByColumn[columns[i]][category] = String(lr[i + 1] ?? '')
    }
  }

  const rows = dataRows.map((r) => {
    const obj = { [indexColumn]: r[0] }
    for (let i = 0; i < columns.length; i++) {
      const v = r[i + 1]
      const num = v === '' || v == null ? NaN : Number(v)
      obj[columns[i]] = Number.isFinite(num) ? num : NaN
    }
    return obj
  })

  return { columns, indexColumn, rows, labelsByColumn, sheetNames: wb.SheetNames }
}
