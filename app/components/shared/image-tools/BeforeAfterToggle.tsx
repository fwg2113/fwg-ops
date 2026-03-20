'use client'

export function BeforeAfterToggle({
  view,
  onChange,
  hasAfter,
}: {
  view: 'before' | 'after'
  onChange: (v: 'before' | 'after') => void
  hasAfter: boolean
}) {
  if (!hasAfter) return null

  return (
    <div className="inline-flex rounded-lg border border-white/10 overflow-hidden text-[11px] font-semibold">
      <button
        onClick={() => onChange('before')}
        className={`px-3 py-1 transition-colors ${
          view === 'before'
            ? 'bg-white/[0.07] text-white/70'
            : 'bg-[#0d1117] text-white/40 hover:text-white/60'
        }`}
      >
        BEFORE
      </button>
      <button
        onClick={() => onChange('after')}
        className={`px-3 py-1 transition-colors ${
          view === 'after'
            ? 'bg-white/[0.07] text-white/70'
            : 'bg-[#0d1117] text-white/40 hover:text-white/60'
        }`}
      >
        AFTER
      </button>
    </div>
  )
}
