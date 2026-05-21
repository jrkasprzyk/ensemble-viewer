import { useMemo } from 'react'
import createPlotlyFactory from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
// Support both CommonJS and ESM shapes for the factory and Plotly imports.
const createPlotlyComponent = createPlotlyFactory?.default ?? createPlotlyFactory
const PlotlyLib = Plotly?.default ?? Plotly
const Plot = createPlotlyComponent(PlotlyLib)
import { NEUTRAL_GRAY } from '../lib/palette.js'
import { computeGroupStats } from '../lib/stats.js'

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
  indexType,        // 'datetime' | 'numeric'
  xAxisLabel,       // optional x-axis label override
  yAxisLabel,       // optional y-axis label
}) {
  const { traces, layout } = useMemo(() => {
    if (!rows || !rows.length) return { traces: [], layout: {} }

    const x = rows.map((r) => r[indexColumn])

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
        line: { width: 1, color },
        opacity: showBands ? 0.25 : 0.55,
        hovertemplate: `<b>${col}</b>` +
          Object.entries(labelsByColumn[col] ?? {}).map(([k, v]) => `<br>${k}: ${v}`).join('') +
          `<br>%{x}: %{y:.4g}<extra></extra>`,
        visible: visible ? true : false,
        legendgroup: colorBy ? `g-${categoryVal}` : undefined,
        showlegend: false, // the side panel is the primary filter; Plotly legend would be 500 items
      })
    }

    // Summary bands per colorBy group
    if (showBands && colorBy) {
      const groups = {} // value -> [columns]
      for (const c of columns) {
        if (!visibleColumns.has(c)) continue
        const v = labelsByColumn[c]?.[colorBy] ?? ''
        ;(groups[v] ??= []).push(c)
      }
      for (const [val, groupCols] of Object.entries(groups)) {
        if (groupCols.length < 2) continue // band of one is just the line
        const { mean, percentiles } = computeGroupStats(rows, indexColumn, groupCols, [0.1, 0.5, 0.9])
        const color = resolvedColorMap[val] || NEUTRAL_GRAY
        const rgba = hexToRgba(color, 0.18)

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
          name: `${val} p10–p90`,
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
          name: `${val} mean`,
          line: { width: 2.5, color },
          legendgroup: `band-${val}`,
          hovertemplate: `<b>${val} mean</b><br>%{x}: %{y:.4g}<extra></extra>`,
        })
      }
    }

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
      },
      yaxis: {
        gridcolor: '#e6e3db',
        linecolor: '#1a1a1a',
        ticks: 'outside',
        tickcolor: '#1a1a1a',
        title: yAxisLabel ? { text: yAxisLabel, standoff: 8 } : undefined,
        zeroline: false,
      },
      showlegend: showBands && !!colorBy,
      legend: {
        bgcolor: 'rgba(250,250,247,0.9)',
        bordercolor: '#d9d7d0',
        borderwidth: 1,
        font: { family: 'JetBrains Mono, monospace', size: 11 },
      },
      hoverlabel: { font: { family: 'JetBrains Mono, monospace' } },
    }

    return { traces, layout }
  }, [rows, indexColumn, columns, labelsByColumn, colorBy, colorMap, visibleColumns, showBands, indexType, xAxisLabel, yAxisLabel])

  return (
    <Plot
      data={traces}
      layout={layout}
      useResizeHandler
      style={{ width: '100%', height: '100%' }}
      config={{
        displaylogo: false,
        responsive: true,
        toImageButtonOptions: { format: 'svg', filename: 'ensemble' },
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      }}
    />
  )
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}
