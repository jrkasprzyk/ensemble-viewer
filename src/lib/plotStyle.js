// This module defines styling logic for ensemble line plots.
// Line width and opacity are based on two main factors: the number of lines in the ensemble (lineCount)
// and user preferences for line thickness and opacity (lineStyleControls).
// The styling is designed to maintain readability across a wide range of ensemble sizes, from sparse to dense.

// Width/opacity resolution precedence (per dimension, independent):
//   1. Absolute override — a finite lineStyleControls.widthOverride / opacityOverride wins outright.
//      Overrides are CLAMPED to [MIN_LINE_WIDTH, MAX_LINE_WIDTH] / [MIN_LINE_OPACITY, MAX_LINE_OPACITY]
//      but are otherwise ABSOLUTE: the BAND_OPACITY_SCALE band reduction is NOT applied on this path
//      (DR-04). Each dimension is independent (DR-05) — width may be overridden while opacity stays auto.
//   2. Computed (slider) path — clamp((SCALE / sqrt(N)) * styleMultiplier, MIN, MAX). The band-opacity
//      reduction applies here only when bands are actually drawn (the `bandsActive` argument, DR-06).

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
export const MIN_LINE_WIDTH = 1.5
export const MAX_LINE_WIDTH = 5

const LINE_OPACITY_SCALE = 3
export const MIN_LINE_OPACITY = 0.1
export const MAX_LINE_OPACITY = 1
export const MIN_BAND_LINE_OPACITY = 0.16
const BAND_OPACITY_SCALE = 0.7

// Style multipliers allow users to adjust line thickness and opacity across the board,
// while still enforcing reasonable limits to prevent extreme values that could harm 
// readability.
export const MIN_STYLE_MULTIPLIER = 0.5
export const MAX_STYLE_MULTIPLIER = 4
export const DEFAULT_STYLE_MULTIPLIER = 1


export function resolveLineStyling(lineCount, bandsActive, lineStyleControls = {}) {
  // Guard against invalid counts by falling back to 1, avoiding division by zero
  const safeCount = Number.isFinite(lineCount) && lineCount > 0 ? lineCount : 1

  // Clamp user-supplied style multipliers to the allowed [MIN_STYLE_MULTIPLIER,
  // MAX_STYLE_MULTIPLIER] range
  const thicknessMultiplier = getClampedStyleMultiplier(lineStyleControls?.thickness)
  const opacityMultiplier = getClampedStyleMultiplier(lineStyleControls?.opacity)

  // --- Width ---
  let width
  if (Number.isFinite(lineStyleControls?.widthOverride)) {
    // Absolute override (DR-04/DR-05): clamp only, bypass computed path entirely.
    width = clamp(lineStyleControls.widthOverride, MIN_LINE_WIDTH, MAX_LINE_WIDTH)
  } else {
    // Scale line width inversely with sqrt(N) so denser ensembles use thinner lines,
    // then apply the user thickness multiplier and clamp to the allowed width range
    width = clamp((LINE_WIDTH_SCALE / Math.sqrt(safeCount)) * thicknessMultiplier, MIN_LINE_WIDTH, MAX_LINE_WIDTH)
  }

  // --- Opacity ---
  let opacity
  if (Number.isFinite(lineStyleControls?.opacityOverride)) {
    // Absolute override (DR-04): clamp only. The band-opacity reduction is NOT
    // applied on the override path — overrides are absolute.
    opacity = clamp(lineStyleControls.opacityOverride, MIN_LINE_OPACITY, MAX_LINE_OPACITY)
  } else {
    // Scale base opacity inversely with sqrt(N) so denser ensembles are more transparent,
    // then apply the user opacity multiplier and clamp to the allowed opacity range
    const baseOpacity = clamp((LINE_OPACITY_SCALE / Math.sqrt(safeCount)) * opacityMultiplier, MIN_LINE_OPACITY, MAX_LINE_OPACITY)
    // When summary bands are actually drawn, reduce opacity further to avoid obscuring the
    // bands, while enforcing a floor so individual traces remain visible (DR-06).
    opacity = bandsActive ? Math.max(MIN_BAND_LINE_OPACITY, baseOpacity * BAND_OPACITY_SCALE) : baseOpacity
  }

  return { lineWidth: width, opacity }
}

/**
 * Map a tick-precision option to a d3-format code for Plotly's axis.tickformat.
 *
 * @param {'auto'|'int'|'1'|'2'} option   Precision selection.
 * @param {'numeric'|'datetime'} axisType Axis kind; datetime always yields '' (no override).
 * @returns {string} d3-format code, or '' to let Plotly auto-format.
 */
export function tickFormatString(option, axisType) {
  if (axisType === 'datetime') return ''
  switch (option) {
    case 'int': return 'd'
    case '1': return '.1f'
    case '2': return '.2f'
    case 'auto':
    default: return ''
  }
}

/**
 * Synthetic legend-only traces for the on-figure colorBy legend.
 *
 * Individual column traces carry showlegend:false (a ~500-row legend, one per
 * column, is unusable), so coloring by a category otherwise leaves the figure
 * with no key. Each trace here draws nothing on the canvas — x:[null], y:[null]
 * plots no point and does not affect autorange — but claims one labeled,
 * colored legend row. The count tracks the number of distinct colorBy values
 * (2 for Success/Failure), never the line count.
 *
 * Returns [] when there is no colorBy, the legend is toggled off, or bands are
 * active: the band/mean traces already supply one legend row per group, so
 * emitting these too would double every entry (TASK-009).
 *
 * legendgroup mirrors the individual traces' `g-${value}`, so clicking a legend
 * row toggles every line of that color.
 *
 * @param {object}                 args
 * @param {?string}                args.colorBy
 * @param {Record<string,string>}  args.resolvedColorMap  value → hex
 * @param {boolean}                args.bandsActive
 * @param {boolean}                args.showPlotLegend
 * @returns {object[]} Plotly trace objects (possibly empty).
 */
export function buildLegendTraces({ colorBy, resolvedColorMap, bandsActive, showPlotLegend }) {
  if (!colorBy || !showPlotLegend || bandsActive) return []
  return Object.entries(resolvedColorMap ?? {}).map(([value, color]) => ({
    type: 'scatter',
    mode: 'lines',
    x: [null],
    y: [null],
    name: value || '⟨empty⟩',
    line: { color },
    showlegend: true,
    legendgroup: `g-${value}`,
    hoverinfo: 'skip',
  }))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getClampedStyleMultiplier(value) {
  return clamp(value ?? DEFAULT_STYLE_MULTIPLIER, MIN_STYLE_MULTIPLIER, MAX_STYLE_MULTIPLIER)
}
