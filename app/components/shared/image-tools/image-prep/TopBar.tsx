'use client'

import { GradeBadge } from '../GradeBadge'
import type { ImagePrepState } from './useImagePrepState'

export function TopBar({ state }: { state: ImagePrepState }) {
  const { current, currentIndex, images, analysis, onComplete } = state

  const truncatedName = current.fileName.length > 30
    ? current.fileName.slice(0, 27) + '...'
    : current.fileName

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[14px] font-semibold text-white/80 truncate" title={current.fileName}>
          {truncatedName}
        </span>
        {analysis && (
          <GradeBadge grade={analysis.grade} label={analysis.gradeLabel} />
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {images.length > 1 && (
          <span className="text-[12px] font-medium text-white/40">
            {currentIndex + 1} of {images.length}
          </span>
        )}
        <button
          onClick={onComplete}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
