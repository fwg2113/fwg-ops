'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { playSound, playCustomSound } from '../lib/notificationSounds'

type CallRecord = {
  id: string
  caller_phone: string
  caller_city: string | null
  caller_state: string | null
  category: string | null
  status: string
  answered_by: string | null
  direction: string
}

type ToastState = {
  call: CallRecord
  status: 'ringing' | 'menu-selected' | 'answered' | 'missed' | 'ended'
  dismissAt: number | null
  createdAt: number
}

type CustomSound = {
  id: string
  label: string
  dataUrl: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'vehicle-wraps-ppf': 'Vehicle Wraps & PPF',
  'stickers-signage': 'Stickers & Signage',
  'apparel': 'Embroidery & Custom Apparel',
  'general': 'General Inquiry',
}

// All statuses that mean the call is over
const TERMINAL_STATUSES = new Set([
  'completed', 'missed', 'canceled', 'cancelled',
  'no-answer', 'busy', 'failed', 'voicemail', 'screened',
])

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
  }
  return phone
}

function playSoundByKey(key: string, customSounds: CustomSound[]) {
  if (key.startsWith('custom:')) {
    const customId = key.replace('custom:', '')
    const customSound = customSounds.find(cs => cs.id === customId)
    if (customSound) {
      playCustomSound(customSound.dataUrl)
    } else {
      playSound('doorbell')
    }
  } else {
    playSound(key)
  }
}

function isWithinActiveHours(startHour: number, endHour: number): boolean {
  const hour = new Date().getHours()
  return startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour
}

// Safety timeout: auto-dismiss toasts older than 120 seconds
const SAFETY_TIMEOUT_MS = 120_000

