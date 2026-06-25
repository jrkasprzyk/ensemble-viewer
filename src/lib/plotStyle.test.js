import { describe, it, expect } from 'vitest'
import {
  resolveLineStyling,
  tickFormatString,
  escapePlotlyText,
  buildLegendTraces,
  applySelectionHighlight,
  SELECT_DIM_OPACITY,
  MIN_LINE_WIDTH,
  MAX_LINE_WIDTH,
  MIN_LINE_OPACITY,
  MAX_LINE_OPACITY,
} from './plotStyle.js'

describe('escapePlotlyText', () => {
  it('escapes HTML so file-derived text cannot inject links into Plotly sinks', () => {
    expect(escapePlotlyText('<a href="https://evil">x</a>'))
      .toBe('&lt;a href="https://evil"&gt;x&lt;/a&gt;')
    expect(escapePlotlyText('A & B')).toBe('A &amp; B')
  })

  it('leaves % alone by default but doubles it in template mode', () => {
    expect(escapePlotlyText('95% flow')).toBe('95% flow')
    expect(escapePlotlyText('95% flow', { template: true })).toBe('95%% flow')
    expect(escapePlotlyText('%{x}', { template: true })).toBe('%%{x}')
  })

  it('coerces null/undefined to empty string', () => {
    expect(escapePlotlyText(null)).toBe('')
    expect(escapePlotlyText(undefined)).toBe('')
  })
})

describe('buildLegendTraces escaping', () => {
  it('escapes category values used as legend labels', () => {
    const traces = buildLegendTraces({
      colorBy: 'cat',
      resolvedColorMap: { '<b>bold</b>': '#fff' },
      bandsActive: false,
      showPlotLegend: true,
    })
    expect(traces).toHaveLength(1)
    expect(traces[0].name).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })
})

describe('tickFormatString', () => {
  it('maps each numeric precision option to a d3-format code', () => {
    expect(tickFormatString('int', 'numeric')).toBe('d')
    expect(tickFormatString('1', 'numeric')).toBe('.1f')
    expect(tickFormatString('2', 'numeric')).toBe('.2f')
  })

  it('returns empty string for auto / unknown options', () => {
    expect(tickFormatString('auto', 'numeric')).toBe('')
    expect(tickFormatString(undefined, 'numeric')).toBe('')
    expect(tickFormatString('nonsense', 'numeric')).toBe('')
  })

  it('always returns empty string for datetime axes regardless of option', () => {
    expect(tickFormatString('int', 'datetime')).toBe('')
    expect(tickFormatString('2', 'datetime')).toBe('')
    expect(tickFormatString('auto', 'datetime')).toBe('')
  })
})

