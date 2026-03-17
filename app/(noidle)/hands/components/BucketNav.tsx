import type { ViewBucket } from '../types'
import { BUCKET_CONFIG } from '../types'

interface Props {
  activeBucket: ViewBucket
  onChange: (bucket: ViewBucket) => void
  counts: Record<ViewBucket, number>
}

const BUCKETS: ViewBucket[] = ['recurring', 'urgent', 'whenever', 'bonus', 'completed', 'gallery']

// Inline SVG icons per bucket
function BucketIcon({ bucket, color }: { bucket: ViewBucket; color: string }) {
  const size = 18
  const props = { width: size, height: size, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (bucket) {
    case 'recurring':
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      )
    case 'urgent':
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    case 'whenever':
      return (
        <svg {...props} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      )
    case 'bonus':
      return (
        <svg {...props} viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={color} stroke="none" />
        </svg>
      )
    case 'completed':
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
        </svg>
      )
    case 'gallery':
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" fill={color} stroke="none" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )
  }
}

export default function BucketNav({ activeBucket, onChange, counts }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      padding: '12px 16px',
    }}>
      {BUCKETS.map(bucket => {
        const cfg = BUCKET_CONFIG[bucket]
        const active = activeBucket === bucket
        const count = counts[bucket]

        return (
          <button
            key={bucket}
            onClick={() => onChange(bucket)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '10px 6px',
              minHeight: 56,
              borderRadius: 12,
              border: `1.5px solid ${active ? cfg.color : '#2a2a2e'}`,
              background: active ? `${cfg.color}18` : '#1a1a1c',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <BucketIcon bucket={bucket} color={active ? cfg.color : '#888'} />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: active ? cfg.color : '#999',
              letterSpacing: 0.3,
            }}>
              {cfg.label}
            </span>

            {/* Count badge */}
            {count > 0 && bucket !== 'gallery' && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 6,
                fontSize: 10,
                fontWeight: 700,
                color: active ? cfg.color : '#777',
                lineHeight: 1,
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
