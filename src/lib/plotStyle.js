// This module defines styling logic for ensemble line plots.
// Line width and opacity are based on two main factors: the number of lines in the ensemble (lineCount)
// and user preferences for line thickness and opacity (lineStyleControls).
// The styling is designed to maintain readability across a wide range of ensemble sizes, from sparse to dense.

// The model is clamp((SCALE / sqrt(N)) * styleMultiplier, MIN, MAX) for both width and opacity, where:
//
// Runtime/user-controlled inputs:
// - N is the number of lines currently drawn on screen (after filtering/visibility).
// - styleMultiplier is a user-adjustable control for thickness/opacity.
//
// Code-level tuning constants:
// - SCALE controls the overall curve of how width/opacity decrease with line count.
// - MIN and MAX enforce hard limits so values stay within readable bounds.

// Example, for line width with a SCALE of 34, styleMultiplier of 1, and limits of [1.5, 3.2]:
// - N=10   -> 3.2 (clamped)
// - N=100  -> 3.2 (clamped)
// - N=400  -> 1.7
// - N=1000 -> 1.5 (clamped)

const LINE_WIDTH_SCALE = 34
const MIN_LINE_WIDTH = 1.5
const MAX_LINE_WIDTH = 5

const LINE_OPACITY_SCALE = 3
const MIN_LINE_OPACITY = 0.1
const MAX_LINE_OPACITY = 1
export const MIN_BAND_LINE_OPACITY = 0.16
const BAND_OPACITY_SCALE = 0.7

// Style multipliers allow users to adjust line thickness and opacity across the board,
// while still enforcing reasonable limits to prevent extreme values that could harm 
// readability.
export const MIN_STYLE_MULTIPLIER = 0.5
export const MAX_STYLE_MULTIPLIER = 4
export const DEFAULT_STYLE_MULTIPLIER = 1


export function resolveLineStyling(lineCount, showBands, lineStyleControls = {}) {
  // Guard against invalid counts by falling back to 1, avoiding division by zero
  const safeCount = Number.isFinite(lineCount) && lineCount > 0 ? lineCount : 1

  // Clamp user-supplied style multipliers to the allowed [MIN_STYLE_MULTIPLIER,
  // MAX_STYLE_MULTIPLIER] range
  const thicknessMultiplier = getClampedStyleMultiplier(lineStyleControls?.thickness)
  const opacityMultiplier = getClampedStyleMultiplier(lineStyleControls?.opacity)

  // Scale line width inversely with sqrt(N) so denser ensembles use thinner lines,
  // then apply the user thickness multiplier and clamp to the allowed width range
  const width = clamp((LINE_WIDTH_SCALE / Math.sqrt(safeCount)) * thicknessMultiplier, MIN_LINE_WIDTH, MAX_LINE_WIDTH)

  // Scale base opacity inversely with sqrt(N) so denser ensembles are more transparent,
  // then apply the user opacity multiplier and clamp to the allowed opacity range
  const baseOpacity = clamp((LINE_OPACITY_SCALE / Math.sqrt(safeCount)) * opacityMultiplier, MIN_LINE_OPACITY, MAX_LINE_OPACITY)

  // When summary bands are visible, reduce opacity further to avoid obscuring the bands,
  // while enforcing a floor so individual traces remain visible
  const opacity = showBands ? Math.max(MIN_BAND_LINE_OPACITY, baseOpacity * BAND_OPACITY_SCALE) : baseOpacity

  return { lineWidth: width, opacity }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getClampedStyleMultiplier(value) {
  return clamp(value ?? DEFAULT_STYLE_MULTIPLIER, MIN_STYLE_MULTIPLIER, MAX_STYLE_MULTIPLIER)
}
