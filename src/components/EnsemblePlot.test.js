import { describe, it, expect } from 'vitest'
import { MIN_BAND_LINE_OPACITY, resolveLineStyling } from '../lib/plotStyle.js'
import { computeGroupStats } from '../lib/stats.js'

// Mirror of the band-eligibility logic inside EnsemblePlot's useMemo (DR-06):
// group visible columns by colorBy value; only groups with >=2 visible members
// produce a band. bandsActive is true iff at least one such group exists.
function buildBandGroups({ columns, visibleColumns, labelsByColumn, colorBy }) {
  const groups = {}
  if (!colorBy) return groups
  for (const c of columns) {
    if (!visibleColumns.has(c)) continue
    const v = labelsByColumn[c]?.[colorBy] ?? ''
    ;(groups[v] ??= []).push(c)
  }
  return groups
}

describe('resolveLineStyling', () => {
  it('increases line thickness and opacity when fewer lines are visible', () => {
    const sparse = resolveLineStyling(8, false)
    const dense = resolveLineStyling(300, false)

    expect(sparse.lineWidth).toBeGreaterThan(dense.lineWidth)
    expect(sparse.opacity).toBeGreaterThan(dense.opacity)
  })

  it('reduces opacity when summary bands are shown', () => {
    const withoutBands = resolveLineStyling(40, false)
    const withBands = resolveLineStyling(40, true)

    expect(withBands.opacity).toBeLessThan(withoutBands.opacity)
    expect(withBands.opacity).toBeGreaterThanOrEqual(MIN_BAND_LINE_OPACITY)
  })

  it('applies line style multipliers from controls', () => {
    // lineCount=100 keeps base width (1.8) below the cap so boosted (2.7) is distinguishable
    const base = resolveLineStyling(100, false, { thickness: 1, opacity: 1 })
    const boosted = resolveLineStyling(100, false, { thickness: 1.5, opacity: 1.5 })

    expect(boosted.lineWidth).toBeGreaterThan(base.lineWidth)
    expect(boosted.opacity).toBeGreaterThan(base.opacity)
  })

  it('does not dim traces when bands are not actually drawn (DR-06)', () => {
    // bandsActive=false should leave opacity at the un-dimmed computed value.
    const noDim = resolveLineStyling(40, false)
    const dim = resolveLineStyling(40, true)
    expect(noDim.opacity).toBeGreaterThan(dim.opacity)
  })
})

describe('band trace eligibility (DR-06)', () => {
  const rows = [
    { year: 2020, A: 10, B: 20, C: 5 },
    { year: 2021, A: 30, B: 40, C: 7 },
  ]
  const labelsByColumn = {
    A: { scenario: 'wet' },
    B: { scenario: 'wet' },
    C: { scenario: 'dry' },
  }
  const visibleColumns = new Set(['A', 'B', 'C'])

  it('produces a band (>=2 members) for the multi-member group and skips the single-member group', () => {
    const groups = buildBandGroups({
      columns: ['A', 'B', 'C'],
      visibleColumns,
      labelsByColumn,
      colorBy: 'scenario',
    })
    const banded = Object.entries(groups).filter(([, cols]) => cols.length >= 2)
    const skipped = Object.entries(groups).filter(([, cols]) => cols.length < 2)

    expect(banded.map(([v]) => v)).toEqual(['wet'])
    expect(skipped.map(([v]) => v)).toEqual(['dry'])

    // The qualifying group yields finite band stats.
    const { mean, percentiles } = computeGroupStats(rows, 'year', groups['wet'], [0.1, 0.5, 0.9])
    expect(mean[0]).toBe(15) // (10+20)/2
    expect(percentiles['0.1'][0]).toBeLessThanOrEqual(percentiles['0.9'][0])
  })

  it('bandsActive is false when no colored group has >=2 visible traces', () => {
    const groups = buildBandGroups({
      columns: ['A', 'C'], // one member each across two scenarios
      visibleColumns: new Set(['A', 'C']),
      labelsByColumn,
      colorBy: 'scenario',
    })
    const bandsActive = Object.values(groups).some((g) => g.length >= 2)
    expect(bandsActive).toBe(false)
  })
})
