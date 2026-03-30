'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ModalBackdrop from '../../components/ModalBackdrop'

type CalendarEvent = {
  id: string
  title: string
  event_type: string
  start_time: string
  end_time: string
  vehicle_start: string | null
  vehicle_end: string | null
  install_start: string | null
  install_end: string | null
  customer_name: string
  customer_phone: string
  vehicle_description: string
  status: string
  notes: string
  document_id: string
  google_event_id: string
  category: string | null
}

type DocumentLineItem = {
  id: string
  description: string
  quantity: number
  category: string
  line_type: string
  package_key: string
  attachments: any[]
  custom_fields: Record<string, any>
}

type DocumentDetail = {
  vehicle_description: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name: string
  category: string
  has_balance: boolean
  attachments: any[]
  line_items: DocumentLineItem[]
}

// Category color map
const CATEGORY_COLORS: Record<string, { color: string; label: string }> = {
  PPF: { color: '#ec4899', label: 'PPF' },
  FULL_PPF: { color: '#ec4899', label: 'PPF' },
  PARTIAL_PPF: { color: '#ec4899', label: 'PPF' },
  FULL_WRAP: { color: '#a855f7', label: 'Vinyl Wrap' },
  VINYL_WRAP: { color: '#a855f7', label: 'Vinyl Wrap' },
CHROME_DELETE: { color: '#a855f7', label: 'Vinyl Wrap' },
  COLOR_CHANGE: { color: '#a855f7', label: 'Vinyl Wrap' },
  COMMERCIAL_WRAP: { color: '#a855f7', label: 'Vinyl Wrap' },
  VINYL_GRAPHICS: { color: '#22c55e', label: 'Vinyl Graphics' },
  DECALS: { color: '#22c55e', label: 'Vinyl Graphics' },
  STRIPES: { color: '#22c55e', label: 'Vinyl Graphics' },
  LETTERING: { color: '#22c55e', label: 'Vinyl Graphics' },
  SIGNAGE: { color: '#14b8a6', label: 'Signage' },
  CHANNEL_LETTERS: { color: '#14b8a6', label: 'Signage' },
  MONUMENT_SIGN: { color: '#14b8a6', label: 'Signage' },
  WINDOW_TINT: { color: '#f59e0b', label: 'Window Tint' },
  RESIDENTIAL_TINT: { color: '#f59e0b', label: 'Window Tint' },
  COMMERCIAL_TINT: { color: '#f59e0b', label: 'Window Tint' },
  APPAREL: { color: '#3b82f6', label: 'Apparel' },
}

const DEFAULT_COLOR = '#6b7280' // Gray for no linked doc / unknown

const getEventColor = (event: CalendarEvent): string => {
  if (event.category && CATEGORY_COLORS[event.category]) {
    return CATEGORY_COLORS[event.category].color
  }
  // No category and no document = standalone event
  if (!event.document_id) return DEFAULT_COLOR
  // Has document but no category mapped
  return DEFAULT_COLOR
}

// Build unique legend items from events
const getLegendItems = (events: CalendarEvent[]) => {
  const seen = new Map<string, { color: string; label: string }>()
  
  events.forEach(event => {
    const color = getEventColor(event)
    if (event.category && CATEGORY_COLORS[event.category]) {
      const entry = CATEGORY_COLORS[event.category]
      if (!seen.has(entry.label)) seen.set(entry.label, { color: entry.color, label: entry.label })
    } else if (!event.document_id) {
      if (!seen.has('Manual')) seen.set('Manual', { color: DEFAULT_COLOR, label: 'Manual / Other' })
    }
  })
  
  return Array.from(seen.values())
}

