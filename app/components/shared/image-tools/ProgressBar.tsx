'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
  /** Whether an AI tool is currently running */
  isProcessing: boolean
  /** Whether a tool just finished successfully (triggers green flash) */
  justCompleted: boolean
}

export function ProgressBar({ isProcessing, justCompleted }: ProgressBarProps) {
  const [showGreen, setShowGreen] = useState(false)

  // Flash green briefly when a tool completes
  useEffect(() => {
    if (!justCompleted) return
    setShowGreen(true)
    const timer = setTimeout(() => setShowGreen(false), 1200)
    return () => clearTimeout(timer)
  }, [justCompleted])

  return (
    <div className="w-full h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
      {showGreen ? (
        /* Completed state: full green bar that fades out */
        <div className="h-full w-full rounded-full bg-emerald-500 transition-all duration-500" />
      ) : isProcessing ? (
        /* Indeterminate sweep animation */
        <div className="h-full w-full rounded-full relative">
          <div className="absolute inset-0 progress-indeterminate rounded-full" />
        </div>
      ) : null}
    </div>
  )
}
