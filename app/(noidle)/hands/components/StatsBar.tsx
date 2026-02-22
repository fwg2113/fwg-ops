'use client'

import type { NihTask } from '../types'

interface StatsBarProps {
  tasks: NihTask[]
}

export default function StatsBar({ tasks }: StatsBarProps) {
  const topLevel = tasks.filter(t => !t.parent_id)
  const open = topLevel.filter(t => t.status === 'open').length
  const inProgress = topLevel.filter(t => t.status === 'in_progress').length
  const highCritical = topLevel.filter(
    t => (t.urgency === 'high' || t.urgency === 'critical') && t.status !== 'completed'
  ).length

  // Completed this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const completedThisWeek = topLevel.filter(
    t => t.status === 'completed' && t.completed_at && new Date(t.completed_at) > weekAgo
  ).length

  const stats = [
    { label: 'Open', value: open, color: '#f1f5f9' },
    { label: 'In Progress', value: inProgress, color: '#22d3ee' },
    { label: 'Done This Week', value: completedThisWeek, color: '#22c55e' },
    { label: 'High / Critical', value: highCritical, color: highCritical > 0 ? '#ef4444' : '#6b7280' },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
      }}
    >
      {stats.map(s => (
        <div
          key={s.label}
          style={{
            background: '#1d1d1d',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
