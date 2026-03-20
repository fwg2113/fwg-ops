'use client'

import { useState } from 'react'
import { BeforeAfterToggle } from '../BeforeAfterToggle'
import { PreviewBgSelector } from '../PreviewBgSelector'
import type { ImagePrepState } from './useImagePrepState'

export function BottomBar({ state }: { state: ImagePrepState }) {
  const {
    baView, setBaView, hasBeforeAfter, setShowHeatmap,
    previewBg, setPreviewBg,
    advance, isProcessing, edgesBlocked, edgesWarning,
    currentIndex, images, hasAppliedAny,
  } = state

  const [showEdgeWarning, setShowEdgeWarning] = useState(false)

  const isLast = currentIndex >= images.length - 1
  const disabled = isProcessing || edgesBlocked

  const handleSkipOrDone = () => {
    if (edgesWarning) {
      setShowEdgeWarning(true)
      return
    }
    advance()
  }

  const handleConfirmSkip = () => {
    setShowEdgeWarning(false)
    advance()
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] flex-shrink-0">
      {/* Left: Before/After */}
      <div className="flex items-center gap-2 min-w-0">
        <BeforeAfterToggle
          view={baView}
          onChange={(v) => { setBaView(v); setShowHeatmap(false) }}
          hasAfter={!!hasBeforeAfter}
        />
      </div>

      {/* Center: BG swatches + label */}
      <div className="flex items-center gap-3">
        <PreviewBgSelector value={previewBg} onChange={setPreviewBg} />
        <span className="text-[9px] font-medium text-white/30 hidden sm:inline">For Viewing Only</span>
      </div>

      {/* Right: Skip + Done */}
      <div className="flex items-center gap-2">
        {/* Edge warning confirmation */}
        {showEdgeWarning && (
          <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-2 duration-200">
            <span className="text-[11px] text-amber-400">Gradient edges may cause white outlines in print.</span>
            <button
              onClick={handleConfirmSkip}
              className="px-2 py-1 text-[11px] font-medium text-amber-400 border border-amber-400/40 rounded hover:bg-amber-400/10 transition-colors"
            >
              Skip Anyway
            </button>
            <button
              onClick={() => setShowEdgeWarning(false)}
              className="px-2 py-1 text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {!showEdgeWarning && (
          <>
            {/* Skip */}
            <button
              onClick={handleSkipOrDone}
              disabled={disabled}
              className="px-3 py-2 text-[13px] font-medium text-white/50 hover:text-white/70 disabled:opacity-40 transition-colors"
            >
              Skip
            </button>

            {/* Done / Next */}
            <button
              onClick={handleSkipOrDone}
              disabled={disabled}
              className={`px-5 py-2 text-[13px] font-semibold rounded-lg transition-all disabled:opacity-40 ${
                hasAppliedAny
                  ? 'bg-[#e41e31] text-white hover:opacity-90'
                  : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.10]'
              }`}
            >
              {isLast ? 'Done' : 'Next Image \u2192'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
