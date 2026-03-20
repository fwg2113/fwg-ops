'use client'

type BadgeType = 'recommended' | 'not-recommended' | 'fix-required' | 'optional' | null

const BADGE_STYLES: Record<string, string> = {
  recommended: 'bg-emerald-500 text-white',
  'not-recommended': 'bg-yellow-500 text-white',
  'fix-required': 'bg-[#e41e31] text-white',
  optional: 'text-white/30 bg-white/[0.04] border border-white/[0.08]',
}

const BADGE_LABELS: Record<string, string> = {
  recommended: 'Recommended',
  'not-recommended': 'Not Recommended',
  'fix-required': 'Fix Before Printing',
  optional: 'OPTIONAL',
}

export function SuggestionCard({
  icon,
  title,
  description,
  badge,
  isLoading,
  isComplete,
  isLocked,
  lockedMessage,
  disabled,
  onClick,
  pulseRed,
  children,
  onRerun,
  rerunLabel,
}: {
  icon: React.ReactNode
  title: string
  description: string
  badge?: BadgeType
  isLoading?: boolean
  isComplete?: boolean
  isLocked?: boolean
  lockedMessage?: string
  disabled?: boolean
  onClick?: () => void
  pulseRed?: boolean
  children?: React.ReactNode
  onRerun?: () => void
  rerunLabel?: string
}) {
  if (isLocked) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 opacity-50">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/25">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-white/40">{title}</p>
              {badge && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${BADGE_STYLES[badge]}`}>
                  {BADGE_LABELS[badge]}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/30 mt-0.5 leading-snug">{lockedMessage ?? 'Complete previous step first'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Expanded content (e.g. edge smoothing slider)
  if (children) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        {children}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Badge floating above card — hidden once complete */}
      {badge && !isComplete && badge !== 'optional' && (
        <div className={`absolute -top-2.5 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm whitespace-nowrap ${BADGE_STYLES[badge]}`}>
          {BADGE_LABELS[badge]}
        </div>
      )}
      {badge === 'optional' && !isComplete && (
        <span className={`absolute -top-2 right-3 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${BADGE_STYLES[badge]}`}>
          {BADGE_LABELS[badge]}
        </span>
      )}

      <button
        onClick={isComplete && onRerun ? onRerun : onClick}
        disabled={disabled || isLoading || (isComplete && !onRerun)}
        className={`relative w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all overflow-hidden ${
          isComplete
            ? onRerun
              ? 'border-emerald-500/30 bg-emerald-900/20 hover:border-emerald-500/40 hover:bg-emerald-900/30'
              : 'border-emerald-500/30 bg-emerald-900/20'
            : isLoading
              ? 'border-white/10 bg-white/[0.03]'
              : pulseRed
                ? '!border-2 !border-[#e41e31]'
                : badge === 'optional'
                  ? '!border-dashed !border-white/[0.08] !bg-transparent hover:!border-white/20 hover:!bg-white/[0.03] hover:-translate-y-px'
                  : 'border-white/10 bg-[#0d1117] hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-px'
        } disabled:cursor-default`}
        style={pulseRed ? { animation: 'pulse-red-border 2s ease-in-out infinite' } : undefined}
      >
        {isLoading && (
          <div className="absolute inset-0 shimmer pointer-events-none" />
        )}

        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          isComplete ? 'bg-emerald-900/40 text-emerald-400' : 'bg-white/[0.06] text-white/50'
        }`}>
          {isComplete ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : isLoading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            icon
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-[13px] font-semibold ${isComplete ? 'text-emerald-400' : 'text-white/80'}`}>
              {isComplete ? `${title} \u2714` : title}
            </p>
            {isComplete && onRerun && (
              <span className="text-[11px] text-[#e41e31] font-medium">{rerunLabel ?? 'Re-run'}</span>
            )}
          </div>
          <p className="text-[11px] text-white/40 mt-0.5 leading-snug">{description}</p>
        </div>
      </button>
    </div>
  )
}
