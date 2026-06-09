import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRdf, rdfToDataset } from './rdfParser.js'
import { datasetToWideCsv, datasetToStackedCsv } from './csvExport.js'

const samplesDir = fileURLToPath(new URL('../../public/rw-sample-data/', import.meta.url))
const TRACES = readFileSync(samplesDir + 'sample_traces.rdf', 'utf-8')

const rdf = parseRdf(TRACES)
const dataset = rdfToDataset(rdf, 'Example Reservoir.Pool Elevation')

function parse(csv) {
  return csv.trimEnd().split('\n').map((line) => line.split(','))
}

describe('datasetToWideCsv', () => {
  const rows = parse(datasetToWideCsv(dataset))

  it('emits the index header then one trace column per run (parity with _write_wide)', () => {
    expect(rows[0]).toEqual(['date', 'trace_1', 'trace_2', 'trace_3'])
  })

  it('emits one row per timestep with the ISO date and numeric values', () => {
    expect(rows).toHaveLength(6) // header + 5 data rows
    expect(rows[1][0]).toBe('2024-01-01')
    expect(Number(rows[1][1])).toBeCloseTo(1100.0)
    expect(Number(rows[1][3])).toBeCloseTo(1098.0)
  })
})

describe('formula-injection guard', () => {
  const hostile = {
    columns: ['t1'],
    indexColumn: 'date',
    rows: [{ date: '2024-01-01', t1: -12.5 }],
    labelsByColumn: { t1: { 'Obj.Note': '=HYPERLINK("https://evil")', 'Obj.Plus': '+1+cmd' } },
  }

  it('prefixes non-numeric =/+ cells with a quote in stacked label rows', () => {
    const rows = parse(datasetToStackedCsv(hostile))
    expect(rows[0][1]).toBe(`"'=HYPERLINK(""https://evil"")"`)
    expect(rows[1][1]).toBe(`'+1+cmd`)
  })

  it('leaves negative numbers untouched', () => {
    const rows = parse(datasetToWideCsv(hostile))
    expect(rows[1][1]).toBe('-12.5')
  })
})

describe('datasetToStackedCsv', () => {
  const rows = parse(datasetToStackedCsv(dataset))

  it('emits scalar label rows on top, named by the slot-name portion (parity with _write_stacked_header)', () => {
    expect(rows[0][0]).toBe('Trace Historical Year')
    expect(rows[0].slice(1)).toEqual(['1988', '1995', '2003'])
    expect(rows[1][0]).toBe('Historical Year Percent of Average')
    expect(rows[1].slice(1)).toEqual(['95', '102', '88.5'])
  })

  it('excludes the injected slot/units categories from the header rows', () => {
    const leadLabels = rows.map((r) => r[0])
    expect(leadLabels).not.toContain('slot')
    expect(leadLabels).not.toContain('units')
  })

  it('emits the column-header row then the data rows', () => {
    expect(rows[2]).toEqual(['date', 'trace_1', 'trace_2', 'trace_3'])
    expect(rows[3][0]).toBe('2024-01-01')
    expect(Number(rows[3][1])).toBeCloseTo(1100.0)
  })
})
