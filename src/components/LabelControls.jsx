import { useMemo } from 'react'
import { OKABE_ITO } from '../lib/palette.js'
import { parseFiniteLabelNumber } from '../lib/labels.js'

/**
 * LabelControls
 *
 * For each discovered category (e.g. "scenario", "gcm"), render a section with:
 *   - a "color by" radio to pick which category drives the palette
 *   - checkboxes for each unique value to toggle traces with that label
 *
 * A column is visible iff, for every category, its value is in the active set.
 */
export default function LabelControls({
  categoryValues,     // { categoryName: string[] }
  activeByCategory,   // { categoryName: Set<string> }
  onToggleValue,
  onToggleAll,
  colorBy,
  colorMap,
  onColorByChange,
  showBands,
  onShowBandsChange,
  xAxisLabel,
  yAxisLabel,
  onXAxisLabelChange,
  onYAxisLabelChange,
  splitBy,
  onSplitByChange,
  tieCategoryA,
  tieCategoryB,
  onTieCategoryAChange,
  onTieCategoryBChange,
  tieCategoryOptions,
  sortCategory,
  onSortCategoryChange,
  numericCategories,
  sortRangeControl,   // { domain: { min, max }, value: { min, max } } | null
  onSortRangeChange,
}) {
  const categoryNames = useMemo(() => Object.keys(categoryValues), [categoryValues])

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="border border-rule bg-paper rounded-sm p-3 flex flex-col gap-2">
        <div className="font-mono uppercase tracking-wider text-[10px] text-muted">
          Display
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showBands}
            onChange={(e) => onShowBandsChange(e.target.checked)}
            disabled={!colorBy}
            className="accent-accent"
          />
          <span className={colorBy ? '' : 'text-muted'}>
            Show mean + p10–p90 bands per group
          </span>
        </label>
        {!colorBy && (
          <p className="text-[11px] text-muted">
            Pick a category to color by — bands require a grouping.
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
            X axis label (optional)
          </label>
          <input
            type="text"
            value={xAxisLabel}
            onChange={(e) => onXAxisLabelChange(e.target.value)}
            placeholder="year"
            className="px-2 py-1 border border-rule bg-paper font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Y axis label (optional)
          </label>
          <input
            type="text"
            value={yAxisLabel}
            onChange={(e) => onYAxisLabelChange(e.target.value)}
            placeholder="Pool Elevation (ft)"
            className="px-2 py-1 border border-rule bg-paper font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Multiple plots by
          </label>
          <select
            value={splitBy}
            onChange={(e) => onSplitByChange(e.target.value)}
            className="px-2 py-1 border border-rule bg-paper font-mono"
          >
            <option value="">Single plot</option>
            {categoryNames.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Tie labels together
          </label>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={tieCategoryA}
              onChange={(e) => onTieCategoryAChange(e.target.value)}
              className="px-2 py-1 border border-rule bg-paper font-mono"
            >
              <option value="">None</option>
              {tieCategoryOptions.map((cat) => (
                <option key={cat} value={cat} disabled={cat === tieCategoryB}>{cat}</option>
              ))}
            </select>
            <select
              value={tieCategoryB}
              onChange={(e) => onTieCategoryBChange(e.target.value)}
              className="px-2 py-1 border border-rule bg-paper font-mono"
            >
              <option value="">None</option>
              {tieCategoryOptions.map((cat) => (
                <option key={cat} value={cat} disabled={cat === tieCategoryA}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
            Sort / filter by
          </label>
          <select
            value={sortCategory}
            onChange={(e) => onSortCategoryChange(e.target.value)}
            className="px-2 py-1 border border-rule bg-paper font-mono"
          >
            <option value="">None</option>
            {(numericCategories || []).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {sortRangeControl && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="grid grid-cols-2 gap-1">
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Min</label>
                  <input
                    type="number"
                    value={sortRangeControl.value.min}
                    min={sortRangeControl.domain.min}
                    max={sortRangeControl.value.max}
                    step="any"
                    onChange={(e) => {
                      const min = Math.min(Number(e.target.value), sortRangeControl.value.max)
                      onSortRangeChange({ min, max: sortRangeControl.value.max })
                    }}
                    className="px-2 py-1 border border-rule bg-paper font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Max</label>
                  <input
                    type="number"
                    value={sortRangeControl.value.max}
                    min={sortRangeControl.value.min}
                    max={sortRangeControl.domain.max}
                    step="any"
                    onChange={(e) => {
                      const max = Math.max(Number(e.target.value), sortRangeControl.value.min)
                      onSortRangeChange({ min: sortRangeControl.value.min, max })
                    }}
                    className="px-2 py-1 border border-rule bg-paper font-mono"
                  />
                </div>
              </div>
              {sortRangeControl.value.min !== sortRangeControl.domain.min ||
               sortRangeControl.value.max !== sortRangeControl.domain.max ? (
                <button
                  onClick={() => onSortRangeChange(null)}
                  className="self-start text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
                >
                  Clear range
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {categoryNames.length === 0 && (
        <p className="text-muted">No labels detected. Configure a label strategy.</p>
      )}

      {categoryNames.map((cat) => {
        const rawValues = categoryValues[cat]
        const active = activeByCategory[cat] || new Set()
        const values = cat === sortCategory
          ? [...rawValues].sort((a, b) => {
              const isTied = a.includes(' | ')
              const ka = parseFiniteLabelNumber(isTied ? a.split(' | ')[0] : a)
              const kb = parseFiniteLabelNumber(isTied ? b.split(' | ')[0] : b)
              if (ka !== null && kb !== null) return ka - kb
              if (ka !== null) return -1
              if (kb !== null) return 1
              return 0
            })
          : rawValues
        return (
          <div key={cat} className="border border-rule bg-paper rounded-sm">
            <div className="px-3 py-2 border-b border-rule flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
                  {cat}
                </span>
                <span className="text-[10px] text-muted">
                  {active.size}/{values.length}
                </span>
              </div>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="color-by"
                  checked={colorBy === cat}
                  onChange={() => onColorByChange(cat)}
                  className="accent-accent"
                />
                <span className="text-[10px] font-mono uppercase tracking-wider">
                  Color
                </span>
              </label>
            </div>
            <div className="px-3 py-2 flex flex-col gap-1 max-h-64 overflow-y-auto">
              <button
                onClick={() => onToggleAll(cat)}
                className="self-start text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
              >
                {active.size === values.length ? 'Deselect all' : 'Select all'}
              </button>
              {values.map((v) => {
                const swatch = colorBy === cat ? (colorMap?.[v] ?? '#b5b2aa') : '#b5b2aa'
                return (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active.has(v)}
                      onChange={() => onToggleValue(cat, v)}
                      className="accent-accent"
                    />
                    <span
                      className="inline-block w-3 h-3 rounded-sm border border-rule"
                      style={{ background: swatch }}
                    />
                    <span className="font-mono truncate">{v || '⟨empty⟩'}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {colorBy && (
        <button
          onClick={() => onColorByChange(null)}
          className="self-start text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
        >
          Clear color-by
        </button>
      )}
    </div>
  )
}
