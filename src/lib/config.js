/**
 * Config serialization (Phase 6a — TASK-026 / TASK-027).
 *
 * Serializes the full left-panel viewer state to a versioned, publicly
 * documented XML document (`<ensembleViewerConfig version="1">`) and parses
 * it back. Pure logic only — no React, no DOM components; browser-native
 * `XMLSerializer` / `DOMParser` are the only platform dependencies (DEP-002).
 *
 * Schema reference: docs/config-schema.md.
 *
 * Load semantics (DR-08):
 *   - `parseConfig` accepts EXACTLY version="1". A missing root element or any
 *     other version throws a descriptive Error (no migration layer yet).
 *   - The returned object is a *partial* state: only elements present in the
 *     document appear. `applyConfig` in App.jsx overlays it onto DEFAULT_CONFIG
 *     so missing elements reset to the app default (deterministic round-trip).
 *   - Unknown elements are ignored (forward-tolerant).
 *
 * Security (SEC-001 / SEC-002):
 *   - Parsed as `text/xml`; a `<parsererror>` node is detected explicitly
 *     (DOMParser does not throw on malformed input).
 *   - No external entity resolution is enabled (DOMParser does not resolve
 *     external entities by default in target browsers — ASSUMPTION-003).
 *   - Numeric fields are validated/clamped: no NaN / Infinity reaches state,
 *     line-style overrides are clamped to their allowed ranges (a finite
 *     out-of-range value, including a negative width, is clamped to the
 *     nearest bound; only a blank/non-finite override falls back to null).
 */

import {
  MIN_LINE_WIDTH,
  MAX_LINE_WIDTH,
  MIN_LINE_OPACITY,
  MAX_LINE_OPACITY,
  MIN_STYLE_MULTIPLIER,
  MAX_STYLE_MULTIPLIER,
  DEFAULT_STYLE_MULTIPLIER,
} from './plotStyle.js'

const CONFIG_VERSION = '1'
const ROOT_TAG = 'ensembleViewerConfig'

const TICK_FORMAT_OPTIONS = new Set(['auto', 'int', '1', '2'])
const HORIZON_LOGIC_OPTIONS = new Set(['AND', 'OR'])
const LABEL_STRATEGY_OPTIONS = new Set(['names', 'headers', 'sidecar', 'classifications'])

/**
 * Canonical default left-panel state. `applyConfig` starts from this and
 * overlays parsed values so any element absent from a loaded config resets to
 * the app default (DR-08). Mirrors the initial useState values in App.jsx.
 */
export const DEFAULT_CONFIG = {
  labelStrategy: 'names',
  delimiter: '_',
  categoriesText: '',
  activeByCategory: {},
  colorBy: null,
  showBands: false,
  showPlotLegend: true,
  xAxisLabel: '',
  yAxisLabel: '',
  lineStyleControls: {
    thickness: DEFAULT_STYLE_MULTIPLIER,
    opacity: DEFAULT_STYLE_MULTIPLIER,
    widthOverride: null,
    opacityOverride: null,
  },
  tickFormat: { x: 'auto', y: 'auto' },
  axisRanges: { xMin: '', xMax: '', yMin: '', yMax: '' },
  splitBy: '',
  tieCategoryA: '',
  tieCategoryB: '',
  sortCategory: '',
  sortRange: null,
  selectedHorizons: new Set(),
  horizonLogic: 'OR',
  bundledFilter: new Set(['Failure', 'Success']),
  classificationFilter: new Set(['Failure', 'Success']),
}

// --- Serialize ----------------------------------------------------------

/**
 * Serialize left-panel state to a versioned XML string.
 *
 * @param {object} state Subset of App.jsx state (see DEFAULT_CONFIG keys).
 * @returns {string} XML document text.
 */
