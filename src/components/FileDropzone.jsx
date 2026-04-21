import { useRef, useState } from 'react'

export default function FileDropzone({ onFile, onSidecar, hasData }) {
  const inputRef = useRef(null)
  const sidecarRef = useRef(null)
  const [drag, setDrag] = useState(false)

  function handleFiles(files) {
    if (!files || !files.length) return
    onFile(files[0])
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        handleFiles(e.dataTransfer.files)
      }}
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
            {hasData ? 'Replace CSV or XLSX…' : 'Drop CSV or XLSX, or click to browse'}
          </span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-ink hover:bg-ink hover:text-paper transition-colors"
        >
          Browse
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
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
    </div>
  )
}
