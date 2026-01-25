'use client'

import { useState } from 'react'

type CalendarEvent = {
  id: string
  title: string
  event_type: string
  start_time: string
  end_time: string
  customer_name: string
  customer_phone: string
  vehicle_description: string
  status: string
}

export default function CalendarView({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week'>('week')

  const events = initialEvents

  const getWeekDays = () => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - start.getDay())
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      days.push(day)
    }
    return days
  }

  const weekDays = getWeekDays()
  const hours = Array.from({ length: 12 }, (_, i) => i + 7) // 7 AM to 6 PM

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  const formatHour = (hour: number) => {
    if (hour === 12) return '12 PM'
    if (hour > 12) return `${hour - 12} PM`
    return `${hour} AM`
  }

  const prevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const nextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const today = () => {
    setCurrentDate(new Date())
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'consultation': return '#3b82f6'
      case 'installation': return '#22c55e'
      case 'follow_up': return '#f59e0b'
      default: return '#d71cd1'
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Calendar</h1>
          <p style={{ color: '#94a3b8' }}>
            {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={today}
            style={{
              padding: '10px 16px',
              background: '#282a30',
              border: '1px solid #3f4451',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Today
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={prevWeek}
              style={{
                padding: '10px 14px',
                background: '#282a30',
                border: '1px solid #3f4451',
                borderRadius: '8px 0 0 8px',
                color: '#f1f5f9',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              ←
            </button>
            <button
              onClick={nextWeek}
              style={{
                padding: '10px 14px',
                background: '#282a30',
                border: '1px solid #3f4451',
                borderRadius: '0 8px 8px 0',
                color: '#f1f5f9',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              →
            </button>
          </div>
          <button
            style={{
              padding: '10px 20px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Add Event
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Day Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px repeat(7, 1fr)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          <div style={{ padding: '16px' }}></div>
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString()
            return (
              <div
                key={i}
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  borderLeft: '1px solid rgba(148, 163, 184, 0.1)'
                }}
              >
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </p>
                <p style={{
                  color: isToday ? '#d71cd1' : '#f1f5f9',
                  fontSize: '20px',
                  fontWeight: isToday ? '700' : '500',
                  margin: 0,
                  width: '36px',
                  height: '36px',
                  lineHeight: '36px',
                  borderRadius: '50%',
                  background: isToday ? 'rgba(215, 28, 209, 0.1)' : 'transparent',
                  display: 'inline-block'
                }}>
                  {day.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Time Grid */}
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px repeat(7, 1fr)',
                minHeight: '60px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.05)'
              }}
            >
              <div style={{
                padding: '8px',
                color: '#64748b',
                fontSize: '12px',
                textAlign: 'right',
                paddingRight: '12px'
              }}>
                {formatHour(hour)}
              </div>
              {weekDays.map((day, i) => {
                const dayEvents = getEventsForDay(day).filter(event => {
                  const eventHour = new Date(event.start_time).getHours()
                  return eventHour === hour
                })
                return (
                  <div
                    key={i}
                    style={{
                      borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
                      padding: '4px',
                      position: 'relative'
                    }}
                  >
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          background: getEventColor(event.event_type),
                          borderRadius: '6px',
                          padding: '6px 8px',
                          marginBottom: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <p style={{ color: 'white', fontSize: '12px', fontWeight: '600', margin: 0 }}>
                          {event.title}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', margin: '2px 0 0 0' }}>
                          {event.customer_name}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}