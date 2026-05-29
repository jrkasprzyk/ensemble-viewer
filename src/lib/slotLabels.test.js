import { describe, it, expect } from 'vitest'
import { SLOT_LABELS, deriveYAxisLabel, formatSlotLabel } from './slotLabels.js'

// Build a labelsByColumn map where every column carries the same injected
// label categories (mirrors what rdfToDataset produces).
function withLabels(columns, labels) {
  const out = {}
  for (const col of columns) out[col] = { ...labels }
  return out
}

describe('SLOT_LABELS', () => {
  it('maps known slot names to label + units', () => {
    expect(SLOT_LABELS['Pool Elevation']).toEqual({ label: 'Pool Elevation', units: 'ft' })
    expect(SLOT_LABELS.Storage).toEqual({ label: 'Storage', units: 'acre-ft' })
    expect(SLOT_LABELS.Inflow.units).toBe('cfs')
    expect(SLOT_LABELS.Outflow.units).toBe('cfs')
    expect(SLOT_LABELS.Energy.units).toBe('MWh')
    expect(SLOT_LABELS.Evaporation.units).toBe('acre-ft')
    expect(SLOT_LABELS.Spill.units).toBe('cfs')
  })
})

describe('deriveYAxisLabel', () => {
  const columns = ['trace_1', 'trace_2']

  it('formats from injected slot + units', () => {
    const lbc = withLabels(columns, { slot: 'Pool Elevation', units: 'ft' })
    expect(deriveYAxisLabel(lbc, columns)).toBe('Pool Elevation (ft)')
  })

  it('lets injected (parsed) units win over the SLOT_LABELS table', () => {
    // Table says 'ft' for Pool Elevation; injected says 'm' — parsed wins (DR-09).
    const lbc = withLabels(columns, { slot: 'Pool Elevation', units: 'm' })
    expect(deriveYAxisLabel(lbc, columns)).toBe('Pool Elevation (m)')
  })

  it('falls back to SLOT_LABELS units when units are not injected', () => {
    const lbc = withLabels(columns, { slot: 'Storage', units: '' })
    expect(deriveYAxisLabel(lbc, columns)).toBe('Storage (acre-ft)')
  })

  it('uses the table label when the slot name matches a table entry', () => {
    const lbc = withLabels(columns, { slot: 'Inflow' })
    expect(deriveYAxisLabel(lbc, columns)).toBe('Inflow (cfs)')
  })

  it('returns the bare slot name when no units exist anywhere', () => {
    const lbc = withLabels(columns, { slot: 'Custom Slot', units: '' })
    expect(deriveYAxisLabel(lbc, columns)).toBe('Custom Slot')
  })

  it('reads the slot/units from the first column that carries them', () => {
    const lbc = {
      trace_1: {},
      trace_2: { slot: 'Outflow', units: 'cfs' },
    }
    expect(deriveYAxisLabel(lbc, ['trace_1', 'trace_2'])).toBe('Outflow (cfs)')
  })

  it('returns empty string when no slot is derivable', () => {
    expect(deriveYAxisLabel(withLabels(columns, { scenario: 'RCP85' }), columns)).toBe('')
  })

  it('returns empty string for empty / missing inputs', () => {
    expect(deriveYAxisLabel({}, [])).toBe('')
    expect(deriveYAxisLabel(null, columns)).toBe('')
    expect(deriveYAxisLabel(withLabels(columns, { slot: '', units: 'ft' }), columns)).toBe('')
  })
})

describe('formatSlotLabel', () => {
  it('formats a direct slot name + units pair', () => {
    expect(formatSlotLabel('Pool Elevation', 'feet')).toBe('Pool Elevation (feet)')
  })

  it('falls back to the slot lookup table when units are missing', () => {
    expect(formatSlotLabel('Storage', '')).toBe('Storage (acre-ft)')
  })

  it('returns empty string when no slot name is available', () => {
    expect(formatSlotLabel('', 'ft')).toBe('')
  })
})
