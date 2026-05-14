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
