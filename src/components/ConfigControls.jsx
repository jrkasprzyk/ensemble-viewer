import { useRef } from 'react'
import { serializeConfig, parseConfig } from '../lib/config.js'

/**
 * ConfigControls (Phase 6a — TASK-028).
 *
 * Save / load the full left-panel configuration as versioned XML.
 *   - Save: gather current state via `getConfig()` → serializeConfig → Blob
 *     download `ensemble-viewer-config.xml`.
 *   - Load: read an `.xml` file → parseConfig → `onLoadConfig(parsed)`.
 *
 * Parse errors are surfaced through the parent's existing error channel
 * (`onError`) rather than thrown, per SEC-001.
 *
 * Loading a config restores controls only — it never re-parses data
 * (DR-08); the parent's applyConfig overlays the parsed values onto its
 * DEFAULT_CONFIG.
 */
export default function ConfigControls({ getConfig, onLoadConfig, onError }) {
  const inputRef = useRef(null)

  function handleSave() {
    try {
      const xml = serializeConfig(getConfig())
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ensemble-viewer-config.xml'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      onError?.(e.message || String(e))
    }
  }

  async function handleLoad(file) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseConfig(text)
      onLoadConfig?.(parsed)
    } catch (e) {
      console.error(e)
      onError?.(e.message || String(e))
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="relative border border-rule border-l-[3px] border-l-[#3f4a52] bg-paper rounded-sm p-3 flex flex-col gap-2 text-xs">
      <header className="font-mono uppercase tracking-[0.18em] text-[10px] text-[#3f4a52]">
        Configuration
      </header>
      <p className="text-[10px] text-muted leading-snug">
        Save the current left-panel settings to a reusable XML preset, or load one.
        Loading restores controls only — it never re-reads the data file.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors"
        >
          Save config
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors"
        >
          Load config
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          className="hidden"
          onChange={(e) => handleLoad(e.target.files?.[0])}
        />
      </div>
    </section>
  )
}
