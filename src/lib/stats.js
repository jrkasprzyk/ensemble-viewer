/**
 * Per-timestep summary statistics for ensembles of columns, grouped by a label
 * value. This is the "give me a p10-p90 band for RCP85" machinery.
 *
 * All functions ignore NaN values in a timestep — a timestep where every member
 * is NaN produces NaN output (not 0 or a skewed value).
 *
 * Key concept: "percentile" here means the value below which q*100% of the
 * ensemble members fall at a given timestep, computed by linear interpolation
 * on the sorted values (standard method for small samples).
 */

/**
 * Linear-interpolation percentile on a pre-sorted array.
 * q=0 → min, q=0.5 → median, q=1 → max.
 * Returns NaN for an empty array.
 *
 * @param {number[]} sortedArr  Array already sorted ascending.
 * @param {number}   q          Quantile in [0, 1].
 */
function quantileSorted(sortedArr, q) {
  if (!sortedArr.length) return NaN
  // Map q onto array index space. pos=0 → first element, pos=length-1 → last.
  const pos = (sortedArr.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base          // fractional part — how far between base and base+1
  const a = sortedArr[base]
  const b = sortedArr[base + 1]   // undefined when base is the last index
  return b === undefined ? a : a + rest * (b - a)
}

/**
 * Compute per-timestep statistics for a group of ensemble columns.
 *
 * @param {object[]} rows           Parsed data rows, keyed by column name.
 *                                  Each row is one timestep: { indexCol: x, col1: v1, ... }
 * @param {string}   indexColumn    The name of the x-axis (index) column.
 * @param {string[]} groupColumns   Column names belonging to this group (e.g. all RCP85 runs).
 * @param {number[]} percentiles    Quantiles to compute, e.g. [0.1, 0.5, 0.9].
 *
 * @returns {{
 *   x:           any[],                    // x-axis values (one per row)
 *   mean:        number[],                 // arithmetic mean across members
 *   median:      number[],                 // 50th-percentile value
 *   percentiles: Record<string, number[]>  // keyed by quantile string, e.g. '0.1'
 * }}
 */
export function computeGroupStats(rows, indexColumn, groupColumns, percentiles = [0.1, 0.5, 0.9]) {
  const x = rows.map((r) => r[indexColumn])
  const mean = new Array(rows.length)
  const median = new Array(rows.length)

  // Pre-allocate one output array per requested percentile.
  const pct = {}
  for (const p of percentiles) pct[String(p)] = new Array(rows.length)

  for (let i = 0; i < rows.length; i++) {
    // Collect finite values for this timestep — skip NaN (missing data).
    const vals = []
    for (const c of groupColumns) {
      const v = rows[i][c]
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
    }

    if (!vals.length) {
      // All members missing at this timestep — propagate NaN rather than
      // returning a misleading 0 or skewed statistic.
      mean[i] = NaN
      median[i] = NaN
      for (const p of percentiles) pct[String(p)][i] = NaN
      continue
    }

    const sorted = [...vals].sort((a, b) => a - b)  // copy before sort — sort mutates
    const sum = vals.reduce((s, v) => s + v, 0)
    mean[i] = sum / vals.length
    median[i] = quantileSorted(sorted, 0.5)
    for (const p of percentiles) pct[String(p)][i] = quantileSorted(sorted, p)
  }

  return { x, mean, median, percentiles: pct }
}
