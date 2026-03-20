'use client'

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-yellow-100 text-yellow-700',
  C: 'bg-orange-100 text-orange-700',
  D: 'bg-red-100 text-red-700',
}

export function GradeBadge({ grade, label, size = 'sm' }: { grade: string; label: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'px-2 py-0.5 text-[12px]' : 'px-1.5 py-0.5 text-[11px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded font-bold ${cls} ${GRADE_COLORS[grade] ?? 'bg-black/5 text-black/60'}`}>
      {grade} <span className="font-medium">{label}</span>
    </span>
  )
}
