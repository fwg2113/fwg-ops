'use client'

import { useState } from 'react'

// ─── Image With Fallback ───
// Tries to load an image from the R2 bucket.
// If the image doesn't exist, shows the gradient fallback instead.
// This lets the user upload/replace photos anytime without code changes.

type Props = {
  src: string
  alt: string
  className?: string
  fallbackGradient?: string
  fallbackLabel?: string
}

export default function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackGradient = 'from-zinc-900 via-zinc-800 to-black',
  fallbackLabel,
}: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`bg-gradient-to-br ${fallbackGradient} flex items-center justify-center p-4 ${className}`}>
        {fallbackLabel && (
          <span className="text-white/10 text-sm text-center font-medium">{fallbackLabel}</span>
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