export default function IncomingCallToast() {
  const [toasts, setToasts] = useState<Map<string, ToastState>>(new Map())
  const [hasInteracted, setHasInteracted] = useState(false)
  const settingsRef = useRef<{
    sound_enabled: boolean
    call_sound_key: string
    start_hour: number
    end_hour: number
  }>({ sound_enabled: true, call_sound_key: 'doorbell', start_hour: 9, end_hour: 17 })
  const customSoundsRef = useRef<CustomSound[]>([])
  const hasInteractedRef = useRef(false)
  hasInteractedRef.current = hasInteracted

  // Load notification settings
  const loadSettings = useCallback(async () => {
    try {
      const [notifRes, soundsRes] = await Promise.all([
        fetch('/api/settings/notifications'),
        fetch('/api/settings/notification-sounds'),
      ])
      const notifData = await notifRes.json()
      const soundsData = await soundsRes.json()
      settingsRef.current = {
        sound_enabled: notifData.sound_enabled ?? true,
        call_sound_key: notifData.call_sound_key ?? 'doorbell',
        start_hour: notifData.start_hour ?? 9,
        end_hour: notifData.end_hour ?? 17,
      }
      customSoundsRef.current = soundsData.sounds || []
    } catch {
      // Use defaults
    }
  }, [])

  useEffect(() => {
    loadSettings()
    const handler = () => loadSettings()
    window.addEventListener('notification-settings-changed', handler)
    return () => window.removeEventListener('notification-settings-changed', handler)
  }, [loadSettings])

  // Track user interaction for Web Audio API
  useEffect(() => {
    const handler = () => setHasInteracted(true)
    window.addEventListener('click', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [])

  // Auto-dismiss timer + safety timeout
  useEffect(() => {
    if (toasts.size === 0) return
    const interval = setInterval(() => {
      const now = Date.now()
      setToasts(prev => {
        const next = new Map(prev)
        let changed = false
        for (const [id, toast] of next) {
          // Explicit dismiss time (answered/missed/ended)
          if (toast.dismissAt && now >= toast.dismissAt) {
            next.delete(id)
            changed = true
          }
          // Safety timeout: dismiss stale toasts stuck in ringing/menu-selected
          else if (now - toast.createdAt >= SAFETY_TIMEOUT_MS && !toast.dismissAt) {
            next.delete(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 500)
    return () => clearInterval(interval)
  }, [toasts.size])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('incoming-call-toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls' },
        (payload) => {
          const call = payload.new as CallRecord
          if (call.direction !== 'inbound') return

          setToasts(prev => {
            const next = new Map(prev)
            next.set(call.id, { call, status: 'ringing', dismissAt: null, createdAt: Date.now() })
            return next
          })

          // Play sound
          const s = settingsRef.current
          if (s.sound_enabled && hasInteractedRef.current && isWithinActiveHours(s.start_hour, s.end_hour)) {
            playSoundByKey(s.call_sound_key || 'doorbell', customSoundsRef.current)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls' },
        (payload) => {
          const call = payload.new as CallRecord

          setToasts(prev => {
            const existing = prev.get(call.id)
            if (!existing) return prev

            const next = new Map(prev)

            // Answered (in-progress or has answered_by)
            if (call.answered_by || call.status === 'in-progress') {
              next.set(call.id, {
                ...existing,
                call,
                status: 'answered',
                dismissAt: Date.now() + 3000,
              })
              return next
            }

            // Any terminal status
            if (TERMINAL_STATUSES.has(call.status)) {
              // Completed after being answered → show "Answered" briefly
              if (call.status === 'completed' && existing.status === 'answered') {
                next.set(call.id, {
                  ...existing,
                  call,
                  dismissAt: existing.dismissAt || Date.now() + 3000,
                })
                return next
              }

              // Missed / voicemail
              if (call.status === 'missed' || call.status === 'voicemail') {
                next.set(call.id, {
                  ...existing,
                  call,
                  status: 'missed',
                  dismissAt: Date.now() + 5000,
                })
                return next
              }

              // All other terminal statuses (canceled, no-answer, busy, failed, completed, screened)
              next.set(call.id, {
                ...existing,
                call,
                status: 'ended',
                dismissAt: Date.now() + 4000,
              })
              return next
            }

            // Category selected
            if (call.category && existing.status === 'ringing') {
              next.set(call.id, {
                ...existing,
                call,
                status: 'menu-selected',
                dismissAt: null,
              })
              return next
            }

            // Generic update - keep existing state but update call data
            next.set(call.id, { ...existing, call })
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const dismiss = (id: string) => {
    setToasts(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  if (toasts.size === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      zIndex: 2500,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {Array.from(toasts.entries()).map(([id, toast]) => {
        const { call, status } = toast
        const location = [call.caller_city, call.caller_state].filter(Boolean).join(', ')

        let statusLine = ''
        let statusColor = '#94a3b8'
        if (status === 'ringing') {
          statusLine = 'Ringing...'
          statusColor = '#22d3ee'
        } else if (status === 'menu-selected') {
          statusLine = CATEGORY_LABELS[call.category || ''] || call.category || 'Menu selected'
          statusColor = '#a78bfa'
        } else if (status === 'answered') {
          statusLine = call.answered_by ? `Answered by ${call.answered_by}` : 'Answered'
          statusColor = '#22c55e'
        } else if (status === 'missed') {
          statusLine = call.status === 'voicemail' ? 'Went to voicemail' : 'Missed call'
          statusColor = '#ef4444'
        } else if (status === 'ended') {
          statusLine = 'Call ended'
          statusColor = '#94a3b8'
        }

        return (
          <div
            key={id}
            style={{
              pointerEvents: 'auto',
              background: '#1a1a2e',
              borderLeft: `4px solid ${status === 'missed' ? '#ef4444' : status === 'ended' ? '#64748b' : '#22c55e'}`,
              borderRadius: '10px',
              padding: '14px 16px',
              minWidth: 280,
              maxWidth: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              animation: 'slideInRight 0.3s ease-out',
              position: 'relative',
            }}
          >
            {/* Dismiss button */}
            <button
              onClick={() => dismiss(id)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: '2px 6px',
              }}
            >
              &times;
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>📞</span>
              <span style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600 }}>
                {formatPhone(call.caller_phone)}
              </span>
            </div>

            {/* Location */}
            {location && (
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, paddingLeft: 28 }}>
                {location}
              </div>
            )}

            {/* Status */}
            <div style={{
              color: statusColor,
              fontSize: 13,
              fontWeight: 500,
              paddingLeft: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {status === 'ringing' && (
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#22d3ee',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              )}
              {statusLine}
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
