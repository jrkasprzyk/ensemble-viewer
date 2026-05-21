/**
 * Okabe-Ito qualitative palette — colorblind-safe, widely used in scientific
 * publications. We cycle if there are more categories than colors.
 *
 * Reference: Okabe & Ito, "Color Universal Design", 2008.
 */
export const OKABE_ITO = [
  '#0072B2', // blue
  '#E69F00', // orange
  '#009E73', // bluish green
  '#CC79A7', // reddish purple
  '#56B4E9', // sky blue
  '#D55E00', // vermillion
  '#F0E442', // yellow
  '#999999', // grey
]

/**
 * Build a stable {value → color} map for a sorted list of category values.
 */
export function buildColorMap(values) {
  const map = {}
  values.forEach((v, i) => {
    map[v] = OKABE_ITO[i % OKABE_ITO.length]
  })
  return map
}

export const NEUTRAL_GRAY = '#9a9894'

import chroma from 'chroma-js'

/**
 * Build a sequential {value → color} map using chroma-js.
 * `values` must be pre-sorted in the desired display order.
 *
 * @param {string[]} values  Sorted array of label strings.
 * @param {string}   scale   chroma-js scale name (default 'YlGnBu').
 * @returns {Record<string, string>}
 */
export function buildSequentialColorMap(values, scale = 'YlGnBu') {
  if (!values.length) return {}
  // Pad 15% off the light end of YlGnBu to avoid near-white (#ffffd9) on light backgrounds.
  // Other scales passed explicitly are used as-is.
  const chromaScale = scale === 'YlGnBu'
    ? chroma.scale(scale).padding([0.15, 0])
    : chroma.scale(scale)
  const colors = chromaScale.colors(values.length)
  const map = {}
  values.forEach((v, i) => { map[v] = colors[i] })
  return map
}
