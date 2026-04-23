import { describe, it, expect } from 'vitest'
import { buildColorMap, OKABE_ITO, NEUTRAL_GRAY } from './palette.js'

describe('OKABE_ITO', () => {
  it('contains 8 colors', () => {
    expect(OKABE_ITO).toHaveLength(8)
  })

  it('all entries are valid CSS hex colors', () => {
    for (const color of OKABE_ITO) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('NEUTRAL_GRAY', () => {
  it('is a valid CSS hex color', () => {
    expect(NEUTRAL_GRAY).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('buildColorMap', () => {
  it('assigns palette colors in index order', () => {
    const map = buildColorMap(['a', 'b', 'c'])
    expect(map['a']).toBe(OKABE_ITO[0])
    expect(map['b']).toBe(OKABE_ITO[1])
    expect(map['c']).toBe(OKABE_ITO[2])
  })

  it('wraps around when there are more values than palette colors', () => {
    // Create one more value than the palette length to trigger wrap.
    const values = Array.from({ length: OKABE_ITO.length + 1 }, (_, i) => `v${i}`)
    const map = buildColorMap(values)
    // The (length+1)th value (index = OKABE_ITO.length) wraps to index 0.
    expect(map[`v${OKABE_ITO.length}`]).toBe(OKABE_ITO[0])
  })

  it('returns an empty object for an empty input array', () => {
    expect(buildColorMap([])).toEqual({})
  })

  it('assigns every input value a color', () => {
    const values = ['x', 'y', 'z']
    const map = buildColorMap(values)
    for (const v of values) {
      expect(map[v]).toBeDefined()
    }
  })
})
