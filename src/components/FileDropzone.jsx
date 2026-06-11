import { useEffect, useRef, useState } from 'react'
import {
  fetchExamples,
  fetchExampleFile,
  fetchExampleSidecar,
  fetchClassificationBundle,
  fetchRemoteFile,
} from '../lib/sampleData.js'

function isRdf(file) {
  return /\.rdf$/i.test(file?.name || '')
}

/**
 * Group RDF slot metadata by source filename.
 *
 * @param {Array<{source?:string}>} slots
 * @returns {Record<string, Array<{source?:string}>>}
 */
function groupSlotsBySource(slots) {
  return slots.reduce((acc, slot) => {
    const sourceFile = slot.source || ''
    if (!acc[sourceFile]) acc[sourceFile] = []
    acc[sourceFile].push(slot)
    return acc
  }, {})
}

export default function FileDropzone({
  onFile,
  onRdf,
  onSidecar,
  onClassifications,
  classificationSchemeCount,
  hasData,
  rdfFileNames = [],
  onRemoveRdfFile,
  rdfSlots = [],
  selectedSlot = '',
  onSelectSlot,
  canDownloadCsv = false,
  onDownloadCsv,
}) {
  const inputRef = useRef(null)
  const sidecarRef = useRef(null)
  const classificationsRef = useRef(null)
  const mountedRef = useRef(true)
  const [drag, setDrag] = useState(false)
  const dragCounterRef = useRef(0)
  const [examples, setExamples] = useState([])
  const [loadingExamples, setLoadingExamples] = useState(true)
  const [loadingExampleSelection, setLoadingExampleSelection] = useState(false)
  const [selectedExample, setSelectedExample] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [url, setUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    function onDragEnter(e) {
      e.preventDefault()
      dragCounterRef.current++
      if (dragCounterRef.current === 1) setDrag(true)
    }
    function onDragOver(e) { e.preventDefault() }
    function onDragLeave(e) {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) setDrag(false)
    }
    function onDrop(e) {
      e.preventDefault()
      dragCounterRef.current = 0
      setDrag(false)
      handleFiles(e.dataTransfer.files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadExamples() {
      setLoadingExamples(true)
      try {
        const loadedExamples = await fetchExamples()
        if (mountedRef.current) setExamples(loadedExamples)
      } catch (e) {
        console.error('Failed to load examples manifest', e)
        if (mountedRef.current) setExamples([])
      } finally {
        if (mountedRef.current) setLoadingExamples(false)
      }
    }

    loadExamples()
  }, [])

  function handleFiles(files) {
    if (!files || !files.length) return
    const allFiles = Array.from(files)
    const rdfFiles = allFiles.filter(isRdf)
    if (rdfFiles.length && rdfFiles.length === allFiles.length && onRdf) {
      onRdf(rdfFiles)
    } else {
      const file = allFiles[0]
      onFile(file)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleExampleChange(exampleId) {
    if (!exampleId) return

    const example = examples.find((item) => item.id === exampleId)
    if (!example?.entry) return

    setLoadingExampleSelection(true)
    setLoadError(null)
    try {
      const file = await fetchExampleFile(example.entry)
      if (!mountedRef.current) return
      await onFile(file, { sourcePath: example.entry })
      if (!mountedRef.current) return
      if (example.sidecar && onSidecar) {
        const sidecarFile = await fetchExampleSidecar(example.sidecar)
        if (!mountedRef.current) return
        onSidecar(sidecarFile)
      }
      if (example.classifications && onClassifications) {
        const classFiles = await fetchClassificationBundle(example.classifications)
        if (!mountedRef.current) return
        onClassifications(classFiles)
      }
    } catch (e) {
      console.error('Failed to load example', e)
      if (mountedRef.current) setLoadError(e.message || String(e))
    } finally {
      if (mountedRef.current) {
        setSelectedExample('')
        setLoadingExampleSelection(false)
      }
    }
  }

  // Load a dataset from a web URL (e.g. a CDN). The fetched file is routed
  // exactly like a local upload: .rdf → onRdf, everything else → onFile. The
  // full URL is passed as sourcePath so the top bar shows where it came from.
  async function handleUrlSubmit(e) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || loadingUrl) return
    setLoadingUrl(true)
    setLoadError(null)
    try {
      const file = await fetchRemoteFile(trimmed)
      if (!mountedRef.current) return
      if (isRdf(file) && onRdf) {
        await onRdf(file, { sourcePath: trimmed })
      } else {
        await onFile(file, { sourcePath: trimmed })
      }
      if (mountedRef.current) setUrl('')
    } catch (err) {
      console.error('Failed to load URL', err)
      if (mountedRef.current) setLoadError(err.message || String(err))
    } finally {
      if (mountedRef.current) setLoadingUrl(false)
    }
  }

  return (
    <div
      className={`border border-dashed rounded-sm px-4 py-3 text-xs transition-colors ${
        drag ? 'border-accent bg-accent/5' : 'border-rule bg-paper'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Data file
          </span>
          <span className="text-ink">
            {rdfFileNames.length > 0
              ? 'Add more RDF files, or drop a CSV/XLSX to replace'
              : hasData
                ? 'Replace CSV, XLSX or RDF…'
                : 'Drop CSV, XLSX or RDF, or click to browse'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-ink hover:bg-ink hover:text-paper transition-colors"
          >
            Browse
          </button>
          <select
            value={selectedExample}
            onChange={(e) => {
              const value = e.target.value
              if (value) {
                setSelectedExample('')
                handleExampleChange(value)
              }
            }}
            disabled={loadingExamples || loadingExampleSelection || !examples.length}
            aria-label="Examples"
            className="px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-rule bg-paper text-ink disabled:opacity-50"
          >
            <option value="">
              {loadingExamples
                ? 'Loading examples…'
                : loadingExampleSelection
                  ? 'Loading…'
                  : 'Examples…'}
            </option>
            {examples.map((example) => (
              <option
                key={example.id}
                value={example.id}
                title={example.description || ''}
              >
                {example.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls,.rdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <form
        onSubmit={handleUrlSubmit}
        className="mt-2 pt-2 border-t border-rule flex items-center gap-2"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… (CSV, XLSX or RDF URL)"
          aria-label="Data file URL"
          disabled={loadingUrl}
          className="flex-1 min-w-0 px-2 py-1.5 text-[11px] font-mono border border-rule bg-paper text-ink placeholder:text-muted disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loadingUrl || !url.trim()}
          className="px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors disabled:opacity-50"
        >
          {loadingUrl ? 'Loading…' : 'Load URL'}
        </button>
      </form>

      {rdfFileNames.length > 0 && (
        <div className="mt-2 pt-2 border-t border-rule flex flex-col gap-1">
          <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Loaded RDF files
          </span>
          <ul className="flex flex-col gap-0.5">
            {rdfFileNames.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink"
              >
                <span className="truncate" title={name}>{name}</span>
                <button
                  onClick={() => onRemoveRdfFile?.(name)}
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                  className="px-1 text-[10px] border border-rule hover:border-ink transition-colors"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rdfSlots.length > 0 && (
        <div className="mt-2 pt-2 border-t border-rule flex flex-col gap-1">
          <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
            RDF series slot
          </span>
          <select
            value={selectedSlot}
            onChange={(e) => e.target.value && onSelectSlot?.(e.target.value)}
            aria-label="RDF series slot"
            className="px-2 py-1.5 text-[11px] font-mono border border-rule bg-paper text-ink"
          >
            <option value="">Select a slot…</option>
            {Object.entries(groupSlotsBySource(rdfSlots)).map(([sourceFile, slots]) => (
              sourceFile ? (
                <optgroup key={sourceFile} label={sourceFile}>
                  {slots.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.key}{slot.units ? ` (${slot.units})` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : (
                slots.map((slot) => (
                  <option key={slot.key} value={slot.key}>
                    {slot.key}{slot.units ? ` (${slot.units})` : ''}
                  </option>
                ))
              )
            ))}
          </select>
        </div>
      )}

      {canDownloadCsv && (
        <div className="mt-2 pt-2 border-t border-rule flex items-center justify-between gap-2">
          <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Download CSV
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownloadCsv?.('wide')}
              className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors"
            >
              Wide
            </button>
            <button
              onClick={() => onDownloadCsv?.('stacked')}
              className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors"
            >
              Stacked
            </button>
          </div>
        </div>
      )}
      {loadError && (
        <p className="mt-2 text-[11px] text-red-600 font-mono">{loadError}</p>
      )}
      {onSidecar && (
        <div className="mt-2 pt-2 border-t border-rule flex items-center justify-between gap-3">
          <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Sidecar labels (optional)
          </span>
          <button
            onClick={() => sidecarRef.current?.click()}
            className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors"
          >
            Attach CSV
          </button>
          <input
            ref={sidecarRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onSidecar(e.target.files[0])}
          />
        </div>
      )}
      {onClassifications && (
        <div className="mt-2 pt-2 border-t border-rule flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
              Classification files (optional)
            </span>
            {classificationSchemeCount > 0 ? (
              <span className="font-mono text-[10px] text-ink">
                {classificationSchemeCount} scheme{classificationSchemeCount !== 1 ? 's' : ''} loaded
              </span>
            ) : (
              <span className="font-mono text-[10px] text-muted">
                Select one or more .txt files
              </span>
            )}
          </div>
          <button
            onClick={() => classificationsRef.current?.click()}
            className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors"
          >
            Browse
          </button>
          <input
            ref={classificationsRef}
            type="file"
            accept=".txt"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onClassifications(Array.from(e.target.files))
                e.target.value = ''
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
