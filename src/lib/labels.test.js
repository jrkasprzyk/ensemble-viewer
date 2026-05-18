import { describe, it, expect } from 'vitest'
import {
  parseLabelsFromNames,
  summarizeLabels,
  tieLabelCategories,
  detectIndexType,
  parseSidecarLabels,
} from './labels.js'

// ---------------------------------------------------------------------------
// parseLabelsFromNames
// ---------------------------------------------------------------------------
describe('parseLabelsFromNames', () => {
  it('splits names by delimiter and assigns named categories', () => {
    const result = parseLabelsFromNames(['RCP85_CanESM5_run1'], {
      delimiter: '_',
      categories: ['scenario', 'gcm', 'run'],
    })
    expect(result['RCP85_CanESM5_run1']).toEqual({
      scenario: 'RCP85',
      gcm: 'CanESM5',
      run: 'run1',
    })
  })

  it('assigns positional names ("part1", "part2", …) when no categories given', () => {
    const result = parseLabelsFromNames(['A_B_C'], { delimiter: '_' })
    expect(result['A_B_C']).toEqual({ part1: 'A', part2: 'B', part3: 'C' })
  })

  it('fills with empty string when column has fewer parts than the category list', () => {
    const result = parseLabelsFromNames(['A_B'], {
      delimiter: '_',
      categories: ['x', 'y', 'z'],
    })
    expect(result['A_B']).toEqual({ x: 'A', y: 'B', z: '' })
  })

  it('returns an empty object for an empty column list', () => {
    expect(parseLabelsFromNames([])).toEqual({})
  })

  it('handles a multi-character delimiter', () => {
    const result = parseLabelsFromNames(['foo--bar'], {
      delimiter: '--',
      categories: ['a', 'b'],
    })
    expect(result['foo--bar']).toEqual({ a: 'foo', b: 'bar' })
  })

  it('processes multiple columns independently', () => {
    const result = parseLabelsFromNames(['X_Y', 'A_B'], {
      delimiter: '_',
      categories: ['p', 'q'],
    })
    expect(result['X_Y']).toEqual({ p: 'X', q: 'Y' })
    expect(result['A_B']).toEqual({ p: 'A', q: 'B' })
  })
})

// ---------------------------------------------------------------------------
// summarizeLabels
// ---------------------------------------------------------------------------
describe('summarizeLabels', () => {
  const labelsByColumn = {
    run1: { scenario: 'RCP85', gcm: 'CanESM5' },
    run2: { scenario: 'RCP45', gcm: 'CanESM5' },
    run3: { scenario: 'RCP85', gcm: 'MIROC6' },
  }

  it('returns sorted unique values per category', () => {
    const result = summarizeLabels(labelsByColumn)
    // RCP45 < RCP85 alphabetically
    expect(result.scenario).toEqual(['RCP45', 'RCP85'])
    expect(result.gcm).toEqual(['CanESM5', 'MIROC6'])
  })

  it('deduplicates repeated values (CanESM5 appears in run1 and run2)', () => {
    const result = summarizeLabels(labelsByColumn)
    expect(result.gcm).toHaveLength(2)
  })

  it('returns an empty object for empty input', () => {
    expect(summarizeLabels({})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// tieLabelCategories
// ---------------------------------------------------------------------------
describe('tieLabelCategories', () => {
  it('replaces tied categories with a combined category', () => {
    const labelsByColumn = {
      run1: { Year: '1988', 'Percent of Average': '95' },
      run2: { Year: '1995', 'Percent of Average': '102' },
    }
    const result = tieLabelCategories(labelsByColumn, ['Year', 'Percent of Average'])
    expect(result).toEqual({
      run1: { 'Year + Percent of Average': '1988 | 95' },
      run2: { 'Year + Percent of Average': '1995 | 102' },
    })
  })

  it('returns input unchanged when fewer than two categories are provided', () => {
    const labelsByColumn = { run1: { Year: '1988' } }
    expect(tieLabelCategories(labelsByColumn, ['Year'])).toBe(labelsByColumn)
    expect(tieLabelCategories(labelsByColumn, [])).toBe(labelsByColumn)
  })
})

// ---------------------------------------------------------------------------
// detectIndexType
// ---------------------------------------------------------------------------
describe('detectIndexType', () => {
  it('identifies a numeric (integer) index', () => {
    const rows = [{ year: 2020 }, { year: 2021 }, { year: 2022 }]
    expect(detectIndexType(rows, 'year')).toBe('numeric')
  })

  it('identifies a numeric string index', () => {
    const rows = [{ year: '2020' }, { year: '2021' }]
    expect(detectIndexType(rows, 'year')).toBe('numeric')
  })

  it('identifies an ISO date string index as datetime', () => {
    const rows = [{ date: '2020-01-01' }, { date: '2021-06-15' }]
    expect(detectIndexType(rows, 'date')).toBe('datetime')
  })

  it('skips null and empty values when sampling', () => {
    const rows = [{ year: null }, { year: '' }, { year: 2020 }]
    expect(detectIndexType(rows, 'year')).toBe('numeric')
  })

  it('defaults to numeric when no values can be inspected (all null/empty)', () => {
    const rows = [{ year: null }, { year: '' }]
    // Zero date hits and zero num hits → dateHits (0) > numHits (0) is false → numeric
    expect(detectIndexType(rows, 'year')).toBe('numeric')
  })
})

// ---------------------------------------------------------------------------
// parseSidecarLabels
// ---------------------------------------------------------------------------
describe('parseSidecarLabels', () => {
  // Helper: create a fake File-like object from a CSV string.
  function fakeFile(csvText) {
    return { text: () => Promise.resolve(csvText) }
  }

  it('parses a well-formed sidecar CSV', async () => {
    const csv = 'column,scenario,gcm\nrun1,RCP85,CanESM5\nrun2,RCP45,MIROC6\n'
    const result = await parseSidecarLabels(fakeFile(csv))
    expect(result['run1']).toEqual({ scenario: 'RCP85', gcm: 'CanESM5' })
    expect(result['run2']).toEqual({ scenario: 'RCP45', gcm: 'MIROC6' })
  })

  it('returns an empty object for an empty CSV', async () => {
    const result = await parseSidecarLabels(fakeFile(''))
    expect(result).toEqual({})
  })

  it('skips rows where the column-name cell is blank', async () => {
    const csv = 'column,scenario\n,RCP85\nrun1,RCP45\n'
    const result = await parseSidecarLabels(fakeFile(csv))
    expect(Object.keys(result)).toEqual(['run1'])
  })

  it('returns empty object when sidecar has no category columns', async () => {
    // Only one column → no categories → nothing useful
    const csv = 'column\nrun1\nrun2\n'
    const result = await parseSidecarLabels(fakeFile(csv))
    expect(result).toEqual({})
  })

  it('coerces numeric cell values to strings', async () => {
    const csv = 'column,run_id\nrun1,42\n'
    const result = await parseSidecarLabels(fakeFile(csv))
    expect(result['run1'].run_id).toBe('42')
    expect(typeof result['run1'].run_id).toBe('string')
  })
})
