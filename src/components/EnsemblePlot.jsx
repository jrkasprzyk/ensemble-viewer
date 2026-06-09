import { useCallback, useId, useMemo, useRef, useState } from 'react'
import createPlotlyFactory from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
// Support both CommonJS and ESM shapes for the factory and Plotly imports.
const createPlotlyComponent = createPlotlyFactory?.default ?? createPlotlyFactory
const PlotlyLib = Plotly?.default ?? Plotly
const Plot = createPlotlyComponent(PlotlyLib)
import { NEUTRAL_GRAY } from '../lib/palette.js'
import { computeGroupStats } from '../lib/stats.js'
import { resolveLineStyling, tickFormatString, buildLegendTraces, escapePlotlyText } from '../lib/plotStyle.js'

const DOWNLOAD_FORMATS = ['svg', 'png']

/**
 * EnsemblePlot
 *
 * Renders the ensemble as individual timeseries traces plus (optionally) per-
 * group summary bands (median line with a shaded p10-p90 region).
 *
 * Design decisions:
 *   - Individual traces use scattergl (WebGL). At N~500 × T~thousands,
 *     scatter (SVG) will grind; scattergl is the right default.
 *   - Summary bands use regular scatter with a filled area, because there's
 *     only a handful of them and SVG exports better for publications.
 *   - Traces are hidden by setting visible: 'legendonly' rather than removed,
 *     so Plotly's own legend continues to work as a secondary filter.
 */
