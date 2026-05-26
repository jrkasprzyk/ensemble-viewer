export const MIN_STYLE_MULTIPLIER = 0.6
export const MAX_STYLE_MULTIPLIER = 1.8
export const DEFAULT_STYLE_MULTIPLIER = 1

// Tuned for legibility across sparse vs dense ensembles:
// - line width decreases with sqrt(N) but remains within [1.2, 2.8]
// - line opacity also decreases with sqrt(N) and is reduced further when
//   summary bands are shown, with a floor to keep traces visible.
const LINE_WIDTH_SCALE = 18
const MIN_LINE_WIDTH = 1.2
const MAX_LINE_WIDTH = 2.8
const LINE_OPACITY_SCALE = 2.2
const MIN_LINE_OPACITY = 0.2
const MAX_LINE_OPACITY = 0.72
export const MIN_BAND_LINE_OPACITY = 0.16
const BAND_OPACITY_SCALE = 0.7

export function resolveLineStyling(lineCount, showBands, lineStyleControls = {}) {
  const safeCount = Number.isFinite(lineCount) && lineCount > 0 ? lineCount : 1
  const thicknessMultiplier = getClampedStyleMultiplier(lineStyleControls?.thickness)
  const opacityMultiplier = getClampedStyleMultiplier(lineStyleControls?.opacity)
  const width = clamp((LINE_WIDTH_SCALE / Math.sqrt(safeCount)) * thicknessMultiplier, MIN_LINE_WIDTH, MAX_LINE_WIDTH)
  const baseOpacity = clamp((LINE_OPACITY_SCALE / Math.sqrt(safeCount)) * opacityMultiplier, MIN_LINE_OPACITY, MAX_LINE_OPACITY)
  const opacity = showBands ? Math.max(MIN_BAND_LINE_OPACITY, baseOpacity * BAND_OPACITY_SCALE) : baseOpacity
  return { lineWidth: width, opacity }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getClampedStyleMultiplier(value) {
  return clamp(value ?? DEFAULT_STYLE_MULTIPLIER, MIN_STYLE_MULTIPLIER, MAX_STYLE_MULTIPLIER)
}
