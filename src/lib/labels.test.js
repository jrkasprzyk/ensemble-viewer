import { describe, it, expect } from 'vitest'
import {
  parseLabelsFromNames,
  seedActiveByCategory,
  summarizeLabels,
  tieLabelCategories,
  detectIndexType,
  parseSidecarLabels,
  parseFiniteLabelNumber,
  parseFiniteLabelNumberForCategoryValue,
  buildSortMetadata,
  buildVisibleColumnSet,
  deriveSchemeNames,
  parseClassificationBundle,
  mergeClassificationBundles,
  applyClassificationMapping,
  buildBundledLabels,
  BUNDLED_CATEGORY,
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
    expect(tieLabelCategories(labelsByColumn, ['Year', 'Year'])).toBe(labelsByColumn)
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
// parseFiniteLabelNumber
// ---------------------------------------------------------------------------
describe('parseFiniteLabelNumber', () => {
  it('parses numeric strings as numbers', () => {
    expect(parseFiniteLabelNumber('80')).toBe(80)
    expect(parseFiniteLabelNumber('95.5')).toBe(95.5)
    expect(parseFiniteLabelNumber('-10')).toBe(-10)
  })

  it('parses actual numbers', () => {
    expect(parseFiniteLabelNumber(102)).toBe(102)
  })

  it('returns null for non-numeric strings', () => {
    expect(parseFiniteLabelNumber('RCP85')).toBeNull()
    expect(parseFiniteLabelNumber('')).toBeNull()
    expect(parseFiniteLabelNumber('abc')).toBeNull()
  })

  it('returns null for Infinity and NaN', () => {
    expect(parseFiniteLabelNumber(Infinity)).toBeNull()
    expect(parseFiniteLabelNumber(-Infinity)).toBeNull()
    expect(parseFiniteLabelNumber(NaN)).toBeNull()
    expect(parseFiniteLabelNumber('Infinity')).toBeNull()
  })

  it('returns null for null and undefined', () => {
    expect(parseFiniteLabelNumber(null)).toBeNull()
    expect(parseFiniteLabelNumber(undefined)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseFiniteLabelNumberForCategoryValue
// ---------------------------------------------------------------------------
describe('parseFiniteLabelNumberForCategoryValue', () => {
  it('parses direct numeric values for non-tied categories', () => {
    expect(parseFiniteLabelNumberForCategoryValue('95', 'Percent', 'Percent')).toBe(95)
  })

  it('parses the targeted numeric segment from tied values', () => {
    const category = 'A + B'
    expect(parseFiniteLabelNumberForCategoryValue('10 | 80', category, 'B')).toBe(80)
    expect(parseFiniteLabelNumberForCategoryValue('10 | 80', category, 'A')).toBe(10)
  })

  it('returns null when targeted tied segment is non-numeric', () => {
    expect(parseFiniteLabelNumberForCategoryValue('10 | high', 'A + B', 'B')).toBeNull()
  })

  it('returns null when tied value has fewer segments than the target category index', () => {
    expect(parseFiniteLabelNumberForCategoryValue('10', 'A + B', 'B')).toBeNull()
  })

  it('handles null and undefined raw values', () => {
    expect(parseFiniteLabelNumberForCategoryValue(null, 'A + B', 'A')).toBeNull()
    expect(parseFiniteLabelNumberForCategoryValue(undefined, 'A + B', 'A')).toBeNull()
  })

  it('falls back to direct parsing when target category is not part of the tied category', () => {
    expect(parseFiniteLabelNumberForCategoryValue('10 | 80', 'A + B', 'C')).toBeNull()
    expect(parseFiniteLabelNumberForCategoryValue('42', 'A + B', 'C')).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// buildSortMetadata
// ---------------------------------------------------------------------------
describe('buildSortMetadata', () => {
  const labelsByColumn = {
    col1: { percent: '80', scenario: 'RCP45' },
    col2: { percent: '95', scenario: 'RCP85' },
    col3: { percent: '102', scenario: 'RCP45' },
  }

  it('returns sortableValueByColumn with raw label values', () => {
    const { sortableValueByColumn } = buildSortMetadata(labelsByColumn, 'percent')
    expect(sortableValueByColumn).toEqual({ col1: '80', col2: '95', col3: '102' })
  })

  it('returns sortableNumberByColumn with parsed numbers', () => {
    const { sortableNumberByColumn } = buildSortMetadata(labelsByColumn, 'percent')
    expect(sortableNumberByColumn).toEqual({ col1: 80, col2: 95, col3: 102 })
  })

  it('computes numericDomain min and max from finite values only', () => {
    const { numericDomain } = buildSortMetadata(labelsByColumn, 'percent')
    expect(numericDomain).toEqual({ min: 80, max: 102 })
  })

  it('returns null for non-numeric category values in sortableNumberByColumn', () => {
    const { sortableNumberByColumn } = buildSortMetadata(labelsByColumn, 'scenario')
    expect(sortableNumberByColumn.col1).toBeNull()
  })

  it('returns numericDomain null when no finite values exist', () => {
    const { numericDomain } = buildSortMetadata(labelsByColumn, 'scenario')
    expect(numericDomain).toBeNull()
  })

  it('returns empty maps and null domain when sortCategory is empty string', () => {
    const result = buildSortMetadata(labelsByColumn, '')
    expect(result.sortableValueByColumn).toEqual({})
    expect(result.sortableNumberByColumn).toEqual({})
    expect(result.numericDomain).toBeNull()
  })

  it('returns empty maps and null domain when sortCategory is absent', () => {
    const result = buildSortMetadata(labelsByColumn)
    expect(result.sortableValueByColumn).toEqual({})
    expect(result.numericDomain).toBeNull()
  })

  it('uses only min and max of finite values (not non-numeric)', () => {
    const mixed = {
      a: { val: '10' },
      b: { val: 'abc' },
      c: { val: '20' },
    }
    const { numericDomain } = buildSortMetadata(mixed, 'val')
    expect(numericDomain).toEqual({ min: 10, max: 20 })
  })
})

// ---------------------------------------------------------------------------
// buildVisibleColumnSet
// ---------------------------------------------------------------------------
describe('buildVisibleColumnSet', () => {
  it('keeps mixed label schemas visible when all present values are active', () => {
    const labelsByColumn = {
      yearOnly: { Year: '1988' },
      percentOnly: { Percent: '95' },
      tied: { 'Year + Percent': '1990 | 102' },
    }
    const result = buildVisibleColumnSet({
      columns: ['yearOnly', 'percentOnly', 'tied'],
      labelsByColumn,
      categoryValues: summarizeLabels(labelsByColumn),
      activeByCategory: {
        Year: new Set(['1988']),
        Percent: new Set(['95']),
        'Year + Percent': new Set(['1990 | 102']),
      },
    })

    expect([...result]).toEqual(['yearOnly', 'percentOnly', 'tied'])
  })

  it('applies label filters only to columns that carry that category', () => {
    const labelsByColumn = {
      yearOnly: { Year: '1988' },
      percentOnly: { Percent: '95' },
      tied: { 'Year + Percent': '1990 | 102' },
    }
    const result = buildVisibleColumnSet({
      columns: ['yearOnly', 'percentOnly', 'tied'],
      labelsByColumn,
      categoryValues: summarizeLabels(labelsByColumn),
      activeByCategory: {
        Year: new Set(),
        Percent: new Set(['95']),
        'Year + Percent': new Set(['1990 | 102']),
      },
    })

    expect([...result]).toEqual(['percentOnly', 'tied'])
  })

  it('ignores a stale sort range when the selected sort category has no numeric domain', () => {
    const labelsByColumn = {
      run1: { scenario: 'RCP45' },
      run2: { scenario: 'RCP85' },
    }
    const result = buildVisibleColumnSet({
      columns: ['run1', 'run2'],
      labelsByColumn,
      categoryValues: summarizeLabels(labelsByColumn),
      activeByCategory: {
        scenario: new Set(['RCP45', 'RCP85']),
      },
      sortRange: { min: 0, max: 1 },
      sortNumericDomain: null,
      sortableNumberByColumn: { run1: null, run2: null },
    })

    expect([...result]).toEqual(['run1', 'run2'])
  })

  it('applies a sort range only while a numeric domain exists', () => {
    const labelsByColumn = {
      run1: { percent: '80' },
      run2: { percent: '95' },
      run3: { percent: '102' },
    }
    const result = buildVisibleColumnSet({
      columns: ['run1', 'run2', 'run3'],
      labelsByColumn,
      categoryValues: summarizeLabels(labelsByColumn),
      activeByCategory: {
        percent: new Set(['80', '95', '102']),
      },
      sortRange: { min: 90, max: 100 },
      sortNumericDomain: { min: 80, max: 102 },
      sortableNumberByColumn: { run1: 80, run2: 95, run3: 102 },
    })

    expect([...result]).toEqual(['run2'])
  })
})

// ---------------------------------------------------------------------------
// deriveSchemeNames
// ---------------------------------------------------------------------------
describe('deriveSchemeNames', () => {
  const NINE_FILES = [
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY1.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY1_20pct.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY1_30pct.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY2.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY2_10pct.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY2_20pct.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY5.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY5_10pct.txt',
    'SE_Oct2025_vTC_Trace_Classes_P3500_EOWY5_20pct.txt',
  ]

  it('derives short scheme names from the 9 CRMMS classification files', () => {
    expect(deriveSchemeNames(NINE_FILES)).toEqual([
      'EOWY1',
      'EOWY1_20pct',
      'EOWY1_30pct',
      'EOWY2',
      'EOWY2_10pct',
      'EOWY2_20pct',
      'EOWY5',
      'EOWY5_10pct',
      'EOWY5_20pct',
    ])
  })

  it('falls back to basename without extension when stripping yields empty', () => {
    const result = deriveSchemeNames(['identical.txt', 'identical.txt'])
    expect(result).toEqual(['identical', 'identical'])
  })

  it('strips extension only for a single file', () => {
    expect(deriveSchemeNames(['myscheme.txt'])).toEqual(['myscheme'])
  })
})

// ---------------------------------------------------------------------------
// parseClassificationBundle
// ---------------------------------------------------------------------------
describe('parseClassificationBundle', () => {
  function fakeFile(name, csvText) {
    return { name, text: () => Promise.resolve(csvText) }
  }

  it('parses two files into a raw trace-keyed map', async () => {
    const f1 = fakeFile('prefix_A.txt', '"TraceNumber","Class"\n1,Success\n2,Failure\n')
    const f2 = fakeFile('prefix_B.txt', '"TraceNumber","Class"\n1,Failure\n2,Success\n')
    const result = await parseClassificationBundle([f1, f2])
    expect(result['1']).toEqual({ A: 'Success', B: 'Failure' })
    expect(result['2']).toEqual({ A: 'Failure', B: 'Success' })
  })

  it('throws when TraceNumber column is missing', async () => {
    const f = fakeFile('scheme.txt', '"ID","Class"\n1,Success\n')
    await expect(parseClassificationBundle([f])).rejects.toThrow(
      'Classification file "scheme.txt" is missing column \'TraceNumber\''
    )
  })

  it('throws when Class column is missing', async () => {
    const f = fakeFile('scheme.txt', '"TraceNumber","Label"\n1,Success\n')
    await expect(parseClassificationBundle([f])).rejects.toThrow(
      'Classification file "scheme.txt" is missing column \'Class\''
    )
  })
})

// ---------------------------------------------------------------------------
// mergeClassificationBundles
// ---------------------------------------------------------------------------
describe('mergeClassificationBundles', () => {
  it('adds newly loaded schemes on top of existing bundle data', () => {
    const existing = {
      '1': { A: 'Success' },
      '2': { A: 'Failure' },
    }
    const next = {
      '1': { B: 'Failure' },
      '3': { B: 'Success' },
    }
    expect(mergeClassificationBundles(existing, next)).toEqual({
      '1': { A: 'Success', B: 'Failure' },
      '2': { A: 'Failure' },
      '3': { B: 'Success' },
    })
  })

  it('throws when adding a scheme name that is already loaded', () => {
    const existing = { '1': { A: 'Success' } }
    const next = { '1': { A: 'Failure' } }
    expect(() => mergeClassificationBundles(existing, next)).toThrow(
      'Scheme "A" is already loaded. Rename the file or clear and reload.'
    )
  })
})

// ---------------------------------------------------------------------------
// applyClassificationMapping
// ---------------------------------------------------------------------------
describe('applyClassificationMapping', () => {
  const raw = {
    '1': { schemeA: 'Success', schemeB: 'Failure' },
    '2': { schemeA: 'Failure', schemeB: 'Success' },
    '99': { schemeA: 'Success', schemeB: 'Success' },
  }

  it('maps trace numbers to columns via numeric suffix', () => {
    const result = applyClassificationMapping(raw, ['trace_1', 'trace_2', 'trace_99'])
    expect(result['trace_1']).toEqual({ schemeA: 'Success', schemeB: 'Failure' })
    expect(result['trace_2']).toEqual({ schemeA: 'Failure', schemeB: 'Success' })
    expect(result['trace_99']).toEqual({ schemeA: 'Success', schemeB: 'Success' })
  })

  it('omits columns with no matching trace number', () => {
    const result = applyClassificationMapping(raw, ['trace_1', 'trace_400'])
    expect(Object.keys(result)).toEqual(['trace_1'])
  })

  it('silently skips columns with no numeric suffix', () => {
    const result = applyClassificationMapping(raw, ['date', 'trace_1'])
    expect(Object.keys(result)).toEqual(['trace_1'])
  })
})

// ---------------------------------------------------------------------------
// buildBundledLabels
// ---------------------------------------------------------------------------
describe('buildBundledLabels', () => {
  const labels = {
    col1: { EOWY1: 'Failure', EOWY2: 'Failure' },
    col2: { EOWY1: 'Success', EOWY2: 'Failure' },
    col3: { EOWY1: 'Success', EOWY2: 'Success' },
  }

  it('OR: single horizon Failure → Failure, Success → Success', () => {
    const result = buildBundledLabels(labels, ['EOWY1'], 'OR')
    expect(result.col1[BUNDLED_CATEGORY]).toBe('Failure')
    expect(result.col3[BUNDLED_CATEGORY]).toBe('Success')
  })

  it('OR: any horizon Failure → Failure', () => {
    const result = buildBundledLabels(labels, ['EOWY1', 'EOWY2'], 'OR')
    expect(result.col1[BUNDLED_CATEGORY]).toBe('Failure')
    expect(result.col2[BUNDLED_CATEGORY]).toBe('Failure')
  })

  it('OR: all Success → Success', () => {
    const result = buildBundledLabels(labels, ['EOWY1', 'EOWY2'], 'OR')
    expect(result.col3[BUNDLED_CATEGORY]).toBe('Success')
  })

  it('AND: all Failure → Failure', () => {
    const result = buildBundledLabels(labels, ['EOWY1', 'EOWY2'], 'AND')
    expect(result.col1[BUNDLED_CATEGORY]).toBe('Failure')
  })

  it('AND: mixed → Success', () => {
    const result = buildBundledLabels(labels, ['EOWY1', 'EOWY2'], 'AND')
    expect(result.col2[BUNDLED_CATEGORY]).toBe('Success')
  })

  it('AND: all Success → Success', () => {
    const result = buildBundledLabels(labels, ['EOWY1', 'EOWY2'], 'AND')
    expect(result.col3[BUNDLED_CATEGORY]).toBe('Success')
  })

  it('empty selectedHorizons → empty output', () => {
    const result = buildBundledLabels(labels, [], 'OR')
    expect(result).toEqual({})
  })

  it('missing horizon → throws Error', () => {
    expect(() => buildBundledLabels(labels, ['EOWY1', 'EOWY3'], 'OR')).toThrow(
      'Horizon "EOWY3" missing from column "col1"'
    )
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

// ---------------------------------------------------------------------------
// seedActiveByCategory — preserves trace filters across RDF slot switches
// ---------------------------------------------------------------------------
describe('seedActiveByCategory', () => {
  it('(a) fresh seed (empty prev) selects all values in every category', () => {
    const categoryValues = { scenario: ['RCP45', 'RCP85'], gcm: ['CanESM5', 'MIROC6'] }
    const next = seedActiveByCategory({}, {}, categoryValues)
    expect(next.scenario).toEqual(new Set(['RCP45', 'RCP85']))
    expect(next.gcm).toEqual(new Set(['CanESM5', 'MIROC6']))
  })

  it('(b) keeps a de-selected value de-selected across an identical value set', () => {
    const prevCategoryValues = { scenario: ['RCP45', 'RCP85'] }
    // User had de-selected RCP45.
    const prevActive = { scenario: new Set(['RCP85']) }
    const next = seedActiveByCategory(prevActive, prevCategoryValues, prevCategoryValues)
    expect(next.scenario).toEqual(new Set(['RCP85']))
  })

  it('(c) a constant category gaining a new value (slot switch) keeps all columns visible', () => {
    // slot changes value on switch: old slot "Inflow" → new slot "Outflow".
    const prevCategoryValues = { slot: ['Inflow'], scenario: ['RCP45', 'RCP85'] }
    const prevActive = { slot: new Set(['Inflow']), scenario: new Set(['RCP85']) }
    const categoryValues = { slot: ['Outflow'], scenario: ['RCP45', 'RCP85'] }
    const next = seedActiveByCategory(prevActive, prevCategoryValues, categoryValues)
    // New slot value auto-selected → no column hidden by the slot category.
    expect(next.slot).toEqual(new Set(['Outflow']))
    // Trace-level de-selection preserved.
    expect(next.scenario).toEqual(new Set(['RCP85']))
  })

  it('(d) a brand-new category selects all of its values', () => {
    const prevCategoryValues = { scenario: ['RCP45', 'RCP85'] }
    const prevActive = { scenario: new Set(['RCP85']) }
    const categoryValues = {
      scenario: ['RCP45', 'RCP85'],
      gcm: ['CanESM5', 'MIROC6'],
    }
    const next = seedActiveByCategory(prevActive, prevCategoryValues, categoryValues)
    expect(next.scenario).toEqual(new Set(['RCP85']))
    expect(next.gcm).toEqual(new Set(['CanESM5', 'MIROC6']))
  })

  it('(e) a removed value drops out cleanly', () => {
    const prevCategoryValues = { scenario: ['RCP45', 'RCP85', 'RCP26'] }
    const prevActive = { scenario: new Set(['RCP45', 'RCP85', 'RCP26']) }
    // RCP26 no longer present.
    const categoryValues = { scenario: ['RCP45', 'RCP85'] }
    const next = seedActiveByCategory(prevActive, prevCategoryValues, categoryValues)
    expect(next.scenario).toEqual(new Set(['RCP45', 'RCP85']))
    expect(next.scenario.has('RCP26')).toBe(false)
  })

  it('selects all when a category exists in prev values but has no prior selection', () => {
    const prevCategoryValues = { scenario: ['RCP45', 'RCP85'] }
    const next = seedActiveByCategory({}, prevCategoryValues, prevCategoryValues)
    expect(next.scenario).toEqual(new Set(['RCP45', 'RCP85']))
  })
})
