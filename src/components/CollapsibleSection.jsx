/**
 * CollapsibleSection
 *
 * A drop-in replacement for the static `Section` used across the left panel.
 * Renders a bordered card with a coloured left-edge accent stripe (matching
 * the existing TONES palette) whose body can be shown/hidden by clicking the
 * header row.  A chevron rotates 180° when open.
 *
 * Props
 *   tone          – one of the TONES keys ('display' | 'faceting' | 'filter'
 *                   | 'classification' | 'categories' | 'data' | 'labels' | 'config')
 *   label         – header text (small-caps mono)
 *   defaultOpen   – whether the section starts expanded (default: true)
 *   badge         – optional short string rendered after the label (e.g. "3/5")
 *   children
 */

import { useState } from 'react'

const TONES = {
  display:        { edge: 'border-l-[#c94a1a]', text: 'text-[#c94a1a]' },
  faceting:       { edge: 'border-l-[#a87a2c]', text: 'text-[#a87a2c]' },
  filter:         { edge: 'border-l-[#6b7a3a]', text: 'text-[#6b7a3a]' },
  classification: { edge: 'border-l-[#8b2e2e]', text: 'text-[#8b2e2e]' },
  categories:     { edge: 'border-l-[#3f4a52]', text: 'text-[#3f4a52]' },
  data:           { edge: 'border-l-[#4a6fa5]', text: 'text-[#4a6fa5]' },
  labels:         { edge: 'border-l-[#7a5c8a]', text: 'text-[#7a5c8a]' },
  config:         { edge: 'border-l-[#3f4a52]', text: 'text-[#3f4a52]' },
}

export default function CollapsibleSection({
  tone = 'categories',
  label,
  defaultOpen = true,
  badge,
  children,
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen)
  const t = TONES[tone] ?? TONES.categories

  return (
    <section
      className={`relative border border-rule border-l-[3px] ${t.edge} bg-paper rounded-sm flex flex-col ${className}`}
    >
      {/* ── Header / toggle ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 gap-2
          font-mono uppercase tracking-[0.18em] text-[10px] ${t.text}
          hover:opacity-80 transition-opacity`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {label}
          {badge != null && (
            <span className="text-muted normal-case tracking-normal">{badge}</span>
          )}
        </span>
        {/* Chevron — rotates when open */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : 'rotate-0'}`}
          aria-hidden="true"
        >
          <path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Body ── */}
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 text-xs">
          {children}
        </div>
      )}
    </section>
  )
}