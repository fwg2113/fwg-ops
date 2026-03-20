'use client'

import type { PipelineStep } from './types'
import type { ImagePrepState } from './useImagePrepState'

export function PipelineIndicator({ state }: { state: ImagePrepState }) {
  const { analysis, done, isProcessing, aiState } = state

  // Build steps dynamically based on analysis
  const steps: PipelineStep[] = [
    { id: 'original', label: 'Original', status: 'completed' },
  ]

  if (analysis?.suggestUpscale) {
    steps.push({
      id: 'upscale',
      label: 'Enhanced',
      status: done.has('upscale') ? 'completed' : aiState?.upscaling ? 'active' : 'pending',
    })
  }

  if (analysis?.suggestBgRemoval) {
    steps.push({
      id: 'removeBg',
      label: 'BG Removed',
      status: done.has('removeBg') ? 'completed' : aiState?.removingBg ? 'active' : 'pending',
    })
  }

  if (analysis?.suggestCleanEdges) {
    steps.push({
      id: 'cleanEdges',
      label: 'Transparency Fixed',
      status: done.has('cleanEdges') ? 'completed' : 'pending',
    })
  }

  steps.push({
    id: 'ready',
    label: 'Print Ready',
    status: !isProcessing && steps.slice(1).every(s => s.status === 'completed') ? 'completed' : 'pending',
  })

  return (
    <div className="flex items-center gap-1 px-1 py-2 overflow-x-auto">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
          {/* Circle */}
          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
            step.status === 'completed'
              ? 'bg-emerald-500'
              : step.status === 'active'
                ? 'bg-[#e41e31] animate-pulse'
                : 'bg-white/10'
          }`}>
            {step.status === 'completed' && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          {/* Label */}
          <span className={`text-[10px] font-medium whitespace-nowrap ${
            step.status === 'completed'
              ? 'text-emerald-600'
              : step.status === 'active'
                ? 'text-[#e41e31]'
                : 'text-white/30'
          }`}>
            {step.label}
          </span>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div className={`w-4 h-[2px] flex-shrink-0 ${
              step.status === 'completed' ? 'bg-emerald-300' : 'bg-white/10'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