export function serializeConfig(state = {}) {
  const doc = document.implementation.createDocument(null, ROOT_TAG, null)
  const root = doc.documentElement
  root.setAttribute('version', CONFIG_VERSION)

  const el = (tag, text) => {
    const node = doc.createElement(tag)
    if (text !== undefined && text !== null) node.textContent = String(text)
    return node
  }
  const append = (tag, value) => {
    if (value === undefined || value === null) return
    root.appendChild(el(tag, value))
  }

  append('labelStrategy', state.labelStrategy)
  append('delimiter', state.delimiter)
  append('categoriesText', state.categoriesText)

  // activeByCategory: Record<category, Set<value>>  → <activeByCategory><category name="..."><value>..</value></category></activeByCategory>
  if (state.activeByCategory && Object.keys(state.activeByCategory).length) {
    const wrap = doc.createElement('activeByCategory')
    for (const [cat, values] of Object.entries(state.activeByCategory)) {
      const catNode = doc.createElement('category')
      catNode.setAttribute('name', cat)
      for (const v of values instanceof Set ? values : (values || [])) {
        catNode.appendChild(el('value', v))
      }
      wrap.appendChild(catNode)
    }
    root.appendChild(wrap)
  }

  append('colorBy', state.colorBy)
  if (state.showBands !== undefined && state.showBands !== null) {
    append('showBands', state.showBands ? 'true' : 'false')
  }
  if (state.showPlotLegend !== undefined && state.showPlotLegend !== null) {
    append('showPlotLegend', state.showPlotLegend ? 'true' : 'false')
  }
  append('xAxisLabel', state.xAxisLabel)
  append('yAxisLabel', state.yAxisLabel)

  // lineStyleControls
  if (state.lineStyleControls) {
    const ls = state.lineStyleControls
    const node = doc.createElement('lineStyleControls')
    const sub = (tag, value) => {
      if (value === undefined || value === null) return
      node.appendChild(el(tag, value))
    }
    sub('thickness', ls.thickness)
    sub('opacity', ls.opacity)
    sub('widthOverride', ls.widthOverride)
    sub('opacityOverride', ls.opacityOverride)
    root.appendChild(node)
  }

  // tickFormat { x, y }
  if (state.tickFormat) {
    const node = doc.createElement('tickFormat')
    if (state.tickFormat.x != null) node.appendChild(el('x', state.tickFormat.x))
    if (state.tickFormat.y != null) node.appendChild(el('y', state.tickFormat.y))
    root.appendChild(node)
  }

  // axisRanges { xMin, xMax, yMin, yMax } — strings (may be '')
  if (state.axisRanges) {
    const node = doc.createElement('axisRanges')
    for (const key of ['xMin', 'xMax', 'yMin', 'yMax']) {
      const v = state.axisRanges[key]
      if (v !== undefined && v !== null) node.appendChild(el(key, v))
    }
    root.appendChild(node)
  }

  append('splitBy', state.splitBy)
  append('tieCategoryA', state.tieCategoryA)
  append('tieCategoryB', state.tieCategoryB)
  append('sortCategory', state.sortCategory)

  // sortRange { min, max } | null
  if (state.sortRange && typeof state.sortRange === 'object') {
    const node = doc.createElement('sortRange')
    if (Number.isFinite(state.sortRange.min)) node.appendChild(el('min', state.sortRange.min))
    if (Number.isFinite(state.sortRange.max)) node.appendChild(el('max', state.sortRange.max))
    root.appendChild(node)
  }

  // selectedHorizons: Set → list
  if (state.selectedHorizons) {
    const node = doc.createElement('selectedHorizons')
    for (const h of state.selectedHorizons) {
      node.appendChild(el('horizon', h))
    }
    root.appendChild(node)
  }

  append('horizonLogic', state.horizonLogic)

  // bundledFilter / classificationFilter: Set → list
  appendSet(doc, root, 'bundledFilter', state.bundledFilter)
  appendSet(doc, root, 'classificationFilter', state.classificationFilter)

  return new XMLSerializer().serializeToString(doc)
}

function appendSet(doc, root, tag, setOrList) {
  if (!setOrList) return
  const node = doc.createElement(tag)
  for (const v of setOrList) {
    const value = doc.createElement('value')
    value.textContent = String(v)
    node.appendChild(value)
  }
  root.appendChild(node)
}

// --- Parse --------------------------------------------------------------

/**
 * Parse a config XML string back to a partial state object.
 *
 * @param {string} xmlString
 * @returns {object} Partial state (only elements present in the document).
 * @throws {Error} On malformed XML, missing root, or unsupported version.
 */
