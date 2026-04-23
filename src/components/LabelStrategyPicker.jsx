import { useState } from 'react'

/**
 * LabelStrategyPicker
 *
 * After a file is loaded, the user picks how labels are derived:
 *   - 'headers': stacked header rows in the file itself (requires re-parse)
 *   - 'names':   split each column name by a delimiter
 *   - 'sidecar': separate CSV upload that maps column → categories
 *
 * We surface all three because in practice people's data arrives in all three
 * conventions, and it's cheaper to let the user pick than to guess.
 */
export default function LabelStrategyPicker({
  strategy, onStrategyChange,
  labelRowCount, onLabelRowCountChange,
  delimiter, onDelimiterChange,
  categoriesText, onCategoriesTextChange,
  onApply,
  onReparse,
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-rule bg-paper rounded-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted hover:text-ink"
      >
        <span>Label strategy</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs">
            {[
              ['headers', 'Stacked header rows in file'],
              ['names', 'Parse from column names'],
              ['sidecar', 'Sidecar CSV (upload above)'],
            ].map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="label-strategy"
                  value={val}
                  checked={strategy === val}
                  onChange={() => onStrategyChange(val)}
                  className="accent-accent"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {strategy === 'headers' && (
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
                # label rows above the header
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={labelRowCount}
                onChange={(e) => onLabelRowCountChange(Number(e.target.value))}
                className="px-2 py-1 border border-rule bg-paper font-mono"
              />
              <button
                onClick={onReparse}
                className="mt-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-ink hover:bg-ink hover:text-paper"
              >
                Re-parse file
              </button>
            </div>
          )}

          {strategy === 'names' && (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
                  Delimiter
                </label>
                <input
                  type="text"
                  value={delimiter}
                  onChange={(e) => onDelimiterChange(e.target.value)}
                  className="px-2 py-1 border border-rule bg-paper font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono uppercase tracking-wider text-[10px] text-muted">
                  Category names (comma-separated, optional)
                </label>
                <input
                  type="text"
                  placeholder="scenario, gcm, run"
                  value={categoriesText}
                  onChange={(e) => onCategoriesTextChange(e.target.value)}
                  className="px-2 py-1 border border-rule bg-paper font-mono"
                />
              </div>
              <button
                onClick={onApply}
                className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-ink hover:bg-ink hover:text-paper"
              >
                Apply
              </button>
            </div>
          )}

          {strategy === 'sidecar' && (
            <p className="text-xs text-muted">
              Upload a sidecar CSV using the attach button in the file area. First
              column should match data column names; remaining columns are
              treated as categories.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
