// CSV export for RDF-derived datasets — JS mirror of the Python reference
// _write_wide / _write_stacked_header in scripts/rdf.py.
//
// Per DR-10, only the WIDE and STACKED formats are ported here; the long /
// enriched formats stay in the external parasolpy package.
//
// Both functions take the in-memory dataset produced by rdfToDataset (or
// parseCsvFile) — { columns, indexColumn, rows, labelsByColumn } — and return a
// CSV string. The caller wraps the string in a Blob for download.

// RFC-4180-ish field quoting: quote when the value contains a comma, quote,
// CR or LF; double embedded quotes.
function csvField(value) {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells) {
  return cells.map(csvField).join(',')
}

// Render a data value for output. Finite numbers render via String (NaN/empty
// render as ''), matching the "blank cell" convention of the Python writer.
function renderValue(v) {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  return String(v)
}

// Scalar label categories are the full "Object.Slot" keys injected by
// rdfToDataset, EXCLUDING the Phase-5 'slot'/'units' constants. The Python
// stacked writer emits one header row per scalar slot, named by the portion
// after the first dot.
const INJECTED_CATEGORIES = new Set(['slot', 'units'])

function scalarLabelCategories(dataset) {
  const { columns, labelsByColumn } = dataset
  if (!columns.length) return []
  const firstCol = labelsByColumn[columns[0]] || {}
  return Object.keys(firstCol).filter((cat) => !INJECTED_CATEGORIES.has(cat))
}

/**
 * Wide CSV: header `indexColumn,trace_1,trace_2,...` then one row per timestep.
 * Mirrors Python _write_wide (which hardcodes "date"; here we honor the
 * dataset's actual indexColumn, e.g. "year" for annual data).
 *
 * @param {{columns:string[], indexColumn:string, rows:object[]}} dataset
 * @returns {string}
 */
export function datasetToWideCsv(dataset) {
  const { columns, indexColumn, rows } = dataset
  const lines = []
  lines.push(csvRow([indexColumn, ...columns]))
  for (const row of rows) {
    const cells = [renderValue(row[indexColumn])]
    for (const col of columns) cells.push(renderValue(row[col]))
    lines.push(csvRow(cells))
  }
  return lines.join('\n') + '\n'
}

/**
 * Stacked-header wide CSV: scalar label rows on top, then the column-header row
 * (`indexColumn,trace_1,...`), then the data rows. Mirrors Python
 * _write_stacked_header. The scalar label rows use the slot-name portion (after
 * the first dot) as the row's leading label, matching the reference.
 *
 * @param {{columns:string[], indexColumn:string, rows:object[], labelsByColumn:object}} dataset
 * @returns {string}
 */
export function datasetToStackedCsv(dataset) {
  const { columns, indexColumn, rows, labelsByColumn } = dataset
  const scalarCats = scalarLabelCategories(dataset)
  const lines = []

  for (const cat of scalarCats) {
    const labelName = cat.includes('.') ? cat.slice(cat.indexOf('.') + 1) : cat
    const cells = [labelName]
    for (const col of columns) cells.push(renderValue(labelsByColumn[col]?.[cat] ?? ''))
    lines.push(csvRow(cells))
  }

  lines.push(csvRow([indexColumn, ...columns]))

  for (const row of rows) {
    const cells = [renderValue(row[indexColumn])]
    for (const col of columns) cells.push(renderValue(row[col]))
    lines.push(csvRow(cells))
  }

  return lines.join('\n') + '\n'
}