export function parseConfig(xmlString) {
  if (typeof xmlString !== 'string' || xmlString.trim() === '') {
    throw new Error('Config file is empty or not text.')
  }

  const doc = new DOMParser().parseFromString(xmlString, 'text/xml')

  // DOMParser does not throw on malformed input — it embeds a <parsererror>.
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Config file is not valid XML (malformed document).')
  }

  const root = doc.documentElement
  if (!root || root.tagName !== ROOT_TAG) {
    throw new Error(
      `Config file is missing the <${ROOT_TAG}> root element.`
    )
  }

  const version = root.getAttribute('version')
  if (version !== CONFIG_VERSION) {
    throw new Error(
      `Unsupported config version "${version ?? '(none)'}"; expected "${CONFIG_VERSION}".`
    )
  }

  const out = {}
  const child = (tag) => root.querySelector(`:scope > ${tag}`)
  const text = (tag) => {
    const node = child(tag)
    return node ? node.textContent : undefined
  }

  // Plain string fields.
  const ls = text('labelStrategy')
  if (ls !== undefined && LABEL_STRATEGY_OPTIONS.has(ls)) out.labelStrategy = ls
  setIfDefined(out, 'delimiter', text('delimiter'))
  setIfDefined(out, 'categoriesText', text('categoriesText'))
  setIfDefined(out, 'colorBy', text('colorBy'))
  setIfDefined(out, 'xAxisLabel', text('xAxisLabel'))
  setIfDefined(out, 'yAxisLabel', text('yAxisLabel'))
  setIfDefined(out, 'splitBy', text('splitBy'))
  setIfDefined(out, 'tieCategoryA', text('tieCategoryA'))
  setIfDefined(out, 'tieCategoryB', text('tieCategoryB'))
  setIfDefined(out, 'sortCategory', text('sortCategory'))

  const showBands = text('showBands')
  if (showBands !== undefined) out.showBands = showBands === 'true'

  const showPlotLegend = text('showPlotLegend')
  if (showPlotLegend !== undefined) out.showPlotLegend = showPlotLegend === 'true'

  const horizonLogic = text('horizonLogic')
  if (horizonLogic !== undefined && HORIZON_LOGIC_OPTIONS.has(horizonLogic)) {
    out.horizonLogic = horizonLogic
  }

  // activeByCategory → Record<string, Set<string>>
  const abcNode = child('activeByCategory')
  if (abcNode) {
    const map = {}
    for (const catNode of abcNode.querySelectorAll(':scope > category')) {
      const name = catNode.getAttribute('name')
      if (!name) continue
      const values = new Set()
      for (const v of catNode.querySelectorAll(':scope > value')) {
        values.add(v.textContent)
      }
      map[name] = values
    }
    out.activeByCategory = map
  }

  // lineStyleControls
  const lsNode = child('lineStyleControls')
  if (lsNode) {
    const sub = (tag) => {
      const node = lsNode.querySelector(`:scope > ${tag}`)
      return node ? node.textContent : undefined
    }
    const controls = {}
    const thickness = clampFiniteOrUndefined(sub('thickness'), MIN_STYLE_MULTIPLIER, MAX_STYLE_MULTIPLIER)
    const opacity = clampFiniteOrUndefined(sub('opacity'), MIN_STYLE_MULTIPLIER, MAX_STYLE_MULTIPLIER)
    if (thickness !== undefined) controls.thickness = thickness
    if (opacity !== undefined) controls.opacity = opacity
    // Overrides: blank/absent/non-finite → null; finite → clamped to range (negative → min).
    controls.widthOverride = parseOverride(sub('widthOverride'), MIN_LINE_WIDTH, MAX_LINE_WIDTH)
    controls.opacityOverride = parseOverride(sub('opacityOverride'), MIN_LINE_OPACITY, MAX_LINE_OPACITY)
    out.lineStyleControls = controls
  }

  // tickFormat { x, y }
  const tfNode = child('tickFormat')
  if (tfNode) {
    const tf = {}
    const x = tfNode.querySelector(':scope > x')?.textContent
    const y = tfNode.querySelector(':scope > y')?.textContent
    if (x !== undefined && TICK_FORMAT_OPTIONS.has(x)) tf.x = x
    if (y !== undefined && TICK_FORMAT_OPTIONS.has(y)) tf.y = y
    if (Object.keys(tf).length) out.tickFormat = tf
  }

  // axisRanges — string fields preserved verbatim (datetime axes use text).
  const arNode = child('axisRanges')
  if (arNode) {
    const ar = {}
    for (const key of ['xMin', 'xMax', 'yMin', 'yMax']) {
      const node = arNode.querySelector(`:scope > ${key}`)
      if (node) ar[key] = node.textContent
    }
    if (Object.keys(ar).length) out.axisRanges = ar
  }

  // sortRange { min, max }
  const srNode = child('sortRange')
  if (srNode) {
    const min = toFiniteNumber(srNode.querySelector(':scope > min')?.textContent)
    const max = toFiniteNumber(srNode.querySelector(':scope > max')?.textContent)
    if (min !== null && max !== null) out.sortRange = { min, max }
  }

  // selectedHorizons → Set
  const shNode = child('selectedHorizons')
  if (shNode) {
    const set = new Set()
    for (const h of shNode.querySelectorAll(':scope > horizon')) set.add(h.textContent)
    out.selectedHorizons = set
  }

  // bundledFilter / classificationFilter → Set
  const bundled = parseValueSet(child('bundledFilter'))
  if (bundled) out.bundledFilter = bundled
  const classification = parseValueSet(child('classificationFilter'))
  if (classification) out.classificationFilter = classification

  return out
}

function setIfDefined(obj, key, value) {
  if (value !== undefined) obj[key] = value
}

function parseValueSet(node) {
  if (!node) return null
  const set = new Set()
  for (const v of node.querySelectorAll(':scope > value')) set.add(v.textContent)
  return set
}

/** Parse a numeric text into a finite Number, or null (SEC-002: no NaN/Infinity). */
function toFiniteNumber(text) {
  if (text === undefined || text === null || String(text).trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/** Clamp a finite numeric text to [min, max], or undefined when absent/invalid. */
function clampFiniteOrUndefined(text, min, max) {
  const n = toFiniteNumber(text)
  if (n === null) return undefined
  return Math.min(max, Math.max(min, n))
}

/**
 * Parse a style override (width/opacity). Blank/absent/invalid → null (auto).
 * Negative or out-of-range finite values are clamped to [min, max] (SEC-002).
 */
function parseOverride(text, min, max) {
  const n = toFiniteNumber(text)
  if (n === null) return null
  return Math.min(max, Math.max(min, n))
}
