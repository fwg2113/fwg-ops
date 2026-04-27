'use client'

import React, { useState, useMemo } from 'react'
import { todayLocalISO, addDaysISO, monToSatOfWeek } from './DailyPlan'
import type { DailyTask, CalendarEventLite, DocSummary } from './types'

type ViewMode = 'day' | 'week' | '2week' | 'month'

export default function DailyPlanBottomCalendar({
  tasks, calendarEvents, docById, initialDate,
}: {
  tasks: DailyTask[]
  calendarEvents: CalendarEventLite[]
  docById: Record<string, DocSummary>
  initialDate: string
}) {
  const [view, setView] = useState<ViewMode>('day')
  const [anchorDate, setAnchorDate] = useState<string>(initialDate)

  // Group tasks by scheduled_date (TODO only)
  const tasksByDate = useMemo(() => {
    const m: Record<string, DailyTask[]> = {}
    for (const t of tasks) {
      if (t.status !== 'TODO' || !t.scheduled_date) continue
      if (!m[t.scheduled_date]) m[t.scheduled_date] = []
      m[t.scheduled_date].push(t)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.sort_order - b.sort_order)
    return m
  }, [tasks])

  // Group calendar events by their start date
  const eventsByDate = useMemo(() => {
    const m: Record<string, CalendarEventLite[]> = {}
    for (const ev of calendarEvents) {
      if (!ev.start_time) continue
      const date = ev.start_time.slice(0, 10)
      if (!m[date]) m[date] = []
      m[date].push(ev)
    }
    return m
  }, [calendarEvents])

  // Compute the date range for the current view
  const dates = useMemo<string[]>(() => {
    if (view === 'day') return [anchorDate]
    if (view === 'week') return monToSatOfWeek(anchorDate)
    if (view === '2week') {
      const week1 = monToSatOfWeek(anchorDate)
      const monNextWeek = addDaysISO(week1[5], 2)
      const week2 = monToSatOfWeek(monNextWeek)
      return [...week1, ...week2]
    }
    // month: full month containing anchorDate (sun-sat grid, but show 6 rows × 7 = 42 days)
    const d = new Date(anchorDate + 'T00:00:00')
    const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
    const dowFirst = firstOfMonth.getDay()
    const startSunday = new Date(firstOfMonth)
    startSunday.setDate(firstOfMonth.getDate() - dowFirst)
    return Array.from({ length: 42 }, (_, i) => {
      const x = new Date(startSunday)
      x.setDate(startSunday.getDate() + i)
      return x.toISOString().slice(0, 10)
    })
  }, [view, anchorDate])

  const stepBack = () => {
    if (view === 'day') setAnchorDate(addDaysISO(anchorDate, -1))
    else if (view === 'week') setAnchorDate(addDaysISO(anchorDate, -7))
    else if (view === '2week') setAnchorDate(addDaysISO(anchorDate, -14))
    else {
      const d = new Date(anchorDate + 'T00:00:00')
      d.setMonth(d.getMonth() - 1)
      setAnchorDate(d.toISOString().slice(0, 10))
    }
  }
  const stepFwd = () => {
    if (view === 'day') setAnchorDate(addDaysISO(anchorDate, 1))
    else if (view === 'week') setAnchorDate(addDaysISO(anchorDate, 7))
    else if (view === '2week') setAnchorDate(addDaysISO(anchorDate, 14))
    else {
      const d = new Date(anchorDate + 'T00:00:00')
      d.setMonth(d.getMonth() + 1)
      setAnchorDate(d.toISOString().slice(0, 10))
    }
  }

  const headerLabel = useMemo(() => {
    const d = new Date(anchorDate + 'T00:00:00')
    if (view === 'day') return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (view === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const start = dates[0]
    const end = dates[dates.length - 1]
    const sd = new Date(start + 'T00:00:00')
    const ed = new Date(end + 'T00:00:00')
    return `${sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [view, anchorDate, dates])

  return (
    <div style={{
      marginTop: 22,
      background: 'linear-gradient(180deg, #161616 0%, #121212 100%)',
      border: '1px solid rgba(148,163,184,0.1)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(148,163,184,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={stepBack} style={navBtnStyle}>‹</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', minWidth: 220, letterSpacing: -0.2 }}>{headerLabel}</h2>
          <button onClick={stepFwd} style={navBtnStyle}>›</button>
          <button onClick={() => setAnchorDate(todayLocalISO())} style={{ ...navBtnStyle, width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 600 }}>Today</button>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['day', 'week', '2week', 'month'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: view === v ? 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)' : 'rgba(148,163,184,0.08)',
                color: view === v ? '#000' : '#94a3b8',
                fontFamily: 'inherit',
                textTransform: v === '2week' ? 'none' : 'capitalize',
                boxShadow: view === v ? '0 4px 12px rgba(34,211,238,0.25)' : 'none',
              }}
            >
              {v === '2week' ? '2 Weeks' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {view === 'day' && (
        <DayView date={dates[0]} events={eventsByDate[dates[0]] || []} tasks={tasksByDate[dates[0]] || []} docById={docById} />
      )}

      {view === 'week' && (
        <DayGridView dates={dates} columns={6} eventsByDate={eventsByDate} tasksByDate={tasksByDate} docById={docById} />
      )}

      {view === '2week' && (
        <DayGridView dates={dates} columns={6} rows={2} eventsByDate={eventsByDate} tasksByDate={tasksByDate} docById={docById} />
      )}

      {view === 'month' && (
        <MonthGridView dates={dates} eventsByDate={eventsByDate} tasksByDate={tasksByDate} docById={docById} anchorDate={anchorDate} />
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'rgba(148,163,184,0.08)',
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#cbd5e1',
  width: 36, height: 36,
  borderRadius: 9,
  cursor: 'pointer',
  fontSize: 18,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
  fontWeight: 600,
}

// =========================================================================
// Day view — vertical split: events | tasks
// =========================================================================
function DayView({ date, events, tasks, docById }: {
  date: string
  events: CalendarEventLite[]
  tasks: DailyTask[]
  docById: Record<string, DocSummary>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, minHeight: 320 }}>
      <div style={{ padding: 22, borderRight: '1px solid rgba(148,163,184,0.08)' }}>
        <div style={{ fontSize: 12, color: '#a78bfa', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} />
          Calendar
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0 }}>· {events.length}</span>
        </div>
        {events.length === 0 && <div style={{ color: '#475569', fontSize: 13, fontStyle: 'italic' }}>No events scheduled.</div>}
        {events.map(ev => <EventChip key={ev.id} ev={ev} />)}
      </div>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 12, color: '#22d3ee', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee' }} />
          Tasks
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0 }}>· {tasks.length}</span>
        </div>
        {tasks.length === 0 && <div style={{ color: '#475569', fontSize: 13, fontStyle: 'italic' }}>No tasks scheduled.</div>}
        {tasks.map(t => <TaskChip key={t.id} task={t} docById={docById} />)}
      </div>
    </div>
  )
}

// =========================================================================
// Day grid (week / 2-week) — per-day cell with horizontal split
// =========================================================================
function DayGridView({
  dates, columns, rows, eventsByDate, tasksByDate, docById,
}: {
  dates: string[]
  columns: number
  rows?: number
  eventsByDate: Record<string, CalendarEventLite[]>
  tasksByDate: Record<string, DailyTask[]>
  docById: Record<string, DocSummary>
}) {
  const today = todayLocalISO()
  const cellMinH = rows && rows > 1 ? 140 : 200
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, minHeight: cellMinH * (rows || 1) }}>
      {dates.map((iso, i) => {
        const d = new Date(iso + 'T00:00:00')
        const isToday = iso === today
        const events = eventsByDate[iso] || []
        const tasks = tasksByDate[iso] || []
        const isLastCol = (i + 1) % columns === 0
        const isLastRow = i >= dates.length - columns
        return (
          <div key={iso} style={{
            padding: '10px 10px 12px',
            borderRight: isLastCol ? 'none' : '1px solid rgba(148,163,184,0.06)',
            borderBottom: isLastRow ? 'none' : '1px solid rgba(148,163,184,0.06)',
            background: isToday ? 'rgba(34,211,238,0.04)' : 'transparent',
            minHeight: cellMinH,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#22d3ee' : '#cbd5e1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              {d.toLocaleDateString('en-US', { weekday: 'short' })} <span style={{ color: '#64748b', fontWeight: 500 }}>{d.getDate()}</span>
            </div>
            {/* Events */}
            <div style={{ borderBottom: '1px dashed rgba(148,163,184,0.08)', paddingBottom: 6, marginBottom: 6, minHeight: 20 }}>
              {events.length === 0 && <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>—</div>}
              {events.slice(0, 3).map(ev => <EventChip key={ev.id} ev={ev} compact />)}
              {events.length > 3 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>+{events.length - 3} more</div>}
            </div>
            {/* Tasks */}
            <div style={{ flex: 1 }}>
              {tasks.length === 0 && <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>—</div>}
              {tasks.slice(0, 4).map(t => <TaskChip key={t.id} task={t} docById={docById} compact />)}
              {tasks.length > 4 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>+{tasks.length - 4} more</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =========================================================================
// Month grid — 7 columns × 6 rows
// =========================================================================
function MonthGridView({
  dates, eventsByDate, tasksByDate, docById, anchorDate,
}: {
  dates: string[]
  eventsByDate: Record<string, CalendarEventLite[]>
  tasksByDate: Record<string, DailyTask[]>
  docById: Record<string, DocSummary>
  anchorDate: string
}) {
  const today = todayLocalISO()
  const month = new Date(anchorDate + 'T00:00:00').getMonth()
  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textAlign: 'center', padding: '4px 0', textTransform: 'uppercase', letterSpacing: 1 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {dates.map(iso => {
          const d = new Date(iso + 'T00:00:00')
          const inMonth = d.getMonth() === month
          const isToday = iso === today
          const events = eventsByDate[iso] || []
          const tasks = tasksByDate[iso] || []
          return (
            <div key={iso} style={{
              padding: '6px 7px 8px',
              borderRadius: 6,
              background: isToday ? 'rgba(34,211,238,0.06)' : '#0d0d0d',
              border: isToday ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(148,163,184,0.05)',
              opacity: inMonth ? 1 : 0.4,
              minHeight: 80,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#22d3ee' : '#cbd5e1', marginBottom: 3 }}>{d.getDate()}</div>
              {(events.length > 0 || tasks.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {events.slice(0, 2).map(ev => (
                    <span key={ev.id} title={ev.title || ''} style={{ fontSize: 9, color: '#a78bfa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ● {ev.title}
                    </span>
                  ))}
                  {tasks.slice(0, 2).map(t => (
                    <span key={t.id} title={t.title} style={{ fontSize: 9, color: '#22d3ee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ▸ {t.title}
                    </span>
                  ))}
                  {(events.length + tasks.length) > 4 && (
                    <span style={{ fontSize: 9, color: '#64748b' }}>+{events.length + tasks.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =========================================================================
// Chips
// =========================================================================
function EventChip({ ev, compact }: { ev: CalendarEventLite; compact?: boolean }) {
  const time = ev.start_time ? new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <div style={{
      padding: compact ? '4px 8px' : '8px 12px',
      borderRadius: 7,
      background: 'rgba(168,85,247,0.1)',
      border: '1px solid rgba(168,85,247,0.22)',
      marginBottom: 5,
      fontSize: compact ? 11 : 13,
      color: '#c4b5fd',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontWeight: 500,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {time && <strong style={{ color: '#a78bfa', marginRight: 5 }}>{time}</strong>}
        {ev.title || 'Event'}
      </span>
    </div>
  )
}

function TaskChip({ task, docById, compact }: { task: DailyTask; docById: Record<string, DocSummary>; compact?: boolean }) {
  const doc = task.parent_document_id ? docById[task.parent_document_id] : null
  const isPriority = task.is_priority
  return (
    <div style={{
      padding: compact ? '4px 8px' : '8px 12px',
      borderRadius: 7,
      background: isPriority ? 'rgba(251,146,60,0.1)' : 'rgba(34,211,238,0.08)',
      border: isPriority ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(34,211,238,0.2)',
      borderLeft: isPriority ? '3px solid #fb923c' : '3px solid #22d3ee',
      marginBottom: 5,
      fontSize: compact ? 11 : 13,
      color: isPriority ? '#fdba74' : '#67e8f9',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontWeight: 500,
    }}>
      {isPriority && <span style={{ marginRight: 4 }}>🔥</span>}
      {task.title}
      {doc && !compact && (
        <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b' }}>· {doc.vehicle_description || doc.customer_name}</span>
      )}
    </div>
  )
}
