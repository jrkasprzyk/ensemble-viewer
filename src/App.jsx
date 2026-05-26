import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import FileDropzone from './components/FileDropzone.jsx'
import LabelStrategyPicker from './components/LabelStrategyPicker.jsx'
import LabelControls from './components/LabelControls.jsx'
const EnsemblePlot = lazy(() => import('./components/EnsemblePlot.jsx'))
import { parseCsvFile } from './lib/parseCsv.js'
import { parseXlsxFile } from './lib/parseXlsx.js'
import {
  parseLabelsFromNames,
  parseSidecarLabels,
  parseClassificationBundle,
  applyClassificationMapping,
  summarizeLabels,
  tieLabelCategories,
  detectIndexType,
  buildSortMetadata,
  parseFiniteLabelNumber,
  parseFiniteLabelNumberForCategoryValue,
  buildVisibleColumnSet,
} from './lib/labels.js'
import { buildColorMap, buildSequentialColorMap } from './lib/palette.js'
import { DEFAULT_STYLE_MULTIPLIER } from './lib/plotStyle.js'

const EMPTY_LABEL = '⟨empty⟩'

export default function App() {
  // Raw dataset
  const [file, setFile] = useState(null)           // the File object, kept so we can re-parse
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
  const [colorBy, setColorBy] = useState(null)
  const [showBands, setShowBands] = useState(false)
  const [xAxisLabel, setXAxisLabel] = useState('')
  const [yAxisLabel, setYAxisLabel] = useState('')
  const [lineStyleControls, setLineStyleControls] = useState({
    thickness: DEFAULT_STYLE_MULTIPLIER,
    opacity: DEFAULT_STYLE_MULTIPLIER,
  })
  const [splitBy, setSplitBy] = useState('')
  const [tieCategoryA, setTieCategoryA] = useState('')
  const [tieCategoryB, setTieCategoryB] = useState('')

  // Sort / range filtering
  const [sortCategory, setSortCategory] = useState('')
  const [sortRange, setSortRange] = useState(null)

  // UI
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  // --- File loading ------------------------------------------------------

  async function loadFile(f, { labelRowCount: lrc = null } = {}) {
    setError(null)
    setStatus(`Parsing ${f.name}…`)
    try {
      const isXlsx = /\.(xlsx|xls)$/i.test(f.name)
      const parsed = isXlsx
        ? await parseXlsxFile(f, { labelRowCount: lrc })
        : await parseCsvFile(f, { labelRowCount: lrc })
      setFile(f)
      setColumns(parsed.columns)
      setRows(parsed.rows)
      setIndexColumn(parsed.indexColumn)
      setIndexType(detectIndexType(parsed.rows, parsed.indexColumn))
      setColorBy(null)
      setLabelRowCount(parsed.labelRowCount)
      setRawClassificationsByTrace(null)

      if (parsed.labelRowCount > 0 && Object.keys(parsed.labelsByColumn).length) {
        setLabelsByColumn(parsed.labelsByColumn)
        setLabelStrategy('headers')
      } else {
        setLabelsByColumn(
          parseLabelsFromNames(parsed.columns, {
            delimiter,
            categories: parseCategoriesText(categoriesText),
          })
        )
      }
      setStatus(`Loaded ${parsed.columns.length} columns × ${parsed.rows.length} rows`)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
      setStatus('')
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
      setRawClassificationsByTrace(raw)
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

  const classificationSchemeCount = useMemo(() => {
    if (!rawClassificationsByTrace) return 0
    const allKeys = new Set()
    for (const schemes of Object.values(rawClassificationsByTrace)) {
      for (const key of Object.keys(schemes)) allKeys.add(key)
    }
    return allKeys.size
  }, [rawClassificationsByTrace])

  const classificationLabels = useMemo(() => {
    if (!rawClassificationsByTrace || !columns.length) return null
    return applyClassificationMapping(rawClassificationsByTrace, columns)
  }, [rawClassificationsByTrace, columns])

  useEffect(() => {
    if (!classificationLabels) return
    setLabelsByColumn(classificationLabels)
    setLabelStrategy('classifications')
  }, [classificationLabels])

  const baseCategoryValues = useMemo(() => summarizeLabels(labelsByColumn), [labelsByColumn])

  const effectiveLabelsByColumn = useMemo(() => {
    return tieLabelCategories(labelsByColumn, [tieCategoryA, tieCategoryB])
  }, [labelsByColumn, tieCategoryA, tieCategoryB])

  const categoryValues = useMemo(() => summarizeLabels(effectiveLabelsByColumn), [effectiveLabelsByColumn])

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
    const vals = categoryValues[colorBy]
    const toColorNumber = (v) => parseFiniteLabelNumberForCategoryValue(v, colorBy, sortCategory)
    const allNumeric = vals.every((v) => toColorNumber(v) !== null)
    if (allNumeric) {
      const sorted = [...vals].sort((a, b) => toColorNumber(a) - toColorNumber(b))
      return buildSequentialColorMap(sorted)
    }
    return buildColorMap([...vals].sort())
  }, [colorBy, categoryValues, sortCategory])

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

  // When categories change, initialize activeByCategory with "all selected"
  useEffect(() => {
    const next = {}
    for (const [cat, vals] of Object.entries(categoryValues)) {
      next[cat] = new Set(vals)
    }
    setActiveByCategory(next)
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
      activeByCategory,
      sortRange,
      sortNumericDomain: numericDomain,
      sortableNumberByColumn,
    })
  }, [columns, effectiveLabelsByColumn, activeByCategory, categoryValues, sortRange, numericDomain, sortableNumberByColumn])

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

  // --- Render ------------------------------------------------------------

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
        <div className="font-mono text-[10px] text-muted">{status}</div>
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
            onSidecar={loadSidecar}
            onClassifications={loadClassifications}
            classificationSchemeCount={classificationSchemeCount}
            hasData={rows.length > 0}
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
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
              onXAxisLabelChange={setXAxisLabel}
              onYAxisLabelChange={setYAxisLabel}
              lineStyleControls={lineStyleControls}
              onLineStyleControlsChange={setLineStyleControls}
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
                        indexType={indexType}
                        xAxisLabel={xAxisLabel}
                        yAxisLabel={yAxisLabel}
                        lineStyleControls={lineStyleControls}
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
