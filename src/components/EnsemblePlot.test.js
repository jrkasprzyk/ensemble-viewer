import { describe, it, expect } from 'vitest'
import { MIN_BAND_LINE_OPACITY, resolveLineStyling, buildLegendTraces } from '../lib/plotStyle.js'
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

describe('buildLegendTraces (on-figure colorBy legend)', () => {
  const resolvedColorMap = { Success: '#009E73', Failure: '#D55E00' }

  it('emits exactly one synthetic legend trace per colorMap value when colorBy is set and bands are off', () => {
    const traces = buildLegendTraces({
      colorBy: 'horizon-5yr',
      resolvedColorMap,
      bandsActive: false,
      showPlotLegend: true,
    })
    expect(traces).toHaveLength(2)
    expect(traces.map((t) => t.name)).toEqual(['Success', 'Failure'])
    expect(traces.map((t) => t.line.color)).toEqual(['#009E73', '#D55E00'])
    // Count tracks category cardinality (2), not the number of lines on the plot.
    expect(traces.every((t) => t.showlegend === true)).toBe(true)
  })

  it('plots no data point — x/y are [null] so autorange is unaffected (RISK-001)', () => {
    const [trace] = buildLegendTraces({
      colorBy: 'horizon-5yr',
      resolvedColorMap,
      bandsActive: false,
      showPlotLegend: true,
    })
    expect(trace.x).toEqual([null])
    expect(trace.y).toEqual([null])
  })

  it('emits no traces when colorBy is null', () => {
    expect(
      buildLegendTraces({ colorBy: null, resolvedColorMap, bandsActive: false, showPlotLegend: true })
    ).toEqual([])
  })

  it('emits no traces when bandsActive — band traces already legend per group (avoids double entries)', () => {
    expect(
      buildLegendTraces({ colorBy: 'horizon-5yr', resolvedColorMap, bandsActive: true, showPlotLegend: true })
    ).toEqual([])
  })

  it('emits no traces when the legend is toggled off', () => {
    expect(
      buildLegendTraces({ colorBy: 'horizon-5yr', resolvedColorMap, bandsActive: false, showPlotLegend: false })
    ).toEqual([])
  })
})
