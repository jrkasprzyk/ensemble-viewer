/**
 * Per-timestep summary statistics for ensembles of columns, grouped by a label
 * value. This is the "give me a p10-p90 band for RCP85" machinery.
 *
 * All functions ignore NaN values in a timestep.
 */

function quantileSorted(sortedArr, q) {
  if (!sortedArr.length) return NaN
  const pos = (sortedArr.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const a = sortedArr[base]
  const b = sortedArr[base + 1]
  return b === undefined ? a : a + rest * (b - a)
}

/**
 * @param {object[]} rows           parsed data rows, keyed by column name
 * @param {string}   indexColumn    the index (x) column name
 * @param {string[]} groupColumns   the data columns belonging to one group
 * @param {number[]} percentiles    e.g. [0.1, 0.5, 0.9]
 * @returns {{ x: any[], mean: number[], median: number[],
 *             percentiles: Record<string, number[]> }}
 */
export function computeGroupStats(rows, indexColumn, groupColumns, percentiles = [0.1, 0.5, 0.9]) {
  const x = rows.map((r) => r[indexColumn])
  const mean = new Array(rows.length)
  const median = new Array(rows.length)
  const pct = {}
  for (const p of percentiles) pct[String(p)] = new Array(rows.length)

  for (let i = 0; i < rows.length; i++) {
    const vals = []
    for (const c of groupColumns) {
      const v = rows[i][c]
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
    }
    if (!vals.length) {
      mean[i] = NaN
      median[i] = NaN
      for (const p of percentiles) pct[String(p)][i] = NaN
      continue
    }
    const sorted = [...vals].sort((a, b) => a - b)
    const sum = vals.reduce((s, v) => s + v, 0)
    mean[i] = sum / vals.length
    median[i] = quantileSorted(sorted, 0.5)
    for (const p of percentiles) pct[String(p)][i] = quantileSorted(sorted, p)
  }

  return { x, mean, median, percentiles: pct }
}
