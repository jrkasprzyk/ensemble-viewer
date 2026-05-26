import { describe, it, expect } from 'vitest'
import { MIN_BAND_LINE_OPACITY, resolveLineStyling } from './EnsemblePlot.jsx'

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
})
