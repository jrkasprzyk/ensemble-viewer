import { useEffect, useMemo, useState } from 'react'
import { OKABE_ITO } from '../lib/palette.js'
import { parseFiniteLabelNumber, BUNDLED_CATEGORY } from '../lib/labels.js'
import {
  DEFAULT_STYLE_MULTIPLIER,
  MIN_STYLE_MULTIPLIER,
  MAX_STYLE_MULTIPLIER,
  MIN_LINE_WIDTH,
  MAX_LINE_WIDTH,
} from '../lib/plotStyle.js'

// Editorial accent stripes tuned to the cream paper + burnt-orange palette.
// Five tones, each used in exactly one section: a colored left-edge rule
// plus a small-caps header in the same color.
const TONES = {
  display:        { edge: 'border-l-[#c94a1a]', text: 'text-[#c94a1a]' },
  faceting:       { edge: 'border-l-[#a87a2c]', text: 'text-[#a87a2c]' },
  filter:         { edge: 'border-l-[#6b7a3a]', text: 'text-[#6b7a3a]' },
  classification: { edge: 'border-l-[#8b2e2e]', text: 'text-[#8b2e2e]' },
  categories:     { edge: 'border-l-[#3f4a52]', text: 'text-[#3f4a52]' },
}

function Section({ tone, label, children, className = '' }) {
  const t = TONES[tone]
  return (
    <section className={`relative border border-rule border-l-[3px] ${t.edge} bg-paper rounded-sm p-3 flex flex-col gap-2 ${className}`}>
      <header className={`font-mono uppercase tracking-[0.18em] text-[10px] ${t.text}`}>
        {label}
      </header>
      {children}
    </section>
  )
}

/**
 * LabelControls
 *
 * Sidebar grouped into five sections, each with its own accent stripe:
 *   Display → Faceting → Filter → Classification → Categories
 *
 * A column is visible iff, for every category, its value is in the active set.
 */
