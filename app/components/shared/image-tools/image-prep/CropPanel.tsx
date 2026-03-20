'use client'

import type { ImagePrepState } from './useImagePrepState'

export function CropPanel({ state }: { state: ImagePrepState }) {
  const {
    current, cropRect, setCropRect, cropAspectLocked, setCropAspectLocked,
    croppedUrls, handleApplyCrop, handleResetCrop,
  } = state

  const hasCropped = !!croppedUrls[current.id]
  const dpi = 300
  const cropW = cropRect ? (cropRect.width / dpi).toFixed(2) : ''
  const cropH = cropRect ? (cropRect.height / dpi).toFixed(2) : ''

  const startFullCrop = () => {
    setCropRect({
      x: 0,
      y: 0,
      width: current.nativeWidth,
      height: current.nativeHeight,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 min-h-0">
      <div>
        <h3 className="text-[14px] font-semibold text-white/80 mb-1">Crop Image</h3>
        <p className="text-[11px] text-white/40 leading-snug">
          Trim unwanted areas from your image. Crop is applied locally and does not affect the original file.
        </p>
      </div>

      {!cropRect && !hasCropped && (
        <button
          onClick={startFullCrop}
          className="w-full px-4 py-3 rounded-xl border border-white/10 text-[13px] font-semibold text-white/60 hover:border-white/20 hover:bg-white/[0.03] transition-all"
        >
          Start Crop
        </button>
      )}

      {cropRect && (
        <>
          {/* Dimensions display */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Width (in)</label>
                <input
                  type="text"
                  readOnly
                  value={cropW}
                  className="mt-0.5 w-full px-2 py-1.5 text-[13px] rounded-lg border border-white/10 bg-white/[0.04] text-white/70"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Height (in)</label>
                <input
                  type="text"
                  readOnly
                  value={cropH}
                  className="mt-0.5 w-full px-2 py-1.5 text-[13px] rounded-lg border border-white/10 bg-white/[0.04] text-white/70"
                />
              </div>
            </div>

            {/* Aspect lock */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cropAspectLocked}
                onChange={e => setCropAspectLocked(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 text-[#e41e31] focus:ring-[#e41e31]/30"
              />
              <span className="text-[12px] font-medium text-white/60">Lock aspect ratio</span>
            </label>

            <p className="text-[10px] text-white/30">
              Drag the handles on the preview to adjust the crop area. Dimensions shown at 300 DPI.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyCrop}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-[#e41e31] text-white transition-all hover:brightness-115 hover:scale-[1.02]"
            >
              Apply Crop
            </button>
            <button
              onClick={() => setCropRect(null)}
              className="px-4 py-2.5 text-[13px] font-medium rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.03] transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {hasCropped && !cropRect && (
        <div className="space-y-3">
          <div className="px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-900/20">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[13px] font-semibold text-emerald-400">Crop applied</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startFullCrop}
              className="flex-1 px-4 py-2 text-[13px] font-medium rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.03] transition-colors"
            >
              Adjust
            </button>
            <button
              onClick={handleResetCrop}
              className="px-4 py-2 text-[13px] font-medium rounded-lg border border-white/10 text-red-500 hover:bg-fa-red/10 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
