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
  summarizeLabels,
  tieLabelCategories,
  detectIndexType,
} from './lib/labels.js'

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
  const [labelRowCount, setLabelRowCount] = useState(0)
  const [delimiter, setDelimiter] = useState('_')
  const [categoriesText, setCategoriesText] = useState('')

  // Filtering & coloring
  const [activeByCategory, setActiveByCategory] = useState({})
  const [colorBy, setColorBy] = useState(null)
  const [showBands, setShowBands] = useState(false)
  const [yUnits, setYUnits] = useState('')
  const [splitBy, setSplitBy] = useState('')
  const [tieCategoryA, setTieCategoryA] = useState('')
  const [tieCategoryB, setTieCategoryB] = useState('')

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

  const baseCategoryValues = useMemo(() => summarizeLabels(labelsByColumn), [labelsByColumn])

  const effectiveLabelsByColumn = useMemo(() => {
    if (!tieCategoryA || !tieCategoryB || tieCategoryA === tieCategoryB) return labelsByColumn
    return tieLabelCategories(labelsByColumn, [tieCategoryA, tieCategoryB])
  }, [labelsByColumn, tieCategoryA, tieCategoryB])

  const categoryValues = useMemo(() => summarizeLabels(effectiveLabelsByColumn), [effectiveLabelsByColumn])

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
  }, [categoryValues, colorBy, splitBy])

  // Compute which columns are currently visible given the filters
  const visibleColumns = useMemo(() => {
    const cats = Object.keys(categoryValues)
    const out = new Set()
    for (const col of columns) {
      const labels = effectiveLabelsByColumn[col] || {}
      let ok = true
      for (const cat of cats) {
        const active = activeByCategory[cat]
        if (!active || !active.has(labels[cat] ?? '')) { ok = false; break }
      }
      if (ok) out.add(col)
    }
    return out
  }, [columns, effectiveLabelsByColumn, activeByCategory, categoryValues])

  const plotGroups = useMemo(() => {
    if (!splitBy || !categoryValues[splitBy]) {
      return [{ key: 'all', title: null, columns }]
    }
    const activeValues = activeByCategory[splitBy] || new Set()
    return categoryValues[splitBy]
      .filter((val) => activeValues.has(val))
      .map((val) => ({
        key: val || 'empty',
        title: `${splitBy}: ${val || '⟨empty⟩'}`,
        columns: columns.filter((c) => (effectiveLabelsByColumn[c]?.[splitBy] ?? '') === val),
      }))
  }, [splitBy, categoryValues, activeByCategory, columns, effectiveLabelsByColumn])

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
          <FileDropzone onFile={loadFile} onSidecar={loadSidecar} hasData={rows.length > 0} />

          {rows.length > 0 && (
            <LabelStrategyPicker
              strategy={labelStrategy}
              onStrategyChange={setLabelStrategy}
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
              yUnits={yUnits}
              onYUnitsChange={setYUnits}
              splitBy={splitBy}
              onSplitByChange={setSplitBy}
              tieCategoryA={tieCategoryA}
              tieCategoryB={tieCategoryB}
              onTieCategoryAChange={setTieCategoryA}
              onTieCategoryBChange={setTieCategoryB}
              tieCategoryOptions={Object.keys(baseCategoryValues)}
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
                        visibleColumns={visibleColumns}
                        showBands={showBands}
                        indexType={indexType}
                        yUnits={yUnits}
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
