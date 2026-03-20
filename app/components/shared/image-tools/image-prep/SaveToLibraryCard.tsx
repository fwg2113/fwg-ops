'use client'

import type { ImagePrepState } from './useImagePrepState'

export function SaveToLibraryCard({ state }: { state: ImagePrepState }) {
  const {
    current, isProcessing, edgeCleanupActive, noToolsLeft, hasAppliedAny,
    savedImages, saveDismissed, handleSaveClick, handleSaveDismiss,
    onSaveToLibrary, isLoggedIn,
  } = state

  const canShowSave = !isProcessing && !edgeCleanupActive
    && (noToolsLeft || hasAppliedAny)
    && !savedImages.has(current.id) && !saveDismissed.has(current.id)

  if (!canShowSave) return null

  if (isLoggedIn && onSaveToLibrary) {
    return (
      <div className="rounded-xl border border-[#e41e31]/15 bg-[#e41e31]/[0.04] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#e41e31]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#e41e31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/80">Save to your Artwork Library?</p>
            <p className="text-[11px] text-white/45 mt-0.5">Reuse it anytime without re-uploading</p>
            <div className="flex items-center gap-3 mt-2.5">
              <button
                onClick={() => handleSaveClick(current.id)}
                className="px-4 py-1.5 text-[12px] font-semibold rounded-lg bg-[#e41e31] text-white transition-all hover:brightness-115 hover:scale-[1.02]"
              >
                Save to Library
              </button>
              <button
                onClick={() => handleSaveDismiss(current.id)}
                className="text-[12px] font-medium text-white/40 hover:text-white/60 transition-colors"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-white/50">
              <a href="/account/signup" className="font-semibold text-[#e41e31] hover:underline">Create a free account</a>
              {' '}to save this to your Artwork Library
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
