import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import FileDropzone from './components/FileDropzone.jsx'
import LabelStrategyPicker from './components/LabelStrategyPicker.jsx'
import LabelControls from './components/LabelControls.jsx'
const EnsemblePlot = lazy(() => import('./components/EnsemblePlot.jsx'))
import { parseCsvFile } from './lib/parseCsv.js'
import { parseXlsxFile } from './lib/parseXlsx.js'
import { parseRdf, listSlots, rdfToDataset } from './lib/rdfParser.js'
import { datasetToWideCsv, datasetToStackedCsv } from './lib/csvExport.js'
import {
  parseLabelsFromNames,
  seedActiveByCategory,
  parseSidecarLabels,
  parseClassificationBundle,
  mergeClassificationBundles,
  applyClassificationMapping,
  summarizeLabels,
  tieLabelCategories,
  detectIndexType,
  buildSortMetadata,
  parseFiniteLabelNumber,
  parseFiniteLabelNumberForCategoryValue,
  buildVisibleColumnSet,
  buildBundledLabels,
  BUNDLED_CATEGORY,
} from './lib/labels.js'
import { buildColorMap, buildSequentialColorMap, BUNDLED_COLOR_MAP } from './lib/palette.js'
import { DEFAULT_STYLE_MULTIPLIER, resolveLineStyling } from './lib/plotStyle.js'
import { deriveYAxisLabel, formatSlotLabel } from './lib/slotLabels.js'
import ConfigControls from './components/ConfigControls.jsx'
import { DEFAULT_CONFIG } from './lib/config.js'

const EMPTY_LABEL = '⟨empty⟩'

