import { describe, it, expect } from 'vitest'
import { computeGroupStats } from './stats.js'

// Helper: check if a value is NaN (Number.isNaN is strict — does not coerce).
const isNaN = Number.isNaN

describe('computeGroupStats', () => {
  // Three columns, three timesteps with known values.
  // At each timestep: A=10/30/50, B=20/40/60
  const rows = [
    { year: 2020, A: 10, B: 20 },
    { year: 2021, A: 30, B: 40 },
    { year: 2022, A: 50, B: 60 },
  ]

  it('extracts x-axis values from the index column', () => {
    const { x } = computeGroupStats(rows, 'year', ['A', 'B'])
    expect(x).toEqual([2020, 2021, 2022])
  })

  it('computes arithmetic mean per timestep', () => {
    const { mean } = computeGroupStats(rows, 'year', ['A', 'B'])
    // row 0: (10+20)/2=15, row 1: (30+40)/2=35, row 2: (50+60)/2=55
    expect(mean).toEqual([15, 35, 55])
  })

  it('computes median (50th percentile) per timestep', () => {
    const { median } = computeGroupStats(rows, 'year', ['A', 'B'])
    // sorted [10,20]: pos=(2-1)*0.5=0.5 → 10+0.5*(20-10)=15
    expect(median).toEqual([15, 35, 55])
  })

  it('computes requested percentiles per timestep', () => {
    const { percentiles } = computeGroupStats(rows, 'year', ['A', 'B'], [0.1, 0.9])
    // row 0: sorted [10,20], p10 at pos=0.1 → 10+0.1*10=11
    expect(percentiles['0.1'][0]).toBeCloseTo(11)
    expect(percentiles['0.9'][0]).toBeCloseTo(19)
  })

  it('returns NaN for a timestep where all values are NaN', () => {
    const nanRows = [{ year: 2020, A: NaN, B: NaN }]
    const { mean, median } = computeGroupStats(nanRows, 'year', ['A', 'B'])
    expect(isNaN(mean[0])).toBe(true)
    expect(isNaN(median[0])).toBe(true)
  })

  it('ignores NaN values and computes stats from finite values only', () => {
    const mixedRows = [{ year: 2020, A: 10, B: NaN }]
    const { mean } = computeGroupStats(mixedRows, 'year', ['A', 'B'])
    // Only A=10 is finite, so mean = 10/1 = 10
    expect(mean[0]).toBe(10)
  })

  it('returns all-NaN results when groupColumns is empty', () => {
    const { mean } = computeGroupStats(rows, 'year', [])
    expect(mean.every(isNaN)).toBe(true)
  })

  it('includes the correct keys in the percentiles object', () => {
    const { percentiles } = computeGroupStats(rows, 'year', ['A'], [0.1, 0.5, 0.9])
    expect(Object.keys(percentiles)).toEqual(['0.1', '0.5', '0.9'])
  })

  it('maintains p10 <= median <= p90 at every timestep, ignoring NaN', () => {
    const bandRows = [
      { year: 2020, A: 10, B: 20, C: 30, D: 40, E: 50 },
      { year: 2021, A: 5, B: NaN, C: 15, D: NaN, E: 25 }, // mixed NaN
      { year: 2022, A: 100, B: 90, C: 80, D: 70, E: 60 },
    ]
    const { median, percentiles } = computeGroupStats(
      bandRows,
      'year',
      ['A', 'B', 'C', 'D', 'E'],
      [0.1, 0.5, 0.9]
    )
    for (let i = 0; i < bandRows.length; i++) {
      const p10 = percentiles['0.1'][i]
      const p90 = percentiles['0.9'][i]
      expect(Number.isNaN(p10)).toBe(false)
      expect(Number.isNaN(median[i])).toBe(false)
      expect(Number.isNaN(p90)).toBe(false)
      expect(p10).toBeLessThanOrEqual(median[i])
      expect(median[i]).toBeLessThanOrEqual(p90)
    }
  })
})