export default function CalendarView({ initialEvents, documentMap = {}, readOnly = false }: { initialEvents: CalendarEvent[]; documentMap?: Record<string, DocumentDetail>; readOnly?: boolean }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'twoweek' | 'month'>('twoweek')
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleCustomer, setScheduleCustomer] = useState('')
  const [schedulePhone, setSchedulePhone] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [vehicleStartDate, setVehicleStartDate] = useState('')
  const [vehicleStartTime, setVehicleStartTime] = useState('09:00')
  const [vehicleEndDate, setVehicleEndDate] = useState('')
  const [vehicleEndTime, setVehicleEndTime] = useState('17:00')
  const [installStartDate, setInstallStartDate] = useState('')
  const [installStartTime, setInstallStartTime] = useState('09:00')
  const [installEndDate, setInstallEndDate] = useState('')
  const [installEndTime, setInstallEndTime] = useState('17:00')
  const [scheduling, setScheduling] = useState(false)
  const [dragState, setDragState] = useState<{ eventId: string; type: 'vehicle' | 'install'; edge: 'start' | 'end' | 'move'; startX: number; originalStart: string; originalEnd: string; hasMoved: boolean } | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const getWeekDays = (weeks: number = 1) => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - start.getDay())
    const days = []
    for (let i = 0; i < 7 * weeks; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getMonthDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay())
    const days = []
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + i)
      days.push(day)
    }
    return days
  }

  const weekDays = view === 'twoweek' ? getWeekDays(2) : getWeekDays(1)
  const monthDays = getMonthDays()

  const formatDateStr = (date: Date | null | undefined) => {
    if (!date || isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }

  const getEventsForRange = (days: Date[]) => {
    const rangeStart = formatDateStr(days[0])
    const rangeEnd = formatDateStr(days[days.length - 1])
    return events.filter(event => {
      const vStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
      const vEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
      return vStart <= rangeEnd && vEnd >= rangeStart
    })
  }

  const getDayIndex = (dateStr: string, days: Date[]) => {
    const date = new Date(dateStr + 'T00:00:00')
    return days.findIndex(d => formatDateStr(d) === formatDateStr(date))
  }

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate)
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7))
    } else if (view === 'twoweek') {
      newDate.setDate(newDate.getDate() + (direction * 14))
    } else {
      newDate.setMonth(newDate.getMonth() + direction)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())
  const openScheduleModal = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dropOffDate = formatDateStr(tomorrow)
    
    const pickupDate = new Date(tomorrow)
    pickupDate.setDate(pickupDate.getDate() + 7)
    const vehicleEndStr = formatDateStr(pickupDate)
    
    const installStart = new Date(tomorrow)
    installStart.setDate(installStart.getDate() + 1)
    const installEnd = new Date(pickupDate)
    installEnd.setDate(installEnd.getDate() - 1)
    
    setScheduleTitle('')
    setScheduleCustomer('')
    setSchedulePhone('')
    setScheduleNotes('')
    setVehicleStartDate(dropOffDate)
    setVehicleStartTime('09:00')
    setVehicleEndDate(vehicleEndStr)
    setVehicleEndTime('17:00')
    setInstallStartDate(formatDateStr(installStart))
    setInstallStartTime('09:00')
    setInstallEndDate(formatDateStr(installEnd))
    setInstallEndTime('17:00')
    setShowScheduleModal(true)
  }

  const handleScheduleJob = async () => {
    if (!scheduleTitle || !vehicleStartDate || !vehicleEndDate || !installStartDate || !installEndDate) {
      alert('Please fill in all required fields')
      return
    }
    
    setScheduling(true)
    
    try {
      const vehicleStart = new Date(`${vehicleStartDate}T${vehicleStartTime}`).toISOString()
      const vehicleEnd = new Date(`${vehicleEndDate}T${vehicleEndTime}`).toISOString()
      
      // Create Google Calendar event (Vehicle On Site only)
      const calendarResponse = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scheduleTitle,
          description: `Vehicle On Site\n\nInstall: ${installStartDate} - ${installEndDate}\n\n${scheduleNotes}`,
          startTime: vehicleStart,
          endTime: vehicleEnd,
          customerName: scheduleCustomer,
          customerPhone: schedulePhone
        })
      })
      
      const calendarResult = await calendarResponse.json()
      
      let googleEventId = null
      if (calendarResult.success) {
        googleEventId = calendarResult.eventId
      }
      
      // Save to database
      const { data, error: dbError } = await supabase.from('calendar_events').insert({
        google_event_id: googleEventId,
        event_type: 'Job',
        title: scheduleTitle,
        start_time: vehicleStart,
        end_time: vehicleEnd,
        vehicle_start: vehicleStartDate,
        vehicle_end: vehicleEndDate,
        install_start: installStartDate,
        install_end: installEndDate,
        customer_name: scheduleCustomer || null,
        customer_phone: schedulePhone || null,
        status: 'Scheduled',
        notes: scheduleNotes || null
      }).select().single()
      
      if (dbError) {
        console.error('DB error:', dbError)
        alert('Failed to save event')
      } else {
        setEvents(prev => [...prev, data])
        setShowScheduleModal(false)
        alert('Job scheduled!')
      }
    } catch (err) {
      console.error('Schedule error:', err)
      alert('Failed to schedule job')
    }
    
    setScheduling(false)
  }

  const getHeaderText = () => {
    if (view === 'week') {
      const days = getWeekDays(1)
      return `${days[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${days[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    } else if (view === 'twoweek') {
      const days = getWeekDays(2)
      return `${days[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${days[13].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const handleMouseDown = (e: React.MouseEvent, eventId: string, type: 'vehicle' | 'install', edge: 'start' | 'end' | 'move') => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    const event = events.find(ev => ev.id === eventId)
    if (!event) return
    
    const originalStart = type === 'vehicle' 
      ? (event.vehicle_start || formatDateStr(new Date(event.start_time)))
      : (event.install_start || '')
    const originalEnd = type === 'vehicle'
      ? (event.vehicle_end || formatDateStr(new Date(event.end_time)))
      : (event.install_end || '')
    
    setDragState({ eventId, type, edge, startX: e.clientX, originalStart, originalEnd, hasMoved: false })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState || !calendarRef.current) return
    
    const rect = calendarRef.current.getBoundingClientRect()
    const numDays = view === 'month' ? 7 : (view === 'twoweek' ? 14 : 7)
    const dayWidth = rect.width / (view === 'month' ? 7 : numDays)
    const deltaX = e.clientX - dragState.startX
    const daysDelta = Math.round(deltaX / dayWidth)
    
    if (daysDelta === 0 && !dragState.hasMoved) return
    
    if (daysDelta !== 0 && !dragState.hasMoved) {
      setDragState(prev => prev ? { ...prev, hasMoved: true } : null)
    }
    
    setEvents(prev => prev.map(event => {
      if (event.id !== dragState.eventId) return event
      
      const addDays = (dateStr: string, days: number) => {
        const d = new Date(dateStr + 'T00:00:00')
        d.setDate(d.getDate() + days)
        return formatDateStr(d)
      }
      
      if (dragState.type === 'vehicle') {
        let newVehicleStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
        let newVehicleEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
        
        if (dragState.edge === 'start') {
          newVehicleStart = addDays(dragState.originalStart, daysDelta)
          if (newVehicleStart > newVehicleEnd) newVehicleStart = newVehicleEnd
        } else if (dragState.edge === 'end') {
          newVehicleEnd = addDays(dragState.originalEnd, daysDelta)
          if (newVehicleEnd < newVehicleStart) newVehicleEnd = newVehicleStart
        } else {
          newVehicleStart = addDays(dragState.originalStart, daysDelta)
          newVehicleEnd = addDays(dragState.originalEnd, daysDelta)
        }
        
        let newInstallStart = event.install_start || newVehicleStart
        let newInstallEnd = event.install_end || newVehicleEnd
        if (newInstallStart < newVehicleStart) newInstallStart = newVehicleStart
        if (newInstallEnd > newVehicleEnd) newInstallEnd = newVehicleEnd
        if (newInstallStart > newInstallEnd) newInstallStart = newInstallEnd
        
        return { ...event, vehicle_start: newVehicleStart, vehicle_end: newVehicleEnd, install_start: newInstallStart, install_end: newInstallEnd }
      } else {
        let newInstallStart = event.install_start || ''
        let newInstallEnd = event.install_end || ''
        const vehicleStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
        const vehicleEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
        
        if (dragState.edge === 'start') {
          newInstallStart = addDays(dragState.originalStart, daysDelta)
          if (newInstallStart < vehicleStart) newInstallStart = vehicleStart
        } else if (dragState.edge === 'end') {
          newInstallEnd = addDays(dragState.originalEnd, daysDelta)
          if (newInstallEnd > vehicleEnd) newInstallEnd = vehicleEnd
        } else {
          newInstallStart = addDays(dragState.originalStart, daysDelta)
          newInstallEnd = addDays(dragState.originalEnd, daysDelta)
          if (newInstallStart < vehicleStart) {
            const diff = (new Date(vehicleStart).getTime() - new Date(newInstallStart).getTime()) / (1000 * 60 * 60 * 24)
            newInstallStart = vehicleStart
            newInstallEnd = addDays(newInstallEnd, diff)
          }
          if (newInstallEnd > vehicleEnd) {
            const diff = (new Date(newInstallEnd).getTime() - new Date(vehicleEnd).getTime()) / (1000 * 60 * 60 * 24)
            newInstallEnd = vehicleEnd
            newInstallStart = addDays(newInstallStart, -diff)
          }
        }
        
        return { ...event, install_start: newInstallStart, install_end: newInstallEnd }
      }
    }))
  }

  const handleMouseUp = async (e: MouseEvent) => {
    if (!dragState) return
    
    const event = events.find(ev => ev.id === dragState.eventId)
    
    if (dragState.hasMoved && event) {
      const { error } = await supabase.from('calendar_events').update({
        vehicle_start: event.vehicle_start,
        vehicle_end: event.vehicle_end,
        install_start: event.install_start,
        install_end: event.install_end
      }).eq('id', event.id)
      
      if (error) console.error('Failed to save:', error)
    }
    
    setDragState(null)
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (!dragState || !dragState.hasMoved) {
      setEditingEvent(event)
    }
  }

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState, events])

  const btnStyle = (active: boolean) => ({
    padding: '8px 16px',
    background: active ? '#d71cd1' : '#282a30',
    border: active ? 'none' : '1px solid #3f4451',
    borderRadius: '6px',
    color: active ? 'white' : '#94a3b8',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer'
  })

  const renderWeekEvent = (event: CalendarEvent, rowIndex: number, days: Date[]) => {
    const eventColor = getEventColor(event)
    const vStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
    const vEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
    const iStart = event.install_start || vStart
    const iEnd = event.install_end || vEnd
    
    const rangeStart = formatDateStr(days[0])
    const rangeEnd = formatDateStr(days[days.length - 1])
    
    const clamp = (dateStr: string) => {
      if (dateStr < rangeStart) return rangeStart
      if (dateStr > rangeEnd) return rangeEnd
      return dateStr
    }
    
    const vStartClamped = clamp(vStart)
    const vEndClamped = clamp(vEnd)
    const iStartClamped = clamp(iStart)
    const iEndClamped = clamp(iEnd)
    
    const vStartIdx = getDayIndex(vStartClamped, days)
    const vEndIdx = getDayIndex(vEndClamped, days)
    const iStartIdx = getDayIndex(iStartClamped, days)
    const iEndIdx = getDayIndex(iEndClamped, days)
    
    if (vStartIdx < 0 || vEndIdx < 0) return null
    
    const numDays = days.length
    const dayWidth = 100 / numDays
    const vLeft = vStartIdx * dayWidth
    const vWidth = (vEndIdx - vStartIdx + 1) * dayWidth
    const iLeft = iStartIdx * dayWidth
    const iWidth = (iEndIdx - iStartIdx + 1) * dayWidth
    
    return (
      <div key={event.id} style={{ position: 'absolute', top: rowIndex * 70 + 8, left: 0, right: 0, height: '62px' }}>
        {/* Vehicle On Site (dashed outline) */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${vLeft}% + 4px)`,
            width: `calc(${vWidth}% - 8px)`,
            height: '100%',
            border: `2px dashed ${eventColor}`,
            borderRadius: '8px',
            background: `${eventColor}08`,
            cursor: 'move'
          }}
          onMouseDown={(e) => handleMouseDown(e, event.id, 'vehicle', 'move')}
        >
          <div style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} onMouseDown={(e) => handleMouseDown(e, event.id, 'vehicle', 'start')} />
          <div style={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} onMouseDown={(e) => handleMouseDown(e, event.id, 'vehicle', 'end')} />
        </div>
        
        {/* Install Period (filled) */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${iLeft}% + 6px)`,
            width: `calc(${iWidth}% - 12px)`,
            height: 'calc(100% - 8px)',
            top: '4px',
            background: `linear-gradient(135deg, ${eventColor}55, ${eventColor}35)`,
            border: `2px solid ${eventColor}`,
            borderRadius: '6px',
            cursor: 'move',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 10px',
            overflow: 'hidden'
          }}
          onClick={() => handleEventClick(event)}
          onMouseDown={(e) => handleMouseDown(e, event.id, 'install', 'move')}
        >
          <div style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} onMouseDown={(e) => handleMouseDown(e, event.id, 'install', 'start')} />
          <div style={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} onMouseDown={(e) => handleMouseDown(e, event.id, 'install', 'end')} />
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{event.title}</p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', margin: '2px 0 0 0', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            Install: {new Date(iStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(iEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    )
  }

  const renderMonthRow = (weekDays: Date[], weekIndex: number) => {
    const weekStart = formatDateStr(weekDays[0])
    const weekEnd = formatDateStr(weekDays[6])
    
    const weekEvents = events.filter(event => {
      const vStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
      const vEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
      return vStart <= weekEnd && vEnd >= weekStart
    })
    
    return weekEvents.map((event, idx) => {
      const eventColor = getEventColor(event)
      const vStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
      const vEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
      const iStart = event.install_start || vStart
      const iEnd = event.install_end || vEnd
      
      const clamp = (dateStr: string) => {
        if (dateStr < weekStart) return weekStart
        if (dateStr > weekEnd) return weekEnd
        return dateStr
      }
      
      const vStartClamped = clamp(vStart)
      const vEndClamped = clamp(vEnd)
      const iStartClamped = clamp(iStart)
      const iEndClamped = clamp(iEnd)
      
      const vStartIdx = weekDays.findIndex(d => formatDateStr(d) === vStartClamped)
      const vEndIdx = weekDays.findIndex(d => formatDateStr(d) === vEndClamped)
      const iStartIdx = weekDays.findIndex(d => formatDateStr(d) === iStartClamped)
      const iEndIdx = weekDays.findIndex(d => formatDateStr(d) === iEndClamped)
      
      if (vStartIdx < 0 || vEndIdx < 0) return null
      
      const dayWidth = 100 / 7
      const vLeft = vStartIdx * dayWidth
      const vWidth = (vEndIdx - vStartIdx + 1) * dayWidth
      const iLeft = Math.max(vStartIdx, iStartIdx) * dayWidth
      const iWidth = (Math.min(vEndIdx, iEndIdx) - Math.max(vStartIdx, iStartIdx) + 1) * dayWidth
      
      const showInstall = iStartClamped <= weekEnd && iEndClamped >= weekStart
      
      return (
        <div key={event.id} style={{ position: 'absolute', top: 32 + idx * 26, left: 0, right: 0, height: '22px', zIndex: 10 }}>
          {/* Vehicle On Site (dashed outline) */}
          <div
            style={{
              position: 'absolute',
              left: `calc(${vLeft}% + 2px)`,
              width: `calc(${vWidth}% - 4px)`,
              height: '100%',
              border: `2px dashed ${eventColor}`,
              borderRadius: '4px',
              background: `${eventColor}08`
            }}
          />
          {/* Install Period (filled) */}
          {showInstall && iWidth > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `calc(${iLeft}% + 3px)`,
                width: `calc(${iWidth}% - 6px)`,
                height: 'calc(100% - 4px)',
                top: '2px',
                background: `${eventColor}44`,
                border: `2px solid ${eventColor}`,
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0 6px',
                overflow: 'hidden'
              }}
              onClick={() => handleEventClick(event)}
            >
              <p style={{ color: '#fff', fontSize: '10px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{event.title}</p>
            </div>
          )}
        </div>
      )
    })
  }

  const getMonthWeeks = () => {
    const weeks = []
    for (let i = 0; i < 6; i++) {
      weeks.push(monthDays.slice(i * 7, i * 7 + 7))
    }
    return weeks
  }

  // Build dynamic legend from current events
  const legendItems = getLegendItems(events)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Job Calendar</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>{getHeaderText()}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#1d1d1d', padding: '4px', borderRadius: '8px' }}>
            <button onClick={() => setView('week')} style={btnStyle(view === 'week')}>Week</button>
            <button onClick={() => setView('twoweek')} style={btnStyle(view === 'twoweek')}>2 Weeks</button>
            <button onClick={() => setView('month')} style={btnStyle(view === 'month')}>Month</button>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={goToToday} style={{ padding: '10px 16px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer' }}>Today</button>
            <button onClick={() => navigate(-1)} style={{ padding: '10px 14px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '8px 0 0 8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer' }}>←</button>
            <button onClick={() => navigate(1)} style={{ padding: '10px 14px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '0 8px 8px 0', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer' }}>→</button>
          </div>
          {!readOnly && (
            <a href="/install" target="_blank" style={{ padding: '10px 16px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Install View
            </a>
          )}
          {!readOnly && (
            <button onClick={openScheduleModal} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Schedule Job
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Always show Vehicle / Install legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '28px', height: '16px', border: '2px dashed #94a3b8', borderRadius: '3px', background: 'transparent' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>Vehicle On Site</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '28px', height: '16px', border: '2px solid #94a3b8', borderRadius: '3px', background: 'rgba(148,163,184,0.25)' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>Install Period</span>
        </div>
        
        {/* Divider */}
        {legendItems.length > 0 && (
          <div style={{ width: '1px', height: '16px', background: 'rgba(148,163,184,0.2)', margin: '0 4px' }} />
        )}
        
        {/* Category color legend */}
        {legendItems.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div ref={calendarRef} style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden', userSelect: 'none' }}>
        
        {/* WEEK / TWO WEEK VIEW */}
        {(view === 'week' || view === 'twoweek') && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDays.length}, 1fr)`, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
              {weekDays.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const isNewWeek = i > 0 && day.getDay() === 0
                const isSunday = day.getDay() === 0
                return (
                  <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: i > 0 ? `1px solid rgba(148,163,184,${isNewWeek ? '0.2' : '0.1'})` : 'none', background: isSunday ? 'rgba(100,116,139,0.08)' : 'transparent' }}>
                    <p style={{ color: isSunday ? '#475569' : '#64748b', fontSize: '11px', margin: '0 0 2px 0' }}>{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</p>
                    <p style={{ color: isToday ? '#d71cd1' : isSunday ? '#475569' : '#f1f5f9', fontSize: '16px', fontWeight: isToday ? 700 : 500, margin: 0, width: '28px', height: '28px', lineHeight: '28px', borderRadius: '50%', background: isToday ? 'rgba(215,28,209,0.15)' : 'transparent', display: 'inline-block' }}>{day.getDate()}</p>
                  </div>
                )
              })}
            </div>
            <div style={{ position: 'relative', minHeight: Math.max(200, getEventsForRange(weekDays).length * 70 + 20) }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDays.length}, 1fr)`, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {weekDays.map((day, i) => {
                  const isNewWeek = i > 0 && day.getDay() === 0
                  const isSunday = day.getDay() === 0
                  return <div key={i} style={{ borderLeft: i > 0 ? `1px solid rgba(148,163,184,${isNewWeek ? '0.15' : '0.05'})` : 'none', background: isSunday ? 'rgba(100,116,139,0.08)' : 'transparent' }} />
                })}
              </div>
              {getEventsForRange(weekDays).map((event, idx) => renderWeekEvent(event, idx, weekDays))}
            </div>
          </>
        )}

        {/* MONTH VIEW */}
        {view === 'month' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <div key={day} style={{ padding: '12px', textAlign: 'center', color: i === 0 ? '#475569' : '#64748b', fontSize: '12px', fontWeight: 600, background: i === 0 ? 'rgba(100,116,139,0.08)' : 'transparent' }}>{day.toUpperCase()}</div>
              ))}
            </div>
            {getMonthWeeks().map((week, weekIdx) => {
              const weekEvents = events.filter(event => {
                const vStart = event.vehicle_start || formatDateStr(new Date(event.start_time))
                const vEnd = event.vehicle_end || formatDateStr(new Date(event.end_time))
                const weekStart = formatDateStr(week[0])
                const weekEnd = formatDateStr(week[6])
                return vStart <= weekEnd && vEnd >= weekStart
              })
              const rowHeight = Math.max(100, 32 + weekEvents.length * 26 + 8)
              
              return (
                <div key={weekIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', position: 'relative', minHeight: rowHeight, borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                  {week.map((day, dayIdx) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                    const isToday = day.toDateString() === new Date().toDateString()
                    const isSunday = day.getDay() === 0
                    return (
                      <div key={dayIdx} style={{ padding: '6px', borderRight: '1px solid rgba(148,163,184,0.05)', opacity: isCurrentMonth ? 1 : 0.4, background: isSunday ? 'rgba(100,116,139,0.08)' : 'transparent' }}>
                        <p style={{ color: isToday ? '#d71cd1' : isSunday ? '#475569' : '#f1f5f9', fontSize: '13px', fontWeight: isToday ? 700 : 400, margin: 0, width: '24px', height: '24px', lineHeight: '24px', textAlign: 'center', borderRadius: '50%', background: isToday ? 'rgba(215,28,209,0.2)' : 'transparent' }}>{day.getDate()}</p>
                      </div>
                    )
                  })}
                  {renderMonthRow(week, weekIdx)}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Schedule Job Modal */}
      {showScheduleModal && (
        <ModalBackdrop onClose={() => setShowScheduleModal(false)} zIndex={1000}>
          <div style={{ background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Schedule Job</h2>
              <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px' }}>
              {/* Job Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Title *</label>
                <input type="text" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="e.g., Full Wrap - John Smith" style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              
              {/* Customer Info Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Name</label>
                  <input type="text" value={scheduleCustomer} onChange={(e) => setScheduleCustomer(e.target.value)} placeholder="Customer name" style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                  <input type="tel" value={schedulePhone} onChange={(e) => setSchedulePhone(e.target.value)} placeholder="Phone number" style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>
              
              {/* Vehicle On Site Section */}
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(34,197,94,0.05)', border: '2px dashed rgba(34,197,94,0.3)', borderRadius: '12px' }}>
                <h3 style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Vehicle On Site
                  <span style={{ fontWeight: 400, fontSize: '12px', color: '#64748b' }}>(syncs to Google Calendar)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drop-off Date *</label>
                    <input type="date" value={vehicleStartDate} onChange={(e) => setVehicleStartDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drop-off Time</label>
                    <input type="time" value={vehicleStartTime} onChange={(e) => setVehicleStartTime(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pick-up Date *</label>
                    <input type="date" value={vehicleEndDate} onChange={(e) => setVehicleEndDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pick-up Time</label>
                    <input type="time" value={vehicleEndTime} onChange={(e) => setVehicleEndTime(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
              
              {/* Install Period Section */}
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.4)', borderRadius: '12px' }}>
                <h3 style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Install Period
                  <span style={{ fontWeight: 400, fontSize: '12px', color: '#64748b' }}>(internal scheduling)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Install Start *</label>
                    <input type="date" value={installStartDate} onChange={(e) => setInstallStartDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Time</label>
                    <input type="time" value={installStartTime} onChange={(e) => setInstallStartTime(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Install End *</label>
                    <input type="date" value={installEndDate} onChange={(e) => setInstallEndDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Time</label>
                    <input type="time" value={installEndTime} onChange={(e) => setInstallEndTime(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
              
              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                <textarea value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Additional notes..." rows={3} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowScheduleModal(false)} style={{ padding: '10px 20px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleScheduleJob} disabled={scheduling || !scheduleTitle || !vehicleStartDate || !vehicleEndDate || !installStartDate || !installEndDate} style={{ padding: '10px 20px', background: scheduling ? '#555' : '#22c55e', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: scheduling ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {scheduling ? 'Scheduling...' : 'Schedule Job'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Edit Modal */}
      {editingEvent && (() => {
        const doc = editingEvent.document_id ? documentMap[editingEvent.document_id] : null
        const eColor = getEventColor(editingEvent)

        // Collect all mockup/image attachments from line items and document
        const allImages: { url: string; label: string }[] = []
        if (doc) {
          doc.line_items.forEach((li: DocumentLineItem) => {
            if (li.attachments && Array.isArray(li.attachments)) {
              li.attachments.forEach((att: any) => {
                const url = att.url || att.file_url
                if (url) allImages.push({ url, label: li.description || 'Mockup' })
              })
            }
          })
          if (doc.attachments && Array.isArray(doc.attachments)) {
            doc.attachments.forEach((att: any) => {
              const url = att.url || att.file_url
              const name = att.filename || att.file_name || att.name || 'Project File'
              const type = att.contentType || att.mime_type || att.type || ''
              if (url && (type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name))) {
                allImages.push({ url, label: name })
              }
            })
          }
        }

        return (
        <ModalBackdrop onClose={() => setEditingEvent(null)} zIndex={1000}>
          <div style={{ background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: doc ? '720px' : '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Edit Event</h2>
                {editingEvent.category && CATEGORY_COLORS[editingEvent.category] && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                    background: `${CATEGORY_COLORS[editingEvent.category].color}20`,
                    color: CATEGORY_COLORS[editingEvent.category].color,
                    border: `1px solid ${CATEGORY_COLORS[editingEvent.category].color}40`
                  }}>
                    {CATEGORY_COLORS[editingEvent.category].label}
                  </span>
                )}
                {!editingEvent.document_id && !editingEvent.category && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                    background: 'rgba(107,114,128,0.2)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.4)'
                  }}>
                    Manual
                  </span>
                )}
                {doc?.has_balance && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                    background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)'
                  }}>
                    Balance Due
                  </span>
                )}
              </div>
              <button onClick={() => setEditingEvent(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Vehicle / Subject - prominent when linked to a doc */}
              {doc?.vehicle_description && (
                <div style={{ marginBottom: '20px', padding: '14px 16px', background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={eColor} strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  <span style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600 }}>{doc.vehicle_description}</span>
                </div>
              )}

              {/* Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Title</label>
                <input type="text" value={editingEvent.title} onChange={(e) => setEditingEvent({...editingEvent, title: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              {/* Customer Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</label>
                  <input type="text" value={editingEvent.customer_name || ''} onChange={(e) => setEditingEvent({...editingEvent, customer_name: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                  <input type="tel" value={editingEvent.customer_phone || ''} onChange={(e) => setEditingEvent({...editingEvent, customer_phone: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                {doc?.customer_email && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                    <div style={{ padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.customer_email}</div>
                  </div>
                )}
              </div>

              {/* Line Items from linked document */}
              {doc && doc.line_items.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope of Work</label>
                  <div style={{ background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '10px', overflow: 'hidden' }}>
                    {doc.line_items.map((li: DocumentLineItem, idx: number) => (
                      <div key={li.id} style={{ padding: '10px 14px', borderBottom: idx < doc.line_items.length - 1 ? '1px solid rgba(148,163,184,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: eColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500 }}>{li.description}</span>
                          {li.quantity > 1 && (
                            <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>x{li.quantity}</span>
                          )}
                        </div>
                        {li.category && CATEGORY_COLORS[li.category] && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: `${CATEGORY_COLORS[li.category].color}15`, color: CATEGORY_COLORS[li.category].color, flexShrink: 0 }}>
                            {CATEGORY_COLORS[li.category].label}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mockups & Project Files */}
              {allImages.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mockups & Files</label>
                  <div style={{ display: 'grid', gridTemplateColumns: allImages.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {allImages.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setLightboxImage(img.url)}
                        style={{
                          position: 'relative',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1px solid rgba(148,163,184,0.12)',
                          cursor: 'pointer',
                          aspectRatio: allImages.length === 1 ? '16/9' : '4/3',
                          background: '#1d1d1d'
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: '#fff', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {img.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle On Site Section */}
              <div style={{ marginBottom: '20px', padding: '16px', background: `${eColor}08`, border: `2px dashed ${eColor}50`, borderRadius: '12px' }}>
                <h3 style={{ color: eColor, fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Vehicle On Site
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drop-off Date</label>
                    <input type="date" value={editingEvent.vehicle_start || ''} onChange={(e) => setEditingEvent({...editingEvent, vehicle_start: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pick-up Date</label>
                    <input type="date" value={editingEvent.vehicle_end || ''} onChange={(e) => setEditingEvent({...editingEvent, vehicle_end: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* Install Period Section */}
              <div style={{ marginBottom: '20px', padding: '16px', background: `${eColor}15`, border: `2px solid ${eColor}60`, borderRadius: '12px' }}>
                <h3 style={{ color: eColor, fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Install Period
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Install Start</label>
                    <input type="date" value={editingEvent.install_start || ''} onChange={(e) => setEditingEvent({...editingEvent, install_start: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Install End</label>
                    <input type="date" value={editingEvent.install_end || ''} onChange={(e) => setEditingEvent({...editingEvent, install_end: e.target.value})} disabled={readOnly} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                <textarea value={editingEvent.notes || ''} onChange={(e) => setEditingEvent({...editingEvent, notes: e.target.value})} disabled={readOnly} placeholder="Additional notes..." rows={3} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: readOnly ? '#94a3b8' : '#f1f5f9', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.open(`/api/production-card?eventId=${editingEvent.id}`, '_blank')} style={{ padding: '10px 16px', background: '#CE0000', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print Production Card
                </button>
                {!readOnly && editingEvent.document_id && (
                  <a href={`/documents/${editingEvent.document_id}`} style={{ padding: '10px 16px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    View Document
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {readOnly ? (
                  <button onClick={() => setEditingEvent(null)} style={{ padding: '10px 20px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer' }}>Close</button>
                ) : (
                  <>
                    <button onClick={() => setEditingEvent(null)} style={{ padding: '10px 20px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={async () => {
                      const { error } = await supabase.from('calendar_events').update({
                        title: editingEvent.title,
                        customer_name: editingEvent.customer_name,
                        customer_phone: editingEvent.customer_phone,
                        vehicle_start: editingEvent.vehicle_start,
                        vehicle_end: editingEvent.vehicle_end,
                        install_start: editingEvent.install_start,
                        install_end: editingEvent.install_end,
                        notes: editingEvent.notes
                      }).eq('id', editingEvent.id)
                      if (error) {
                        console.error('Update error:', error)
                        alert('Failed to save changes')
                      } else {
                        setEvents(prev => prev.map(e => e.id === editingEvent.id ? editingEvent : e))
                        setEditingEvent(null)
                      }
                    }} style={{ padding: '10px 20px', background: '#22c55e', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalBackdrop>
        )
      })()}

      {/* Image Lightbox */}
      {lightboxImage && (
        <ModalBackdrop onClose={() => setLightboxImage(null)} zIndex={1100}>
          <div onClick={() => setLightboxImage(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '40px', boxSizing: 'border-box' }}>
            <img src={lightboxImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()} />
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}