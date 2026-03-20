'use client'

export type PreviewBg = 'checkerboard' | '#ffffff' | '#e5e5e5' | '#333333' | '#000000'

const OPTIONS: { id: PreviewBg; label: string; swatch: string }[] = [
  { id: 'checkerboard', label: 'Checkerboard', swatch: 'checkerboard' },
  { id: '#ffffff', label: 'White', swatch: 'bg-white' },
  { id: '#e5e5e5', label: 'Light Gray', swatch: 'bg-[#e5e5e5]' },
  { id: '#333333', label: 'Dark Gray', swatch: 'bg-[#333333]' },
  { id: '#000000', label: 'Black', swatch: 'bg-black' },
]

export function PreviewBgSelector({
  value,
  onChange,
}: {
  value: PreviewBg
  onChange: (bg: PreviewBg) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium opacity-40 mr-0.5">BG</span>
      {OPTIONS.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          title={opt.label}
          className={`w-5 h-5 rounded border transition-all ${
            value === opt.id
              ? 'border-fa-red ring-1 ring-fa-red/30 scale-110'
              : 'border-gray-400/40 hover:border-gray-400/60'
          } ${opt.id === 'checkerboard' ? 'checkerboard' : ''}`}
          style={opt.id !== 'checkerboard' ? { backgroundColor: opt.id } : undefined}
        />
      ))}
    </div>
  )
}

export function previewBgClass(bg: PreviewBg): string {
  if (bg === 'checkerboard') return 'checkerboard'
  return ''
}

export function previewBgStyle(bg: PreviewBg): React.CSSProperties | undefined {
  if (bg === 'checkerboard') return undefined
  return { backgroundColor: bg }
}