export default function App() {
  // Raw dataset
  const [file, setFile] = useState(null)           // the File object, kept so we can re-parse
  const [rdf, setRdf] = useState(null)             // parsed RDF (TASK-019), null for CSV/XLSX
  const [rdfSlots, setRdfSlots] = useState([])     // series slots available for selection
  const [selectedSlot, setSelectedSlot] = useState('')
  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [indexColumn, setIndexColumn] = useState('')
  const [indexType, setIndexType] = useState('numeric')

  // Labels
  const [labelsByColumn, setLabelsByColumn] = useState({})
  const [labelStrategy, setLabelStrategy] = useState('names')
  const [rawClassificationsByTrace, setRawClassificationsByTrace] = useState(null)
  const [labelRowCount, setLabelRowCount] = useState(0)
  const [delimiter, setDelimiter] = useState('_')
  const [categoriesText, setCategoriesText] = useState('')

  // Filtering & coloring
  const [activeByCategory, setActiveByCategory] = useState({})
  // Previous categoryValues snapshot, so the seeding effect can merge a slot
  // switch (preserve selection) vs. a fresh load (reset to all). See
  // seedActiveByCategory in lib/labels.js.
  const prevCategoryValuesRef = useRef({})
  // One-shot marker for a fresh dataset load (new CSV/XLSX or RDF). The next
  // seed must start from empty selection/category snapshots so no trace filter
  // carries between unrelated files (REQ-002).
  const forceFreshSeedRef = useRef(false)
  const [colorBy, setColorBy] = useState(null)
  const [showBands, setShowBands] = useState(false)
  const [showPlotLegend, setShowPlotLegend] = useState(true)
  const [xAxisLabel, setXAxisLabel] = useState('')
  const [yAxisLabel, setYAxisLabel] = useState('')
  const [lineStyleControls, setLineStyleControls] = useState({
    thickness: DEFAULT_STYLE_MULTIPLIER,
    opacity: DEFAULT_STYLE_MULTIPLIER,
    widthOverride: null,
    opacityOverride: null,
  })
  const [tickFormat, setTickFormat] = useState({ x: 'auto', y: 'auto' })
  const [axisRanges, setAxisRanges] = useState({ xMin: '', xMax: '', yMin: '', yMax: '' })
  const [splitBy, setSplitBy] = useState('')
  const [tieCategoryA, setTieCategoryA] = useState('')
  const [tieCategoryB, setTieCategoryB] = useState('')

  // Classification bundling
  const [selectedHorizons, setSelectedHorizons] = useState(new Set())
  const [horizonLogic, setHorizonLogic] = useState('OR')
  const [bundledFilter, setBundledFilter] = useState(new Set(['Failure', 'Success']))
  const [classificationFilter, setClassificationFilter] = useState(new Set(['Failure', 'Success']))

  // Sort / range filtering
  const [sortCategory, setSortCategory] = useState('')
  const [sortRange, setSortRange] = useState(null)

  // UI
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  // --- File loading ------------------------------------------------------

  // Single source-agnostic setter path for CSV / XLSX / RDF datasets (PAT-003).
  // `parsed` must match the parseCsvFile shape:
  // { columns, indexColumn, rows, labelsByColumn, labelRowCount }.
  // `preserveView` (true on a slot-to-slot switch within one RDF) keeps the
  // user's coloring + classification/horizon view state. Across slots of one
  // RDF the columns (traces) are identical, so this state stays valid. On a
  // fresh load (preserveView=false) everything resets to clean defaults.
  // The trace filter (activeByCategory) persists separately via the seeding
  // effect + seedActiveByCategory; see prevCategoryValuesRef.
  function applyDataset(parsed, { preserveView = false } = {}) {
    setColumns(parsed.columns)
    setRows(parsed.rows)
    setIndexColumn(parsed.indexColumn)
    setIndexType(detectIndexType(parsed.rows, parsed.indexColumn))
    setLabelRowCount(parsed.labelRowCount)

    if (!preserveView) {
      forceFreshSeedRef.current = true
      setColorBy(null)
      setRawClassificationsByTrace(null)
      setSelectedHorizons(new Set())
      setHorizonLogic('OR')
      setBundledFilter(new Set(['Failure', 'Success']))
      setClassificationFilter(new Set(['Failure', 'Success']))
      // Split/sort/tie are view state too; clear them so nothing carries
      // between unrelated files even when a category name coincides (REQ-002).
      // The reactive effect below only clears these when a category vanishes.
      setSplitBy('')
      setSortCategory('')
      setSortRange(null)
      setTieCategoryA('')
      setTieCategoryB('')
    }

    // When a classification bundle is active, labelsByColumn IS the
    // classification labels (no slot/units), owned by the classificationLabels
    // effect. Re-deriving headers here would transiently drop the scheme
    // categories → the colorBy-reset effect would nuke a scheme colorBy before
    // the classification effect restores it. So skip the re-derivation on a
    // preserved slot switch while classifications are loaded.
    const keepClassificationLabels = preserveView && rawClassificationsByTrace !== null

    // Re-derive labelsByColumn even on a slot switch so the new slot's
    // slot/units values flow through; the seeding effect treats those changed
    // values as brand-new and keeps every column visible (REQ-004). On a
    // preserved view, don't force labelStrategy back to 'headers' — leave the
    // user's strategy (e.g. 'classifications', restored by its own effect).
    if (keepClassificationLabels) {
      // no-op: classificationLabels effect re-applies labels for the new columns
    } else if (parsed.labelRowCount > 0 && Object.keys(parsed.labelsByColumn).length) {
      setLabelsByColumn(parsed.labelsByColumn)
      if (!preserveView) setLabelStrategy('headers')
    } else {
      setLabelsByColumn(
        parseLabelsFromNames(parsed.columns, {
          delimiter,
          categories: parseCategoriesText(categoriesText),
        })
      )
    }
    setStatus(`Loaded ${parsed.columns.length} columns × ${parsed.rows.length} rows`)
  }

  async function loadFile(f, { labelRowCount: lrc = null } = {}) {
    setError(null)
    setStatus(`Parsing ${f.name}…`)
    try {
      const isXlsx = /\.(xlsx|xls)$/i.test(f.name)
      const parsed = isXlsx
        ? await parseXlsxFile(f, { labelRowCount: lrc })
        : await parseCsvFile(f, { labelRowCount: lrc })
      setFile(f)
      setRdf(null)
      setRdfSlots([])
      setSelectedSlot('')
      // Fresh load: drop any prior filter selection so nothing carries between
      // unrelated files (REQ-002); the seeding effect then selects all.
      setActiveByCategory({})
      prevCategoryValuesRef.current = {}
      forceFreshSeedRef.current = true
      applyDataset(parsed)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
      setStatus('')
    }
  }

  // RDF flow (TASK-019): read text → parseRdf → store; the user then picks a
  // series slot which converts to a dataset via the shared applyDataset path.
  async function loadRdf(f) {
    setError(null)
    setStatus(`Parsing ${f.name}…`)
    try {
      const text = await f.text()
      const parsedRdf = parseRdf(text)
      const seriesSlots = listSlots(parsedRdf).filter((s) => s.scalar === false)
      if (!seriesSlots.length) {
        throw new Error('No series slots found in this RDF file.')
      }
      setFile(f)
      setRdf(parsedRdf)
      setRdfSlots(seriesSlots)
      setSelectedSlot('')
      // Fresh load: drop any prior filter selection (REQ-002). The first slot
      // pick is treated as a fresh load (REQ-003); later switches preserve.
      setActiveByCategory({})
      prevCategoryValuesRef.current = {}
      forceFreshSeedRef.current = true
      // Clear any previously loaded dataset until a slot is chosen.
      setRows([])
      setColumns([])
      setStatus(`Parsed ${f.name}: ${seriesSlots.length} series slot(s) — pick one to view`)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
      setStatus('')
    }
  }

  function selectRdfSlot(slotKey) {
    if (!rdf || !slotKey) return
    setError(null)
    try {
      const parsed = rdfToDataset(rdf, slotKey)
      // First slot pick after loading the RDF = fresh load (REQ-003); every
      // later slot-to-slot switch preserves the user's filters/coloring.
      const preserveView = Boolean(selectedSlot)
      setSelectedSlot(slotKey)
      applyDataset(parsed, { preserveView })
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    }
  }

  // Serialize the current RDF-derived dataset to CSV and trigger a download.
  // `format` is 'wide' (default) or 'stacked'.
  function downloadDatasetCsv(format = 'wide') {
    if (!rows.length) return
    try {
      const dataset = { columns, indexColumn, rows, labelsByColumn }
      const csv = format === 'stacked'
        ? datasetToStackedCsv(dataset)
        : datasetToWideCsv(dataset)
      const base = (selectedSlot || 'dataset').replace(/[^\w.-]+/g, '_')
      const suffix = format === 'stacked' ? '_stacked' : ''
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${base}${suffix}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    }
  }

  async function loadSidecar(f) {
    setError(null)
    try {
      const labels = await parseSidecarLabels(f)
      setLabelsByColumn(labels)
      setLabelStrategy('sidecar')
      setStatus(`Sidecar labels applied (${Object.keys(labels).length} columns mapped)`)
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function loadClassifications(files) {
    setError(null)
    try {
      const raw = await parseClassificationBundle(files)
      // Merge before dispatch: mergeClassificationBundles throws on duplicate
      // scheme names, and a throw inside a setState updater would escape this
      // try/catch (React runs deferred updaters during render).
      const merged = mergeClassificationBundles(rawClassificationsByTrace, raw)
      setRawClassificationsByTrace(merged)
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  function handleStrategyChange(val) {
    setLabelStrategy(val)
    if (val === 'classifications' && classificationLabels) {
      setLabelsByColumn(classificationLabels)
    }
  }

  function applyNameStrategy() {
    if (!columns.length) return
    setLabelsByColumn(
      parseLabelsFromNames(columns, {
        delimiter,
        categories: parseCategoriesText(categoriesText),
      })
    )
    setLabelStrategy('names')
  }

  async function reparseWithHeaders() {
    if (!file) return
    await loadFile(file, { labelRowCount })
  }

  // --- Derived state -----------------------------------------------------

  // Union across all traces: merged bundles can cover different trace sets per
  // scheme, so no single trace is guaranteed to list every scheme.
  const classificationSchemeNames = useMemo(() => {
    if (!rawClassificationsByTrace) return []
    const allKeys = new Set()
    for (const schemes of Object.values(rawClassificationsByTrace)) {
      for (const key of Object.keys(schemes)) allKeys.add(key)
    }
    return [...allKeys].sort()
  }, [rawClassificationsByTrace])

  const classificationSchemeCount = classificationSchemeNames.length

  const classificationLabels = useMemo(() => {
    if (!rawClassificationsByTrace || !columns.length) return null
    return applyClassificationMapping(rawClassificationsByTrace, columns)
  }, [rawClassificationsByTrace, columns])

  useEffect(() => {
    if (!classificationLabels) return
    setLabelsByColumn(classificationLabels)
    setLabelStrategy('classifications')
  }, [classificationLabels])

  useEffect(() => {
    if (!selectedHorizons.size && colorBy === BUNDLED_CATEGORY) setColorBy(null)
  }, [selectedHorizons, colorBy])

  const mergedLabelsByColumn = useMemo(() => {
    if (!labelsByColumn || !selectedHorizons.size) return labelsByColumn
    try {
      const bundled = buildBundledLabels(labelsByColumn, [...selectedHorizons], horizonLogic)
      const out = {}
      for (const col of Object.keys(labelsByColumn)) {
        out[col] = { ...(labelsByColumn[col] || {}), ...(bundled[col] || {}) }
      }
      return out
    } catch (e) {
      console.error('buildBundledLabels:', e)
      return labelsByColumn
    }
  }, [labelsByColumn, selectedHorizons, horizonLogic])

  const baseCategoryValues = useMemo(() => summarizeLabels(labelsByColumn), [labelsByColumn])

  const effectiveLabelsByColumn = useMemo(() => {
    return tieLabelCategories(mergedLabelsByColumn, [tieCategoryA, tieCategoryB])
  }, [mergedLabelsByColumn, tieCategoryA, tieCategoryB])

  const categoryValues = useMemo(() => summarizeLabels(effectiveLabelsByColumn), [effectiveLabelsByColumn])

  // Auto y-axis label from injected slot/units (or the SLOT_LABELS fallback).
  // DR-09: this is the default; a non-empty manual yAxisLabel overrides it downstream.
  const defaultYAxisLabel = useMemo(() => {
    const derived = deriveYAxisLabel(effectiveLabelsByColumn, columns)
    if (derived) return derived

    const selectedRdfSlot = rdf?.runs?.[0]?.slots?.[selectedSlot]
    return formatSlotLabel(selectedRdfSlot?.slot_name, selectedRdfSlot?.units)
  }, [effectiveLabelsByColumn, columns, rdf, selectedSlot])

  const { sortableNumberByColumn, numericDomain } = useMemo(
    () => buildSortMetadata(labelsByColumn, sortCategory),
    [labelsByColumn, sortCategory]
  )

  const numericCategories = useMemo(() => {
    return Object.entries(baseCategoryValues)
      .filter(([, vals]) => vals.some((v) => parseFiniteLabelNumber(v) !== null))
      .map(([cat]) => cat)
  }, [baseCategoryValues])

  const colorMap = useMemo(() => {
    if (!colorBy || !categoryValues[colorBy]) return {}
    if (colorBy === BUNDLED_CATEGORY || classificationSchemeNames.includes(colorBy)) return BUNDLED_COLOR_MAP
    const vals = categoryValues[colorBy]
    const toColorNumber = (v) => parseFiniteLabelNumberForCategoryValue(v, colorBy, sortCategory)
    const allNumeric = vals.every((v) => toColorNumber(v) !== null)
    if (allNumeric) {
      const sorted = [...vals].sort((a, b) => toColorNumber(a) - toColorNumber(b))
      return buildSequentialColorMap(sorted)
    }
    return buildColorMap([...vals].sort())
  }, [colorBy, categoryValues, sortCategory, classificationSchemeNames])

  const effectiveActiveByCategory = useMemo(() => {
    if (!classificationSchemeNames.length) return activeByCategory
    const overrides = {}
    const allValues = new Set(['Failure', 'Success'])
    for (const scheme of classificationSchemeNames) {
      overrides[scheme] = colorBy === scheme ? classificationFilter : allValues
    }
    if (selectedHorizons.size) {
      overrides[BUNDLED_CATEGORY] = bundledFilter
    }
    return { ...activeByCategory, ...overrides }
  }, [activeByCategory, classificationSchemeNames, colorBy, classificationFilter, bundledFilter, selectedHorizons])

  const orderedColumns = useMemo(() => {
    if (!sortCategory || !numericDomain) return columns
    return [...columns].sort((a, b) => {
      const na = sortableNumberByColumn[a]
      const nb = sortableNumberByColumn[b]
      if (na !== null && nb !== null) return na - nb
      if (na !== null) return -1
      if (nb !== null) return 1
      return String(a).localeCompare(String(b))
    })
  }, [columns, sortCategory, numericDomain, sortableNumberByColumn])

  // When categories change, (re)seed activeByCategory. Brand-new categories and
  // brand-new values are auto-selected; the user's prior selection is preserved
  // otherwise, so trace filters persist across RDF slot switches. Fresh loads
  // reset prevCategoryValuesRef to {} (in loadFile/loadRdf) so everything seeds
  // anew. See seedActiveByCategory in lib/labels.js.
  useEffect(() => {
    // On a fresh load, prevCategoryValues={} makes every category read as new,
    // so seedActiveByCategory selects all regardless of prevActive — no need to
    // also blank prevActive.
    const forceFreshSeed = forceFreshSeedRef.current
    const prevCategoryValues = forceFreshSeed ? {} : prevCategoryValuesRef.current
    setActiveByCategory((prevActive) =>
      seedActiveByCategory(prevActive, prevCategoryValues, categoryValues)
    )
    prevCategoryValuesRef.current = categoryValues
    forceFreshSeedRef.current = false
  }, [categoryValues])

  useEffect(() => {
    if (colorBy && !categoryValues[colorBy]) {
      setColorBy(null)
      setShowBands(false)
    }
    if (splitBy && !categoryValues[splitBy]) {
      setSplitBy('')
    }
    if (tieCategoryA && !baseCategoryValues[tieCategoryA]) setTieCategoryA('')
    if (tieCategoryB && !baseCategoryValues[tieCategoryB]) setTieCategoryB('')
    if (sortCategory && !baseCategoryValues[sortCategory]) {
      setSortCategory('')
      setSortRange(null)
    } else if (sortCategory && !numericDomain && sortRange !== null) {
      setSortRange(null)
    }
  }, [categoryValues, baseCategoryValues, colorBy, splitBy, tieCategoryA, tieCategoryB, sortCategory, numericDomain, sortRange])

  // Compute which columns are currently visible given the filters
  const visibleColumns = useMemo(() => {
    return buildVisibleColumnSet({
      columns,
      labelsByColumn: effectiveLabelsByColumn,
      categoryValues,
      activeByCategory: effectiveActiveByCategory,
      sortRange,
      sortNumericDomain: numericDomain,
      sortableNumberByColumn,
    })
  }, [columns, effectiveLabelsByColumn, effectiveActiveByCategory, categoryValues, sortRange, numericDomain, sortableNumberByColumn])

  // Bands actually draw only when showBands is on, a colorBy grouping exists, and at
  // least one colored group has >=2 visible traces (DR-06). The header readout and the
  // opacity-dimming path both key off this, not the raw showBands flag.
  const bandsActive = useMemo(() => {
    if (!showBands || !colorBy) return false
    const counts = {}
    for (const col of columns) {
      if (!visibleColumns.has(col)) continue
      const v = effectiveLabelsByColumn[col]?.[colorBy] ?? ''
      counts[v] = (counts[v] || 0) + 1
      if (counts[v] >= 2) return true
    }
    return false
  }, [showBands, colorBy, columns, visibleColumns, effectiveLabelsByColumn])

  const resolvedLineStyle = useMemo(() => {
    if (!rows.length) return null
    return resolveLineStyling(visibleColumns.size, bandsActive, lineStyleControls)
  }, [rows.length, visibleColumns.size, bandsActive, lineStyleControls])

  const plotGroups = useMemo(() => {
    if (!splitBy || !categoryValues[splitBy]) {
      return [{ key: 'all', title: null, columns: orderedColumns }]
    }
    const activeValues = activeByCategory[splitBy] || new Set()
    return categoryValues[splitBy]
      .filter((val) => activeValues.has(val))
      .map((val) => ({
        key: `${splitBy}:${JSON.stringify(val)}`,
        title: `${splitBy}: ${val || EMPTY_LABEL}`,
        columns: orderedColumns.filter((c) => visibleColumns.has(c) && (effectiveLabelsByColumn[c]?.[splitBy] ?? '') === val),
      }))
  }, [splitBy, categoryValues, activeByCategory, orderedColumns, effectiveLabelsByColumn, visibleColumns])

  // --- Handlers ----------------------------------------------------------

  function toggleValue(cat, val) {
    setActiveByCategory((prev) => {
      const next = { ...prev }
      const s = new Set(prev[cat] || [])
      s.has(val) ? s.delete(val) : s.add(val)
      next[cat] = s
      return next
    })
  }

  function toggleAll(cat) {
    setActiveByCategory((prev) => {
      const all = new Set(categoryValues[cat] || [])
      const cur = prev[cat] || new Set()
      const next = { ...prev }
      next[cat] = cur.size === all.size ? new Set() : all
      return next
    })
  }

  function toggleHorizon(scheme) {
    setSelectedHorizons((prev) => {
      const next = new Set(prev)
      next.has(scheme) ? next.delete(scheme) : next.add(scheme)
      return next
    })
  }

  function deselectAllHorizons() {
    setSelectedHorizons(new Set())
  }

  function toggleBundledFilter(val) {
    setBundledFilter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  function toggleClassificationFilter(val) {
    setClassificationFilter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  // --- Config save / load (Phase 6a) -------------------------------------

  // Gather the full serializable left-panel state for serializeConfig.
  function getCurrentConfig() {
    return {
      labelStrategy,
      delimiter,
      categoriesText,
      activeByCategory,
      colorBy,
      showBands,
      showPlotLegend,
      xAxisLabel,
      yAxisLabel,
      lineStyleControls,
      tickFormat,
      axisRanges,
      splitBy,
      tieCategoryA,
      tieCategoryB,
      sortCategory,
      sortRange,
      selectedHorizons,
      horizonLogic,
      bundledFilter,
      classificationFilter,
    }
  }

  // Apply a parsed config (DR-08): start from DEFAULT_CONFIG, overlay parsed
  // values so absent elements reset to the app default. Restores controls
  // only — never re-parses data. Guards activeByCategory against categories
  // not present in the current dataset (RISK-005).
  function applyConfig(parsed) {
    const cfg = { ...DEFAULT_CONFIG, ...parsed }

    setLabelStrategy(cfg.labelStrategy)
    setDelimiter(cfg.delimiter)
    setCategoriesText(cfg.categoriesText)
    setColorBy(cfg.colorBy)
    setShowBands(cfg.showBands)
    setShowPlotLegend(cfg.showPlotLegend)
    setXAxisLabel(cfg.xAxisLabel)
    setYAxisLabel(cfg.yAxisLabel)
    setLineStyleControls({ ...DEFAULT_CONFIG.lineStyleControls, ...cfg.lineStyleControls })
    setTickFormat({ ...DEFAULT_CONFIG.tickFormat, ...cfg.tickFormat })
    setAxisRanges({ ...DEFAULT_CONFIG.axisRanges, ...cfg.axisRanges })
    setSplitBy(cfg.splitBy)
    setTieCategoryA(cfg.tieCategoryA)
    setTieCategoryB(cfg.tieCategoryB)
    setSortCategory(cfg.sortCategory)
    setSortRange(cfg.sortRange)
    setSelectedHorizons(new Set(cfg.selectedHorizons))
    setHorizonLogic(cfg.horizonLogic)
    setBundledFilter(new Set(cfg.bundledFilter))
    setClassificationFilter(new Set(cfg.classificationFilter))

    // activeByCategory: the loaded config deterministically owns the full
    // selection. Start every dataset category at its "all selected" default
    // (matching the categoryValues seeding effect), then overlay the loaded
    // selection where it overlaps reality — categories absent from the config
    // reset to default rather than persisting prior session state (DR-08).
    const guarded = {}
    for (const [cat, vals] of Object.entries(categoryValues)) {
      guarded[cat] = new Set(vals)
    }
    for (const [cat, vals] of Object.entries(cfg.activeByCategory || {})) {
      if (!categoryValues[cat]) continue
      const known = new Set(categoryValues[cat])
      const next = new Set()
      for (const v of vals) if (known.has(v)) next.add(v)
      guarded[cat] = next
    }
    setActiveByCategory(guarded)

    setStatus('Configuration applied')
  }

  // --- Render ------------------------------------------------------------

  const loadedFileName = file?.name || ''

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-rule px-4 py-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg font-medium tracking-tight">
            Ensemble Viewer
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            wide CSV / XLSX → interactive timeseries
          </span>
        </div>
        <div className="font-mono text-[10px] text-muted text-right">
          {loadedFileName && <div>file: {loadedFileName}</div>}
          <div>{status}</div>
          {resolvedLineStyle && (
            <div>
              line style: width {resolvedLineStyle.lineWidth.toFixed(2)}, opacity {resolvedLineStyle.opacity.toFixed(2)}
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="border-b border-accent bg-accent/10 text-accent px-4 py-2 text-xs font-mono">
          {error}
        </div>
      )}

      <main className="flex-1 grid grid-cols-[320px_1fr] min-h-0">
        <aside className="border-r border-rule p-3 overflow-y-auto flex flex-col gap-3">
          <FileDropzone
            onFile={loadFile}
            onRdf={loadRdf}
            onSidecar={loadSidecar}
            onClassifications={loadClassifications}
            classificationSchemeCount={classificationSchemeCount}
            hasData={rows.length > 0}
            rdfSlots={rdfSlots}
            selectedSlot={selectedSlot}
            onSelectSlot={selectRdfSlot}
            canDownloadCsv={rdf !== null && rows.length > 0}
            onDownloadCsv={downloadDatasetCsv}
          />

          {rows.length > 0 && (
            <LabelStrategyPicker
              strategy={labelStrategy}
              onStrategyChange={handleStrategyChange}
              hasClassifications={rawClassificationsByTrace !== null}
              labelRowCount={labelRowCount}
              onLabelRowCountChange={setLabelRowCount}
              delimiter={delimiter}
              onDelimiterChange={setDelimiter}
              categoriesText={categoriesText}
              onCategoriesTextChange={setCategoriesText}
              onApply={applyNameStrategy}
              onReparse={reparseWithHeaders}
            />
          )}

          {rows.length > 0 && (
            <LabelControls
              categoryValues={categoryValues}
              activeByCategory={activeByCategory}
              onToggleValue={toggleValue}
              onToggleAll={toggleAll}
              colorBy={colorBy}
              onColorByChange={setColorBy}
              showBands={showBands}
              onShowBandsChange={setShowBands}
              showPlotLegend={showPlotLegend}
              onShowPlotLegendChange={setShowPlotLegend}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
              defaultYAxisLabel={defaultYAxisLabel}
              onXAxisLabelChange={setXAxisLabel}
              onYAxisLabelChange={setYAxisLabel}
              lineStyleControls={lineStyleControls}
              onLineStyleControlsChange={setLineStyleControls}
              tickFormat={tickFormat}
              onTickFormatChange={(axis, value) => setTickFormat((prev) => ({ ...prev, [axis]: value }))}
              bandsActive={bandsActive}
              axisRanges={axisRanges}
              onAxisRangesChange={setAxisRanges}
              indexType={indexType}
              splitBy={splitBy}
              onSplitByChange={setSplitBy}
              tieCategoryA={tieCategoryA}
              tieCategoryB={tieCategoryB}
              onTieCategoryAChange={setTieCategoryA}
              onTieCategoryBChange={setTieCategoryB}
              tieCategoryOptions={Object.keys(baseCategoryValues)}
              colorMap={colorMap}
              sortCategory={sortCategory}
              onSortCategoryChange={(cat) => { setSortCategory(cat); setSortRange(null) }}
              numericCategories={numericCategories}
              sortRangeControl={sortCategory && numericDomain ? { domain: numericDomain, value: sortRange ?? numericDomain } : null}
              onSortRangeChange={setSortRange}
              classificationSchemeNames={classificationSchemeNames}
              selectedHorizons={selectedHorizons}
              horizonLogic={horizonLogic}
              bundledFilter={bundledFilter}
              classificationFilter={classificationFilter}
              onHorizonToggle={toggleHorizon}
              onHorizonDeselectAll={deselectAllHorizons}
              onHorizonLogicChange={setHorizonLogic}
              onBundledFilterChange={toggleBundledFilter}
              onClassificationFilterChange={toggleClassificationFilter}
            />
          )}

          {rows.length > 0 && (
            <ConfigControls
              getConfig={getCurrentConfig}
              onLoadConfig={applyConfig}
              onError={setError}
            />
          )}

          {rows.length > 0 && (
            <div className="mt-2 pt-2 border-t border-rule font-mono text-[10px] text-muted">
              showing {visibleColumns.size} / {columns.length} columns
            </div>
          )}
        </aside>

        <section className="p-3 min-h-0">
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <Suspense fallback={<div>Loading plot…</div>}>
              <div className="h-full overflow-y-auto flex flex-col gap-3">
                {plotGroups.map((group) => (
                  <div key={group.key} className={plotGroups.length > 1 ? 'h-[320px] min-h-[320px]' : 'h-full'}>
                    {group.title && (
                      <div className="mb-1 text-[11px] font-mono text-muted uppercase tracking-wider">
                        {group.title}
                      </div>
                    )}
                    <div className={group.title ? 'h-[calc(100%-1.25rem)]' : 'h-full'}>
                      <EnsemblePlot
                        rows={rows}
                        indexColumn={indexColumn}
                        columns={group.columns}
                        labelsByColumn={effectiveLabelsByColumn}
                        colorBy={colorBy}
                        colorMap={colorMap}
                        visibleColumns={visibleColumns}
                        showBands={showBands}
                        showPlotLegend={showPlotLegend}
                        indexType={indexType}
                        xAxisLabel={xAxisLabel}
                        yAxisLabel={yAxisLabel}
                        defaultYAxisLabel={defaultYAxisLabel}
                        lineStyleControls={lineStyleControls}
                        tickFormat={tickFormat}
                        axisRanges={axisRanges}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Suspense>
          )}
        </section>
      </main>
    </div>
  )
}

function parseCategoriesText(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-md text-center">
        <h2 className="font-display text-2xl font-light mb-3">Drop a file to begin</h2>
        <p className="text-sm text-muted leading-relaxed">
          The first column is treated as the index (x-axis). Remaining columns are
          plotted as individual traces. Labels can live in stacked header rows,
          in the column names themselves, or in a sidecar CSV — pick whichever
          you have.
        </p>
        <p className="text-xs text-muted mt-4 font-mono">
          Or pick an item from Examples above to load a curated demo dataset.
        </p>
      </div>
    </div>
  )
}