export default function EnsemblePlot({
  rows,
  indexColumn,
  columns,
  labelsByColumn,
  colorBy,          // category name to color by, or null for neutral
  colorMap,         // pre-built { value → hex } map from App
  visibleColumns,   // Set<string> of columns currently shown
  showBands,        // boolean — draw percentile bands per group
  showPlotLegend = true, // boolean — show the on-figure colorBy legend
  indexType,        // 'datetime' | 'numeric'
  xAxisLabel,       // optional x-axis label override
  yAxisLabel,       // optional y-axis label (manual override)
  defaultYAxisLabel, // auto-derived y-axis label from slot/units (DR-09 fallback)
  lineStyleControls, // { thickness, opacity, widthOverride, opacityOverride }
  tickFormat,        // { x: 'auto'|'int'|'1'|'2', y: ... } per-axis tick precision
  axisRanges,        // { xMin, xMax, yMin, yMax } strings; empty = auto
}) {
  const downloadFormatId = useId()
  const plotDivRef = useRef(null)
  const [downloadFormat, setDownloadFormat] = useState('svg')
  const canDownloadPlot = typeof PlotlyLib?.downloadImage === 'function'
  const { traces, layout } = useMemo(() => {
    if (!rows || !rows.length) return { traces: [], layout: {} }

    const x = rows.map((r) => r[indexColumn])
    const visibleLineCount = Math.max(1, columns.filter((col) => visibleColumns.has(col)).length)

    // Group visible columns by colorBy value so we know which groups can produce a band.
    // Bands draw only for groups with >=2 visible members (a band of one is just the line).
    const groups = {} // value -> [columns]
    if (colorBy) {
      for (const c of columns) {
        if (!visibleColumns.has(c)) continue
        const v = labelsByColumn[c]?.[colorBy] ?? ''
        ;(groups[v] ??= []).push(c)
      }
    }
    // bandsActive: bands are ACTUALLY drawn (DR-06). Dimming keys off this, not raw showBands,
    // so traces are never dimmed when zero bands render (the "everything got lighter" defect).
    const bandsActive =
      showBands && !!colorBy && Object.values(groups).some((g) => g.length >= 2)

    const { lineWidth: individualLineWidth, opacity: individualOpacity } = resolveLineStyling(
      visibleLineCount,
      bandsActive,
      lineStyleControls
    )

    // Color map provided by App (single source of truth)
    const resolvedColorMap = colorMap ?? {}

    const traces = []

    // Individual traces (WebGL for speed)
    for (const col of columns) {
      const visible = visibleColumns.has(col)
      const categoryVal = colorBy ? labelsByColumn[col]?.[colorBy] ?? '' : null
      const color = colorBy ? (resolvedColorMap[categoryVal] ?? NEUTRAL_GRAY) : NEUTRAL_GRAY
      traces.push({
        type: 'scattergl',
        mode: 'lines',
        name: col,
        x,
        y: rows.map((r) => r[col]),
        line: { width: individualLineWidth, color },
        opacity: individualOpacity,
        // Column names and label values come from the uploaded file — escape
        // them so they can't inject HTML or %{...} directives into the tooltip.
        hovertemplate: `<b>${escapePlotlyText(col, { template: true })}</b>` +
          Object.entries(labelsByColumn[col] ?? {})
            .map(([k, v]) => `<br>${escapePlotlyText(k, { template: true })}: ${escapePlotlyText(v, { template: true })}`)
            .join('') +
          `<br>%{x}: %{y:.4g}<extra></extra>`,
        visible: visible ? true : false,
        legendgroup: colorBy ? `g-${categoryVal}` : undefined,
        showlegend: false, // the side panel is the primary filter; Plotly legend would be 500 items
      })
    }

    // Summary bands per colorBy group (reuse the groups computed above).
    // Mean lines are regular `scatter` (SVG), which Plotly renders above the
    // `scattergl` (WebGL) individual traces, so the mean always sits on top.
    if (bandsActive) {
      for (const [val, groupCols] of Object.entries(groups)) {
        if (groupCols.length < 2) continue // band of one is just the line
        const { mean, percentiles } = computeGroupStats(rows, indexColumn, groupCols, [0.1, 0.5, 0.9])
        const color = resolvedColorMap[val] || NEUTRAL_GRAY
        const rgba = hexToRgba(color, 0.25)

        // Lower bound — invisible line used only as the bottom anchor for the fill.
        // ORDERING CONSTRAINT: this trace MUST be pushed immediately before the
        // upper-bound trace below. Plotly's `fill: 'tonexty'` fills between a
        // trace and the trace that was added directly before it in the array.
        // Inserting any other trace between these two breaks the shading.
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x,
          y: percentiles['0.1'],
          line: { width: 0, color },
          hoverinfo: 'skip',
          showlegend: false,
          legendgroup: `band-${val}`,
        })
        // Upper bound — fills back to the lower-bound trace directly above.
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x,
          y: percentiles['0.9'],
          line: { width: 0, color },
          fill: 'tonexty',
          fillcolor: rgba,
          name: `${escapePlotlyText(val)} p10–p90`,
          hoverinfo: 'skip',
          showlegend: true,
          legendgroup: `band-${val}`,
        })
        // Mean line
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x,
          y: mean,
          name: `${escapePlotlyText(val)} mean`,
          line: { width: 2.5, color },
          legendgroup: `band-${val}`,
          hovertemplate: `<b>${escapePlotlyText(val, { template: true })} mean</b><br>%{x}: %{y:.4g}<extra></extra>`,
        })
      }
    }

    // Synthetic legend-only traces: give the figure a colorBy key that exports
    // with SVG/PNG without enabling the unusable per-column legend. Skipped when
    // bands are active (they already legend per group) — see buildLegendTraces.
    const legendColorMap = Object.fromEntries(
      Object.keys(groups).map((v) => [v, resolvedColorMap[v] ?? NEUTRAL_GRAY])
    )
    const legendTraces = buildLegendTraces({ colorBy, resolvedColorMap: legendColorMap, bandsActive, showPlotLegend })
    traces.push(...legendTraces)

    const layout = {
      autosize: true,
      margin: { l: 56, r: 16, t: 16, b: 44 },
      paper_bgcolor: '#fafaf7',
      plot_bgcolor: '#fafaf7',
      font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 12, color: '#1a1a1a' },
      xaxis: {
        type: indexType === 'datetime' ? 'date' : 'linear',
        gridcolor: '#e6e3db',
        linecolor: '#1a1a1a',
        ticks: 'outside',
        tickcolor: '#1a1a1a',
        title: { text: xAxisLabel || indexColumn, standoff: 8 },
        ...tickFormatLayout(tickFormat?.x, indexType),
        ...rangeForAxis(axisRanges?.xMin, axisRanges?.xMax, indexType),
      },
      yaxis: {
        gridcolor: '#e6e3db',
        linecolor: '#1a1a1a',
        ticks: 'outside',
        tickcolor: '#1a1a1a',
        // DR-09: manual yAxisLabel (non-empty) wins; else the auto-derived default.
        title: (yAxisLabel || defaultYAxisLabel)
          ? { text: yAxisLabel || defaultYAxisLabel, standoff: 8 }
          : undefined,
        zeroline: false,
        ...tickFormatLayout(tickFormat?.y, 'numeric'),
        ...rangeForAxis(axisRanges?.yMin, axisRanges?.yMax),
      },
      showlegend: bandsActive || legendTraces.length > 0,
      legend: {
        bgcolor: 'rgba(250,250,247,0.9)',
        bordercolor: '#d9d7d0',
        borderwidth: 1,
        font: { family: 'JetBrains Mono, monospace', size: 11 },
      },
      hoverlabel: { font: { family: 'JetBrains Mono, monospace' } },
    }

    return { traces, layout }
  }, [rows, indexColumn, columns, labelsByColumn, colorBy, colorMap, visibleColumns, showBands, showPlotLegend, indexType, xAxisLabel, yAxisLabel, defaultYAxisLabel, lineStyleControls, tickFormat, axisRanges])

  const handleDownload = useCallback(() => {
    if (!plotDivRef.current || !canDownloadPlot) return
    PlotlyLib.downloadImage(plotDivRef.current, {
      format: downloadFormat,
      filename: 'ensemble',
    })
  }, [canDownloadPlot, downloadFormat])

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor={downloadFormatId} className="text-[10px] font-mono uppercase tracking-wider">
          Download format
        </label>
        <select
          id={downloadFormatId}
          value={downloadFormat}
          onChange={(event) => setDownloadFormat(event.target.value)}
          className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule bg-paper text-ink"
        >
          {DOWNLOAD_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!canDownloadPlot}
          className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-rule hover:border-ink transition-colors disabled:cursor-not-allowed"
        >
          Download plot
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <Plot
          data={traces}
          layout={layout}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
          onInitialized={(_, graphDiv) => {
            plotDivRef.current = graphDiv
          }}
          onUpdate={(_, graphDiv) => {
            plotDivRef.current = graphDiv
          }}
          config={{
            displaylogo: false,
            responsive: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
          }}
        />
      </div>
    </div>
  )
}

// Returns { tickformat } when a precision override applies, or {} to omit the key
// entirely (Plotly auto-format). Datetime axes never receive an override.
function tickFormatLayout(option, axisType) {
  const fmt = tickFormatString(option ?? 'auto', axisType)
  return fmt ? { tickformat: fmt } : {}
}

function rangeForAxis(minRaw, maxRaw, axisType = 'numeric') {
  const parse = (v) => {
    if (v === undefined || v === null || v === '') return null
    if (axisType === 'datetime') return String(v)
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const lo = parse(minRaw)
  const hi = parse(maxRaw)
  if (lo === null && hi === null) return {}
  if (lo !== null && hi !== null) {
    if (lo >= hi) return {}
    return { autorange: false, range: [lo, hi] }
  }
  // Partial bounds: fix one side, let Plotly auto-fit the other side to the data.
  // `autorange: 'min'` means "extend the min automatically" (so we're fixing max);
  // `autorange: 'max'` means "extend the max automatically" (so we're fixing min).
  if (lo === null) return { autorange: 'min', range: [null, hi] }
  return { autorange: 'max', range: [lo, null] }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}
