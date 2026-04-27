'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { monToSunOfWeek, todayLocalISO } from './DailyPlan'

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function DailyPlanTopBuckets({
  weekAnchor, taskCountsByDate, onShiftWeek, onResetWeek, onBucketClick,
}: {
  weekAnchor: string
  taskCountsByDate: Record<string, number>
  onShiftWeek: (days: number) => void
  onResetWeek: () => void
  onBucketClick?: (iso: string) => void
}) {
  const days = monToSunOfWeek(weekAnchor)
  const today = todayLocalISO()

  // Format header label like "Apr 21 — Apr 27"
  const startD = new Date(days[0] + 'T00:00:00')
  const endD = new Date(days[6] + 'T00:00:00')
  const sameMonth = startD.getMonth() === endD.getMonth()
  const headerLabel = sameMonth
    ? `${startD.toLocaleDateString('en-US', { month: 'short' })} ${startD.getDate()}–${endD.getDate()}`
    : `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const isCurrentWeek = days.includes(today)

  const arrowStyle: React.CSSProperties = {
    background: 'rgba(148,163,184,0.06)',
    border: '1px solid rgba(148,163,184,0.18)',
    color: '#cbd5e1',
    width: 44,
    minHeight: 110,
    borderRadius: 14,
    cursor: 'pointer',
    fontSize: 22,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    flexShrink: 0,
  }

  return (
    <div>
      {/* Header label + reset */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
            {isCurrentWeek ? 'This week' : daysLabel(days[0])}
          </span>
          <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
            {headerLabel}
          </span>
        </div>
        {!isCurrentWeek && (
          <button
            onClick={onResetWeek}
            style={{
              background: 'rgba(34,211,238,0.1)',
              border: '1px solid rgba(34,211,238,0.3)',
              color: '#22d3ee',
              padding: '5px 12px', borderRadius: 7,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: 0.4,
            }}
          >← Jump to this week</button>
        )}
      </div>

      {/* Arrows + buckets */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <button
          onClick={() => onShiftWeek(-7)}
          title="Previous week"
          style={arrowStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.06)'; e.currentTarget.style.color = '#cbd5e1' }}
        >‹</button>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
          {days.map((iso, i) => (
            <BucketCell
              key={iso}
              iso={iso}
              label={DAY_LABELS[i]}
              count={taskCountsByDate[iso] || 0}
              isToday={iso === today}
              onClick={onBucketClick ? () => onBucketClick(iso) : undefined}
            />
          ))}
        </div>

        <button
          onClick={() => onShiftWeek(7)}
          title="Next week"
          style={arrowStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.06)'; e.currentTarget.style.color = '#cbd5e1' }}
        >›</button>
      </div>
    </div>
  )
}

// Header label helper — "Last week" / "Next week" / "In 2 weeks" etc.
function daysLabel(firstDayIso: string): string {
  const today = todayLocalISO()
  const todayD = new Date(today + 'T00:00:00')
  const firstD = new Date(firstDayIso + 'T00:00:00')
  const todayMon = new Date(todayD); todayMon.setDate(todayD.getDate() - ((todayD.getDay() + 6) % 7))
  const diffWeeks = Math.round((firstD.getTime() - todayMon.getTime()) / (7 * 86400000))
  if (diffWeeks === 0) return 'This week'
  if (diffWeeks === 1) return 'Next week'
  if (diffWeeks === -1) return 'Last week'
  if (diffWeeks > 0) return `${diffWeeks} weeks ahead`
  return `${Math.abs(diffWeeks)} weeks back`
}

function BucketCell({ iso, label, count, isToday, onClick }: {
  iso: string; label: string; count: number; isToday: boolean
  onClick?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket:${iso}` })

  const dayNum = new Date(iso + 'T00:00:00').getDate()
  const monthShort = new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })

  const todayBg = 'linear-gradient(160deg, rgba(34,211,238,0.10) 0%, rgba(34,211,238,0.02) 100%)'
  const baseBg = 'linear-gradient(180deg, #161616 0%, #121212 100%)'
  const overBg = 'linear-gradient(160deg, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.04) 100%)'

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        background: isOver ? overBg : (isToday ? todayBg : baseBg),
        border: isOver ? '2px dashed rgba(34,211,238,0.55)' : isToday ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(148,163,184,0.08)',
        borderRadius: 14,
        padding: '22px 14px',
        textAlign: 'center',
        minHeight: 110,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        transition: 'all 0.18s',
        position: 'relative',
        boxShadow: isToday ? '0 0 24px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { if (onClick && !isOver) e.currentTarget.style.borderColor = isToday ? 'rgba(34,211,238,0.6)' : 'rgba(148,163,184,0.2)' }}
      onMouseLeave={e => { if (onClick && !isOver) e.currentTarget.style.borderColor = isToday ? 'rgba(34,211,238,0.4)' : 'rgba(148,163,184,0.08)' }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? '#22d3ee' : '#e2e8f0', letterSpacing: 0.2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: isToday ? '#67e8f9' : '#64748b', fontWeight: 500 }}>
        {monthShort} {dayNum}
      </div>
      {count > 0 && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          background: isToday ? 'rgba(34,211,238,0.25)' : 'rgba(34,211,238,0.15)',
          color: '#22d3ee',
          fontSize: 12, fontWeight: 700,
          padding: '3px 9px', borderRadius: 11,
          minWidth: 26, textAlign: 'center',
          border: '1px solid rgba(34,211,238,0.3)',
        }}>
          {count}
        </div>
      )}
    </div>
  )
}
