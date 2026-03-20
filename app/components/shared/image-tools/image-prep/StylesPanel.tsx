'use client'

const COMING_SOON_STYLES = [
  { name: 'Vintage', desc: 'Retro washed-out look' },
  { name: 'High Contrast', desc: 'Bold blacks and whites' },
  { name: 'Grayscale', desc: 'Black and white conversion' },
  { name: 'Glow Effect', desc: 'Soft outer glow for dark garments' },
]

export function StylesPanel() {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
      <div>
        <h3 className="text-[14px] font-semibold text-white/80 mb-1">Styles</h3>
        <p className="text-[11px] text-white/40 leading-snug">
          Apply artistic effects to your image before printing.
        </p>
      </div>

      <div className="px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/10">
        <p className="text-[11px] font-semibold text-amber-400">Coming Soon</p>
        <p className="text-[10px] text-amber-400/70 mt-0.5">Style effects are under development.</p>
      </div>

      <div className="space-y-2">
        {COMING_SOON_STYLES.map(style => (
          <div
            key={style.name}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] opacity-50"
          >
            {/* Placeholder thumbnail */}
            <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white/40">{style.name}</p>
              <p className="text-[11px] text-white/25 mt-0.5">{style.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