describe('resolveLineStyling — numeric overrides (DR-04/DR-05)', () => {
  it('returns a finite width override instead of the computed value', () => {
    const computed = resolveLineStyling(100, false, { thickness: 1 })
    const overridden = resolveLineStyling(100, false, { thickness: 1, widthOverride: 4 })
    expect(overridden.lineWidth).toBe(4)
    expect(overridden.lineWidth).not.toBe(computed.lineWidth)
  })

  it('clamps width and opacity overrides to their allowed ranges', () => {
    const tooWide = resolveLineStyling(100, false, { widthOverride: 999 })
    expect(tooWide.lineWidth).toBe(MAX_LINE_WIDTH)
    const tooThin = resolveLineStyling(100, false, { widthOverride: -5 })
    expect(tooThin.lineWidth).toBe(MIN_LINE_WIDTH)

    const tooOpaque = resolveLineStyling(100, false, { opacityOverride: 5 })
    expect(tooOpaque.opacity).toBe(MAX_LINE_OPACITY)
    const tooClear = resolveLineStyling(100, false, { opacityOverride: -1 })
    expect(tooClear.opacity).toBe(MIN_LINE_OPACITY)
  })

  it('null/blank override falls through to the computed value', () => {
    const computed = resolveLineStyling(100, false, { thickness: 1, opacity: 1 })
    const withNulls = resolveLineStyling(100, false, {
      thickness: 1,
      opacity: 1,
      widthOverride: null,
      opacityOverride: null,
    })
    expect(withNulls.lineWidth).toBe(computed.lineWidth)
    expect(withNulls.opacity).toBe(computed.opacity)
  })

  it('does NOT apply the band reduction to an opacity override (absolute, DR-04)', () => {
    const noBands = resolveLineStyling(40, false, { opacityOverride: 0.5 })
    const withBands = resolveLineStyling(40, true, { opacityOverride: 0.5 })
    expect(noBands.opacity).toBe(0.5)
    expect(withBands.opacity).toBe(0.5) // unchanged — override is absolute
  })

  it('still applies the band reduction on the computed opacity path when bandsActive', () => {
    const noBands = resolveLineStyling(40, false)
    const withBands = resolveLineStyling(40, true)
    expect(withBands.opacity).toBeLessThan(noBands.opacity)
  })

  it('treats each dimension independently (width override + opacity auto, and vice versa)', () => {
    const computed = resolveLineStyling(100, false, { thickness: 1, opacity: 1 })

    const widthOnly = resolveLineStyling(100, false, { thickness: 1, opacity: 1, widthOverride: 3 })
    expect(widthOnly.lineWidth).toBe(3)
    expect(widthOnly.opacity).toBe(computed.opacity) // opacity still computed

    const opacityOnly = resolveLineStyling(100, false, { thickness: 1, opacity: 1, opacityOverride: 0.42 })
    expect(opacityOnly.opacity).toBe(0.42)
    expect(opacityOnly.lineWidth).toBe(computed.lineWidth) // width still computed
  })
})

describe('applySelectionHighlight (issue #36)', () => {
  const indiv = (name, width = 1.5) => ({ type: 'scattergl', name, line: { width, color: '#abc' }, opacity: 0.4 })
  const band = () => ({ type: 'scatter', name: 'A p10–p90', line: { width: 0 }, fill: 'tonexty' })
  const columnSet = new Set(['a', 'b', 'c'])

  it('returns the input unchanged when nothing is selected', () => {
    const traces = [indiv('a'), indiv('b')]
    expect(applySelectionHighlight(traces, null, columnSet)).toBe(traces)
  })

  it('dims non-selected individuals and emphasizes the selected one', () => {
    const out = applySelectionHighlight([indiv('a'), indiv('b'), indiv('c')], 'b', columnSet)
    const a = out.find((t) => t.name === 'a')
    const b = out.find((t) => t.name === 'b')
    expect(a.opacity).toBe(SELECT_DIM_OPACITY)
    expect(b.opacity).toBe(1)
    expect(b.line.width).toBeGreaterThan(1.5) // widened
    expect(b.line.width).toBeLessThanOrEqual(MAX_LINE_WIDTH)
  })

  it('draws the selected trace last so WebGL renders it on top', () => {
    const out = applySelectionHighlight([indiv('a'), indiv('b'), indiv('c')], 'a', columnSet)
    const individuals = out.filter((t) => t.type === 'scattergl')
    expect(individuals[individuals.length - 1].name).toBe('a')
  })

  it('leaves bands/legend untouched and after the individuals (fill adjacency)', () => {
    const traces = [indiv('a'), indiv('b'), band()]
    const out = applySelectionHighlight(traces, 'a', columnSet)
    const bandTrace = out.find((t) => t.type === 'scatter')
    expect(bandTrace).toBe(traces[2]) // same ref, unmodified
    expect(out[out.length - 1]).toBe(bandTrace) // still last
  })

  it('does not mutate the original trace objects', () => {
    const traces = [indiv('a'), indiv('b')]
    applySelectionHighlight(traces, 'a', columnSet)
    expect(traces[0].opacity).toBe(0.4)
    expect(traces[0].line.width).toBe(1.5)
  })

  it('returns the input unchanged when the selected column is not drawable', () => {
    const traces = [indiv('a'), indiv('b')]
    expect(applySelectionHighlight(traces, 'zzz', columnSet)).toBe(traces)
  })
})
