'use client'

import React, { useEffect, useRef, useState } from 'react'
import { PROJECT_COLORS } from './types'

// Compact color swatch + popover used in the project sidebar / popover header.
// Renders the current color as a small clickable dot; on click, shows a grid of
// preset colors plus a "no color" option. Persists via PATCH.
export default function DailyPlanColorPicker({
  documentId,
  value,
  onChange,
}: {
  documentId: string
  value: string | null | undefined
  onChange: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = value || null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const persist = (color: string | null) => {
    onChange(color)
    fetch(`/api/documents/${documentId}/project-color`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_color: color }),
    }).catch(() => {})
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={current ? 'Change project color' : 'Assign a project color'}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: current || 'transparent',
          border: current ? `1px solid ${current}99` : '1px dashed rgba(148,163,184,0.4)',
          cursor: 'pointer',
          padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: current ? '#0a0a0a' : '#64748b',
          fontSize: 11, fontWeight: 700, lineHeight: 1,
          fontFamily: 'inherit',
        }}
      >
        {current ? '' : '🎨'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: '#0d0d0d',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 10,
          padding: 10,
          zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          width: 184,
        }}>
          <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>Project color</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {PROJECT_COLORS.map(c => {
              const selected = current?.toLowerCase() === c.hex.toLowerCase()
              return (
                <button
                  key={c.hex}
                  onClick={() => persist(c.hex)}
                  title={c.name}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: c.hex,
                    border: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: selected ? `0 0 0 2px ${c.hex}55` : 'none',
                    transition: 'box-shadow 0.15s ease',
                  }}
                />
              )
            })}
          </div>
          <button
            onClick={() => persist(null)}
            style={{
              marginTop: 10, width: '100%', padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(148,163,184,0.06)',
              border: '1px solid rgba(148,163,184,0.15)',
              color: current ? '#cbd5e1' : '#475569',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >No color</button>
        </div>
      )}
    </div>
  )
}
