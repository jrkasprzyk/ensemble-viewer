import { describe, it, expect } from 'vitest'
import { parseCsvFile } from './parseCsv.js'

// Helper: wrap a CSV string in an object that mimics the browser File API.
function makeFile(csvText) {
  return { text: () => Promise.resolve(csvText) }
}

describe('parseCsvFile', () => {
  // ── Happy-path tests ────────────────────────────────────────────────────

  it('parses a simple CSV into columns and rows', async () => {
    const csv = 'year,runA,runB\n2020,100,200\n2021,110,210\n'
    const { columns, indexColumn, rows } = await parseCsvFile(makeFile(csv))
    expect(indexColumn).toBe('year')
    expect(columns).toEqual(['runA', 'runB'])
    expect(rows).toHaveLength(2)
  })

  it('keeps the index column value as a raw string', async () => {
    const csv = 'year,run\n2020,100\n'
    const { rows, indexColumn } = await parseCsvFile(makeFile(csv))
    // Index column is NOT coerced to a number — it may be a date string.
    expect(typeof rows[0][indexColumn]).toBe('string')
    expect(rows[0][indexColumn]).toBe('2020')
  })

  it('coerces numeric strings in data columns to JS numbers', async () => {
    const csv = 'year,run\n2020,42.5\n'
    const { rows } = await parseCsvFile(makeFile(csv))
    expect(typeof rows[0].run).toBe('number')
    expect(rows[0].run).toBe(42.5)
  })

  it('coerces empty cells in data columns to NaN', async () => {
    const csv = 'year,run\n2020,\n2021,5\n'
    const { rows } = await parseCsvFile(makeFile(csv))
    expect(Number.isNaN(rows[0].run)).toBe(true)
    expect(rows[1].run).toBe(5)
  })

  it('parses stacked label rows when labelRowCount > 0', async () => {
    const csv = [
      'scenario,RCP85,RCP45',   // label row (category = 'scenario')
      'year,runA,runB',         // column header row
      '2020,100,200',           // data
    ].join('\n')
    const { columns, labelsByColumn } = await parseCsvFile(makeFile(csv), { labelRowCount: 1 })
    expect(columns).toEqual(['runA', 'runB'])
    expect(labelsByColumn['runA'].scenario).toBe('RCP85')
    expect(labelsByColumn['runB'].scenario).toBe('RCP45')
  })

  it('parses two stacked label rows', async () => {
    const csv = [
      'scenario,RCP85,RCP45',
      'gcm,CanESM5,MIROC6',
      'year,runA,runB',
      '2020,1,2',
    ].join('\n')
    const { labelsByColumn } = await parseCsvFile(makeFile(csv), { labelRowCount: 2 })
    expect(labelsByColumn['runA']).toEqual({ scenario: 'RCP85', gcm: 'CanESM5' })
    expect(labelsByColumn['runB']).toEqual({ scenario: 'RCP45', gcm: 'MIROC6' })
  })

  it('returns empty labelsByColumn when labelRowCount is 0', async () => {
    const csv = 'year,run\n2020,1\n'
    const { labelsByColumn } = await parseCsvFile(makeFile(csv))
    expect(labelsByColumn['run']).toEqual({})
  })

  // ── Error cases ─────────────────────────────────────────────────────────

  it('throws when the file has fewer rows than labelRowCount + 1', async () => {
    // With labelRowCount=2, we need at least 3 rows; this file has only 1.
    const csv = 'scenario,RCP85\n'
    await expect(parseCsvFile(makeFile(csv), { labelRowCount: 2 })).rejects.toThrow()
  })

  it('throws a descriptive error when no data columns are present', async () => {
    const csv = 'year\n2020\n2021\n'
    await expect(parseCsvFile(makeFile(csv))).rejects.toThrow(/no data columns/i)
  })

  it('throws when every data column is non-numeric (e.g. a labels CSV loaded as data)', async () => {
    const csv = 'column,scenario,gcm\nrun1,RCP85,CanESM5\n'
    await expect(parseCsvFile(makeFile(csv))).rejects.toThrow(/no numeric data/i)
  })

  it('does NOT throw when at least one data column has some numeric values', async () => {
    // runA is all-NaN but runB has valid numbers — should succeed.
    const csv = 'year,runA,runB\n2020,foo,100\n'
    await expect(parseCsvFile(makeFile(csv))).resolves.toBeDefined()
  })
})