export default function LabelControls({
  categoryValues,
  activeByCategory,
  onToggleValue,
  onToggleAll,
  colorBy,
  colorMap,
  onColorByChange,
  showBands,
  onShowBandsChange,
  xAxisLabel,
  yAxisLabel,
  defaultYAxisLabel,
  onXAxisLabelChange,
  onYAxisLabelChange,
  lineStyleControls,
  onLineStyleControlsChange,
  tickFormat,
  onTickFormatChange,
  bandsActive,
  axisRanges,
  onAxisRangesChange,
  indexType,
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
  sortRangeControl,
  onSortRangeChange,
  classificationSchemeNames = [],
  selectedHorizons,
  horizonLogic,
  bundledFilter,
  classificationFilter,
  onHorizonToggle,
  onHorizonDeselectAll,
  onHorizonLogicChange,
  onBundledFilterChange,
  onClassificationFilterChange,
}) {
  const categoryNames = useMemo(() => Object.keys(categoryValues), [categoryValues])
  const classificationSchemeSet = useMemo(() => new Set(classificationSchemeNames), [classificationSchemeNames])
  const [sortMinDraft, setSortMinDraft] = useState('')
  const [sortMaxDraft, setSortMaxDraft] = useState('')

  useEffect(() => {
    if (!sortRangeControl) {
      setSortMinDraft('')
      setSortMaxDraft('')
      return
    }
    setSortMinDraft(String(sortRangeControl.value.min))
    setSortMaxDraft(String(sortRangeControl.value.max))
  }, [sortRangeControl?.value.min, sortRangeControl?.value.max])

  const setAxis = (key) => (e) => {
    const value = e.target.value
    onAxisRangesChange(prev => ({ ...prev, [key]: value }))
  }
  const anyBound = axisRanges && (axisRanges.xMin || axisRanges.xMax || axisRanges.yMin || axisRanges.yMax)

  const yRangeError =
    axisRanges.yMin !== '' && axisRanges.yMax !== '' &&
    Number.isFinite(Number(axisRanges.yMin)) && Number.isFinite(Number(axisRanges.yMax)) &&
    Number(axisRanges.yMin) >= Number(axisRanges.yMax)

  const xRangeError = axisRanges.xMin !== '' && axisRanges.xMax !== '' && (
    indexType === 'datetime'
      ? axisRanges.xMin >= axisRanges.xMax
      : Number.isFinite(Number(axisRanges.xMin)) && Number.isFinite(Number(axisRanges.xMax)) &&
        Number(axisRanges.xMin) >= Number(axisRanges.xMax)
  )

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* ─────────────────────────── DISPLAY ─────────────────────────── */}
      <Section tone="display" label="Display">
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
            Bands require a color-by grouping — pick a category to color by first.
          </p>
        )}
        {showBands && colorBy && !bandsActive && (
          <p className="text-[11px] text-[#c94a1a]">
            Bands need ≥2 traces per colored group — none of the visible groups qualify yet.
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
            placeholder={defaultYAxisLabel || 'Pool Elevation (ft)'}
            className="px-2 py-1 border border-rule bg-paper font-mono"
          />
        </div>

        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer font-mono uppercase tracking-wider text-[10px] text-muted" aria-label="Line styling controls">
            Line styling
          </summary>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 items-center">
            <label htmlFor="line-thickness" className="font-mono text-[10px] text-muted">Thickness</label>
            <span className="font-mono text-[10px]">{lineStyleControls.thickness.toFixed(2)}×</span>
            <input
              id="line-thickness"
              type="range"
              min={MIN_STYLE_MULTIPLIER}
              max={MAX_STYLE_MULTIPLIER}
              step="0.05"
              value={lineStyleControls.thickness}
              disabled={Number.isFinite(lineStyleControls.widthOverride)}
              onChange={(e) => onLineStyleControlsChange({
                ...lineStyleControls,
                thickness: Number(e.target.value),
              })}
              className="col-span-2 accent-accent disabled:opacity-40"
            />
            <label htmlFor="line-opacity" className="font-mono text-[10px] text-muted">Opacity</label>
            <span className="font-mono text-[10px]">{lineStyleControls.opacity.toFixed(2)}×</span>
            <input
              id="line-opacity"
              type="range"
              min={MIN_STYLE_MULTIPLIER}
              max={MAX_STYLE_MULTIPLIER}
              step="0.05"
              value={lineStyleControls.opacity}
              disabled={Number.isFinite(lineStyleControls.opacityOverride)}
              onChange={(e) => onLineStyleControlsChange({
                ...lineStyleControls,
                opacity: Number(e.target.value),
              })}
              className="col-span-2 accent-accent disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => onLineStyleControlsChange({
                thickness: DEFAULT_STYLE_MULTIPLIER,
                opacity: DEFAULT_STYLE_MULTIPLIER,
                widthOverride: null,
                opacityOverride: null,
              })}
              className="justify-self-start text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
            >
              Reset line styling
            </button>
          </div>
          <div className="mt-1 flex flex-col gap-2 border-t border-rule pt-2">
            <span className="font-mono uppercase tracking-wider text-[10px] text-muted">Manual values</span>
            <p className="text-[10px] text-muted leading-snug">
              Enter an absolute value to override the auto sqrt(N) scaling for that dimension.
              Blank re-enables the slider.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label htmlFor="line-width-override" className="font-mono text-[10px] text-muted">
                  Width (px)
                </label>
                <input
                  id="line-width-override"
                  type="number"
                  step="0.1"
                  min={MIN_LINE_WIDTH}
                  max={MAX_LINE_WIDTH}
                  value={lineStyleControls.widthOverride ?? ''}
                  placeholder="auto"
                  onChange={(e) => {
                    const raw = e.target.value
                    const parsed = Number(raw)
                    onLineStyleControlsChange({
                      ...lineStyleControls,
                      widthOverride: raw === '' || !Number.isFinite(parsed) ? null : parsed,
                    })
                  }}
                  className="px-2 py-1 border border-rule bg-paper font-mono"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label htmlFor="line-opacity-override" className="font-mono text-[10px] text-muted">
                  Opacity (0–1)
                </label>
                <input
                  id="line-opacity-override"
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={lineStyleControls.opacityOverride ?? ''}
                  placeholder="auto"
                  onChange={(e) => {
                    const raw = e.target.value
                    const parsed = Number(raw)
                    onLineStyleControlsChange({
                      ...lineStyleControls,
                      opacityOverride: raw === '' || !Number.isFinite(parsed) ? null : parsed,
                    })
                  }}
                  className="px-2 py-1 border border-rule bg-paper font-mono"
                />
              </div>
            </div>
          </div>
        </details>

        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer font-mono uppercase tracking-wider text-[10px] text-muted" aria-label="Tick precision controls">
            Tick precision
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="x-tick-format" className="font-mono text-[10px] text-muted">
                X tick precision
              </label>
              <select
                id="x-tick-format"
                value={indexType === 'datetime' ? 'auto' : (tickFormat?.x ?? 'auto')}
                disabled={indexType === 'datetime'}
                onChange={(e) => onTickFormatChange('x', e.target.value)}
                className="px-2 py-1 border border-rule bg-paper font-mono disabled:opacity-40"
              >
                <option value="auto">{indexType === 'datetime' ? 'n/a (datetime)' : 'Auto'}</option>
                <option value="int">Integer</option>
                <option value="1">1 decimal</option>
                <option value="2">2 decimals</option>
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label htmlFor="y-tick-format" className="font-mono text-[10px] text-muted">
                Y tick precision
              </label>
              <select
                id="y-tick-format"
                value={tickFormat?.y ?? 'auto'}
                onChange={(e) => onTickFormatChange('y', e.target.value)}
                className="px-2 py-1 border border-rule bg-paper font-mono"
              >
                <option value="auto">Auto</option>
                <option value="int">Integer</option>
                <option value="1">1 decimal</option>
                <option value="2">2 decimals</option>
              </select>
            </div>
          </div>
        </details>

        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer font-mono uppercase tracking-wider text-[10px] text-muted" aria-label="Plot bounds controls">
            Plot bounds
            {anyBound ? <span className="ml-2 text-[#c94a1a] normal-case tracking-normal">●</span> : null}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-[10px] text-muted leading-snug">
              Leave blank for Plotly auto-range. Bounds persist across filter changes.
            </p>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-muted">Y axis</span>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Min</label>
                  <input
                    type="number"
                    step="any"
                    value={axisRanges.yMin}
                    onChange={setAxis('yMin')}
                    placeholder="auto"
                    className={`px-2 py-1 border bg-paper font-mono ${yRangeError ? 'border-red-500' : 'border-rule'}`}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Max</label>
                  <input
                    type="number"
                    step="any"
                    value={axisRanges.yMax}
                    onChange={setAxis('yMax')}
                    placeholder="auto"
                    className={`px-2 py-1 border bg-paper font-mono ${yRangeError ? 'border-red-500' : 'border-rule'}`}
                  />
                </div>
              </div>
              {yRangeError && (
                <p className="text-[10px] text-red-500">Min must be less than Max</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-muted">X axis</span>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Min</label>
                  <input
                    type={indexType === 'datetime' ? 'text' : 'number'}
                    step={indexType === 'datetime' ? undefined : 'any'}
                    value={axisRanges.xMin}
                    onChange={setAxis('xMin')}
                    placeholder={indexType === 'datetime' ? 'YYYY-MM-DD' : 'auto'}
                    className={`px-2 py-1 border bg-paper font-mono ${xRangeError ? 'border-red-500' : 'border-rule'}`}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Max</label>
                  <input
                    type={indexType === 'datetime' ? 'text' : 'number'}
                    step={indexType === 'datetime' ? undefined : 'any'}
                    value={axisRanges.xMax}
                    onChange={setAxis('xMax')}
                    placeholder={indexType === 'datetime' ? 'YYYY-MM-DD' : 'auto'}
                    className={`px-2 py-1 border bg-paper font-mono ${xRangeError ? 'border-red-500' : 'border-rule'}`}
                  />
                </div>
              </div>
              {xRangeError && (
                <p className="text-[10px] text-red-500">Min must be less than Max</p>
              )}
            </div>
            {anyBound && (
              <button
                type="button"
                onClick={() => onAxisRangesChange({ xMin: '', xMax: '', yMin: '', yMax: '' })}
                className="self-start text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
              >
                Clear all bounds
              </button>
            )}
          </div>
        </details>
      </Section>

      {/* ─────────────────────────── FACETING ─────────────────────────── */}
      <Section tone="faceting" label="Faceting">
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
      </Section>

      {/* ─────────────────────────── FILTER ─────────────────────────── */}
      <Section tone="filter" label="Filter">
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
                    value={sortMinDraft}
                    min={sortRangeControl.domain.min}
                    max={sortRangeControl.value.max}
                    step="any"
                    onChange={(e) => {
                      const raw = e.target.value
                      setSortMinDraft(raw)
                      if (raw === '') return
                      const parsed = Number(raw)
                      if (!Number.isFinite(parsed)) return
                      const min = Math.min(parsed, sortRangeControl.value.max)
                      onSortRangeChange({ min, max: sortRangeControl.value.max })
                    }}
                    onBlur={() => {
                      if (sortMinDraft === '' || !Number.isFinite(Number(sortMinDraft))) {
                        setSortMinDraft(String(sortRangeControl.value.min))
                      }
                    }}
                    className="px-2 py-1 border border-rule bg-paper font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[10px] text-muted">Max</label>
                  <input
                    type="number"
                    value={sortMaxDraft}
                    min={sortRangeControl.value.min}
                    max={sortRangeControl.domain.max}
                    step="any"
                    onChange={(e) => {
                      const raw = e.target.value
                      setSortMaxDraft(raw)
                      if (raw === '') return
                      const parsed = Number(raw)
                      if (!Number.isFinite(parsed)) return
                      const max = Math.max(parsed, sortRangeControl.value.min)
                      onSortRangeChange({ min: sortRangeControl.value.min, max })
                    }}
                    onBlur={() => {
                      if (sortMaxDraft === '' || !Number.isFinite(Number(sortMaxDraft))) {
                        setSortMaxDraft(String(sortRangeControl.value.max))
                      }
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
      </Section>

      {/* ─────────────────────────── CLASSIFICATION ─────────────────────────── */}
      {classificationSchemeNames.length > 0 && (
        <Section tone="classification" label="Classification">
          <div className="border border-rule rounded-sm">
            <div className="px-3 py-2 border-b border-rule flex items-center justify-between gap-2">
              <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
                Bundled
              </span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="color-by"
                  checked={colorBy === BUNDLED_CATEGORY}
                  onChange={() => onColorByChange(BUNDLED_CATEGORY)}
                  disabled={!selectedHorizons.size}
                  className="accent-accent"
                />
                <span className={`text-[10px] font-mono uppercase tracking-wider ${!selectedHorizons.size ? 'text-muted' : ''}`}>
                  Color
                </span>
              </label>
            </div>
            <div className="px-3 py-2 flex flex-col gap-2">
              <button
                onClick={onHorizonDeselectAll}
                className="self-start text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
              >
                Deselect all
              </button>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {classificationSchemeNames.map((scheme) => (
                  <label key={scheme} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedHorizons.has(scheme)}
                      onChange={() => onHorizonToggle(scheme)}
                      className="accent-accent"
                    />
                    <span className="font-mono text-[10px]">{scheme}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted font-mono">Logic:</span>
                {['AND', 'OR'].map((l) => (
                  <label key={l} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="horizon-logic"
                      checked={horizonLogic === l}
                      onChange={() => onHorizonLogicChange(l)}
                      className="accent-accent"
                    />
                    <span className="font-mono text-[10px]">{l}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted font-mono">Filter:</span>
                {['Failure', 'Success'].map((v) => {
                  const swatch = colorBy === BUNDLED_CATEGORY ? (colorMap?.[v] ?? '#b5b2aa') : '#b5b2aa'
                  return (
                  <label key={v} className={`flex items-center gap-1 ${selectedHorizons.size ? 'cursor-pointer' : 'cursor-default'}`}>
                    <input
                      type="checkbox"
                      checked={bundledFilter.has(v)}
                      onChange={() => onBundledFilterChange(v)}
                      disabled={!selectedHorizons.size}
                      className="accent-accent"
                    />
                    <span
                      className="inline-block w-3 h-3 rounded-sm border border-rule"
                      style={{ background: swatch }}
                    />
                    <span className={`font-mono text-[10px] ${!selectedHorizons.size ? 'text-muted' : ''}`}>{v}</span>
                  </label>
                  )
                })}
              </div>
              {!selectedHorizons.size && (
                <p className="text-[11px] text-muted">Select time horizons to enable bundled classification.</p>
              )}
            </div>
          </div>

          <div className="border border-rule rounded-sm">
            <div className="px-3 py-2 border-b border-rule flex items-center gap-3">
              <span className="font-mono uppercase tracking-wider text-[10px] text-muted">
                Individual
              </span>
              <div className="flex items-center gap-3 ml-auto">
                {['Failure', 'Success'].map((v) => {
                  const active = classificationSchemeSet.has(colorBy)
                  const swatch = active ? (colorMap?.[v] ?? '#b5b2aa') : '#b5b2aa'
                  return (
                    <label key={v} className={`flex items-center gap-1 ${active ? 'cursor-pointer' : 'cursor-default'}`}>
                      <input
                        type="checkbox"
                        checked={classificationFilter.has(v)}
                        onChange={() => onClassificationFilterChange(v)}
                        disabled={!active}
                        className="accent-accent"
                      />
                      <span
                        className="inline-block w-3 h-3 rounded-sm border border-rule"
                        style={{ background: swatch }}
                      />
                      <span className={`font-mono text-[10px] ${!active ? 'text-muted' : ''}`}>{v}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="px-3 py-2 flex flex-col gap-1">
              {classificationSchemeNames.map((scheme) => (
                <div key={scheme} className="flex items-center justify-between">
                  <span className="font-mono text-[10px]">{scheme}</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="color-by"
                      checked={colorBy === scheme}
                      onChange={() => onColorByChange(scheme)}
                      className="accent-accent"
                    />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Color</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ─────────────────────────── CATEGORIES ─────────────────────────── */}
      {categoryNames.length === 0 ? (
        <Section tone="categories" label="Categories">
          <p className="text-muted">No labels detected. Configure a label strategy.</p>
        </Section>
      ) : (
        <Section tone="categories" label="Categories">
          {categoryNames.map((cat) => {
            if (classificationSchemeSet.has(cat) || cat === BUNDLED_CATEGORY) return null
            const rawValues = categoryValues[cat]
            const active = activeByCategory[cat] || new Set()
            const isSortTarget = cat === sortCategory || cat.split(' + ').includes(sortCategory)
            const sortKeyIndex = isSortTarget && cat !== sortCategory
              ? cat.split(' + ').indexOf(sortCategory)
              : -1
            const values = isSortTarget
              ? [...rawValues].sort((a, b) => {
                  const parts_a = a.split(' | ')
                  const parts_b = b.split(' | ')
                  const raw_a = sortKeyIndex >= 0 ? parts_a[sortKeyIndex] : (a.includes(' | ') ? parts_a[0] : a)
                  const raw_b = sortKeyIndex >= 0 ? parts_b[sortKeyIndex] : (b.includes(' | ') ? parts_b[0] : b)
                  const ka = parseFiniteLabelNumber(raw_a)
                  const kb = parseFiniteLabelNumber(raw_b)
                  if (ka !== null && kb !== null) return ka - kb
                  if (ka !== null) return -1
                  if (kb !== null) return 1
                  return 0
                })
              : rawValues
            return (
              <div key={cat} className="border border-rule rounded-sm">
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
        </Section>
      )}
    </div>
  )
}
