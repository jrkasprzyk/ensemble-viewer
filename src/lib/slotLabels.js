/**
 * Slot-label lookup and y-axis label derivation (Phase 5 — TASK-022).
 *
 * The in-browser RDF parser (rdfToDataset, src/lib/rdfParser.js) injects two
 * constant label categories on every data column:
 *
 *   labelsByColumn[col].slot  = the chosen series slot name (e.g. 'Pool Elevation')
 *   labelsByColumn[col].units = its RiverWare units (e.g. 'ft')
 *
 * Stacked CSV inputs may carry the same `slot`/`units` rows. `deriveYAxisLabel`
 * reads those injected categories first; when units are absent (e.g. a CSV that
 * names a slot but no units), it falls back to the SLOT_LABELS table keyed on
 * the slot name.
 *
 * Per DR-09 the full precedence is enforced at the component level:
 *   manual yAxisLabel (non-empty) > injected slot/units > SLOT_LABELS > ''
 * This module produces the "injected slot/units > SLOT_LABELS > ''" part; the
 * manual override sits above it in EnsemblePlot/LabelControls.
 *
 * SLOT_LABELS is a FALLBACK ONLY — parsed units always win. It seeds common
 * CRMMS reservoir slots and covers CSV inputs that lack units.
 */

/**
 * Known RiverWare slot names → { label, units }. Keyed on `slot_name`.
 * Units follow RiverWare conventions for CRMMS reservoir slots.
 */
export const SLOT_LABELS = {
  'Pool Elevation': { label: 'Pool Elevation', units: 'ft' },
  Storage: { label: 'Storage', units: 'acre-ft' },
  Inflow: { label: 'Inflow', units: 'cfs' },
  Outflow: { label: 'Outflow', units: 'cfs' },
  'Total Release': { label: 'Total Release', units: 'cfs' },
  Release: { label: 'Release', units: 'cfs' },
  Energy: { label: 'Energy', units: 'MWh' },
  Power: { label: 'Power', units: 'MW' },
  Evaporation: { label: 'Evaporation', units: 'acre-ft' },
  Spill: { label: 'Spill', units: 'cfs' },
  Diversion: { label: 'Diversion', units: 'cfs' },
  'Bank Storage': { label: 'Bank Storage', units: 'acre-ft' },
  'Surface Area': { label: 'Surface Area', units: 'acres' },
}

/**
 * Read the first non-empty value of an injected label category across columns.
 * Returns '' when no column carries the category (or all values are empty).
 *
 * @param {Record<string, Record<string, string>>} labelsByColumn
 * @param {string[]} columns
 * @param {string} category
 * @returns {string}
 */
function firstLabelValue(labelsByColumn, columns, category) {
  for (const col of columns) {
    const v = labelsByColumn?.[col]?.[category]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim()
    }
  }
  return ''
}

/**
 * Derive a formatted y-axis label from injected slot/units label categories,
 * falling back to the SLOT_LABELS table keyed on the slot name.
 *
 * Resolution order (DR-09, below the manual override):
 *   1. injected `slot` + injected `units` → "<slot> (<units>)"
 *   2. injected `slot` only, units from SLOT_LABELS[slot] → "<label> (<units>)"
 *   3. injected `slot` only, no table match → "<slot>"
 *   4. nothing derivable → ''
 *
 * Parsed (injected) units always win over the table — the table only supplies
 * units when the data did not.
 *
 * @param {Record<string, Record<string, string>>} labelsByColumn
 * @param {string[]} columns
 * @returns {string}
 */
export function deriveYAxisLabel(labelsByColumn, columns) {
  if (!labelsByColumn || !columns || !columns.length) return ''

  const slot = firstLabelValue(labelsByColumn, columns, 'slot')
  const injectedUnits = firstLabelValue(labelsByColumn, columns, 'units')

  if (!slot) return ''

  const table = SLOT_LABELS[slot]
  const label = table?.label ?? slot
  // Parsed units always win; only consult the table when units weren't injected.
  const units = injectedUnits || table?.units || ''

  return units ? `${label} (${units})` : label
}
