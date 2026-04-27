'use client'

import React, { useEffect } from 'react'

export default function DailyPlanLightbox({
  url, label, onClose, onPrev, onNext, count, index,
}: {
  url: string | null
  label?: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  count?: number
  index?: number
}) {
  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url, onClose, onPrev, onNext])

  if (!url) return null

  return (
    <div
      data-modal
      data-lightbox
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'zoom-out',
      }}
    >
      <button
        onClick={onClose}
        title="Close (Esc)"
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
          fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}
      >×</button>

      {onPrev && (
        <button
          onClick={onPrev}
          title="Previous (←)"
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
            fontSize: 28, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
          }}
        >‹</button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          title="Next (→)"
          style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
            fontSize: 28, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
          }}
        >›</button>
      )}

      <img
        src={url}
        alt={label || 'mockup'}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: 6,
          cursor: 'default',
          userSelect: 'none',
        }}
      />

      {(label || (count && count > 1)) && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%',
          transform: 'translateX(-50%)',
          color: '#94a3b8', fontSize: 13, textAlign: 'center', maxWidth: '80vw',
        }}>
          {label && <div style={{ color: '#e2e8f0', fontWeight: 500, marginBottom: 2 }}>{label}</div>}
          {count && count > 1 && index != null && <div>{index + 1} / {count}</div>}
        </div>
      )}
    </div>
  )
}
