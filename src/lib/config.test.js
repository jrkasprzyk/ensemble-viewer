// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { serializeConfig, parseConfig, DEFAULT_CONFIG } from './config.js'

// A representative non-default full state (TASK-032 round-trip).
function sampleState() {
  return {
    labelStrategy: 'headers',
    delimiter: '-',
    categoriesText: 'RCP,Model,Run',
    activeByCategory: {
      RCP: new Set(['RCP45', 'RCP85']),
      Model: new Set(['CanESM5']),
    },
    colorBy: 'RCP',
    showBands: true,
    xAxisLabel: 'year',
    yAxisLabel: 'Pool Elevation (ft)',
    lineStyleControls: {
      thickness: 1.5,
      opacity: 2,
      widthOverride: 3,
      opacityOverride: 0.4,
    },
    tickFormat: { x: 'int', y: '2' },
    axisRanges: { xMin: '2020', xMax: '2050', yMin: '', yMax: '1200' },
    splitBy: 'Model',
    tieCategoryA: 'RCP',
    tieCategoryB: 'Model',
    sortCategory: 'Run',
    sortRange: { min: 1, max: 10 },
    selectedHorizons: new Set(['nearTerm', 'midTerm']),
    horizonLogic: 'AND',
    bundledFilter: new Set(['Failure']),
    classificationFilter: new Set(['Success', 'Failure']),
  }
}

describe('serializeConfig / parseConfig round-trip', () => {
  it('round-trips a full state with Sets reconstructed', () => {
    const state = sampleState()
    const xml = serializeConfig(state)
    const parsed = parseConfig(xml)
    expect(parsed).toEqual(state)
    // Sets must be real Sets, not arrays.
    expect(parsed.activeByCategory.RCP).toBeInstanceOf(Set)
    expect(parsed.selectedHorizons).toBeInstanceOf(Set)
    expect(parsed.bundledFilter).toBeInstanceOf(Set)
    expect(parsed.classificationFilter).toBeInstanceOf(Set)
  })

  it('round-trips the DEFAULT_CONFIG', () => {
    const xml = serializeConfig(DEFAULT_CONFIG)
    const parsed = parseConfig(xml)
    // Empty activeByCategory is omitted from serialization (overlaid on default).
    expect(parsed.labelStrategy).toBe('names')
    expect(parsed.lineStyleControls).toEqual({
      thickness: 1,
      opacity: 1,
      widthOverride: null,
      opacityOverride: null,
    })
    expect(parsed.tickFormat).toEqual({ x: 'auto', y: 'auto' })
    expect(parsed.bundledFilter).toEqual(new Set(['Failure', 'Success']))
    expect(parsed.horizonLogic).toBe('OR')
    expect(parsed.showBands).toBe(false)
  })

  it('produces a versioned root element', () => {
    const xml = serializeConfig(sampleState())
    expect(xml).toContain('<ensembleViewerConfig version="1">')
  })

  it('emits null overrides as no value (parsed back to null)', () => {
    const state = { ...DEFAULT_CONFIG }
    const parsed = parseConfig(serializeConfig(state))
    expect(parsed.lineStyleControls.widthOverride).toBeNull()
    expect(parsed.lineStyleControls.opacityOverride).toBeNull()
  })
})

describe('parseConfig — DR-08 version handling', () => {
  it('rejects a missing root element', () => {
    expect(() => parseConfig('<somethingElse version="1"/>')).toThrow(/root element/i)
  })

  it('rejects a mismatched version with a descriptive error', () => {
    expect(() => parseConfig('<ensembleViewerConfig version="2"/>')).toThrow(/version/i)
  })

  it('rejects a missing version attribute', () => {
    expect(() => parseConfig('<ensembleViewerConfig/>')).toThrow(/version/i)
  })

  it('accepts exactly version="1"', () => {
    expect(() => parseConfig('<ensembleViewerConfig version="1"/>')).not.toThrow()
  })
})

describe('parseConfig — SEC-001 malformed input', () => {
  it('rejects malformed XML with a descriptive error (does not crash)', () => {
    expect(() => parseConfig('<ensembleViewerConfig version="1"><colorBy>')).toThrow(/valid xml|malformed/i)
  })

  it('rejects empty / non-string input', () => {
    expect(() => parseConfig('')).toThrow()
    expect(() => parseConfig('   ')).toThrow()
    expect(() => parseConfig(null)).toThrow()
  })
})

describe('parseConfig — forward tolerance & validation', () => {
  it('ignores unknown elements', () => {
    const xml =
      '<ensembleViewerConfig version="1">' +
      '<colorBy>RCP</colorBy>' +
      '<futureFeature>whatever</futureFeature>' +
      '<nested><deep>x</deep></nested>' +
      '</ensembleViewerConfig>'
    const parsed = parseConfig(xml)
    expect(parsed.colorBy).toBe('RCP')
    expect(parsed).not.toHaveProperty('futureFeature')
    expect(parsed).not.toHaveProperty('nested')
  })

  it('clamps an out-of-range width override (SEC-002)', () => {
    const xml =
      '<ensembleViewerConfig version="1">' +
      '<lineStyleControls><widthOverride>999</widthOverride></lineStyleControls>' +
      '</ensembleViewerConfig>'
    const parsed = parseConfig(xml)
    expect(parsed.lineStyleControls.widthOverride).toBe(5) // MAX_LINE_WIDTH
  })

  it('rejects a negative / non-finite numeric override (SEC-002)', () => {
    const xml =
      '<ensembleViewerConfig version="1">' +
      '<lineStyleControls>' +
      '<widthOverride>-3</widthOverride>' +
      '<opacityOverride>NaN</opacityOverride>' +
      '</lineStyleControls>' +
      '</ensembleViewerConfig>'
    const parsed = parseConfig(xml)
    // -3 clamps up to MIN_LINE_WIDTH (1.5); NaN → null (auto).
    expect(parsed.lineStyleControls.widthOverride).toBe(1.5)
    expect(parsed.lineStyleControls.opacityOverride).toBeNull()
  })

  it('drops a sortRange with non-finite bounds', () => {
    const xml =
      '<ensembleViewerConfig version="1">' +
      '<sortRange><min>Infinity</min><max>5</max></sortRange>' +
      '</ensembleViewerConfig>'
    const parsed = parseConfig(xml)
    expect(parsed).not.toHaveProperty('sortRange')
  })
})
