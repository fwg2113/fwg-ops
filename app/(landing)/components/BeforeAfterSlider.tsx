'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ─── Before/After Image Slider ───
// Interactive draggable comparison slider.
// Image URLs are resolved server-side from the R2 bucket.
// If no images exist, shows gradient fallbacks.

type Props = {
  beforeLabel: string
  afterLabel: string
  beforeImage?: string
  afterImage?: string
}

export default function BeforeAfterSlider({ beforeLabel, afterLabel, beforeImage, afterImage }: Props) {
  const [position, setPosition] = useState(50)
  const [beforeFailed, setBeforeFailed] = useState(false)
  const [afterFailed, setAfterFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const handleMouseDown = () => { dragging.current = true }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        e.preventDefault()
        updatePosition(e.clientX)
      }
    }
    const handleMouseUp = () => { dragging.current = false }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [updatePosition])

  const handleTouchMove = (e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX)
  }

  const showBeforeImage = beforeImage && !beforeFailed
  const showAfterImage = afterImage && !afterFailed

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] rounded-xl overflow-hidden cursor-col-resize select-none"
      onTouchMove={handleTouchMove}
      role="slider"
      aria-label="Before and after comparison slider"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPosition(p => Math.max(0, p - 2))
        if (e.key === 'ArrowRight') setPosition(p => Math.min(100, p + 2))
      }}
    >
      {/* After (background layer — full width) */}
      <div className="absolute inset-0">
        {showAfterImage ? (
          <img
            src={afterImage}
            alt={afterLabel}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setAfterFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-red-900 to-red-700 flex items-center justify-center p-4">
            <span className="text-white/60 text-sm text-center font-medium">{afterLabel}</span>
          </div>
        )}
      </div>

      {/* Before (clip-path layer — reveals from left) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {showBeforeImage ? (
          <img
            src={beforeImage}
            alt={beforeLabel}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setBeforeFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-500 flex items-center justify-center p-4">
            <span className="text-white/60 text-sm text-center font-medium">{beforeLabel}</span>
          </div>
        )}
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-fwg-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
        Before
      </div>
      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
        After
      </div>
    </div>
  )
}
