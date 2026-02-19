'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

type WidgetState = 'initializing' | 'ready' | 'incoming' | 'active' | 'error'

export default function PhoneWidget() {
  const [state, setState] = useState<WidgetState>('initializing')
  const [expanded, setExpanded] = useState(false)
  const [muted, setMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callerInfo, setCallerInfo] = useState<{ from: string; name?: string }>({ from: '' })
  const [dialNumber, setDialNumber] = useState('')

  const deviceRef = useRef<any>(null)
  const activeCallRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ringtoneRef = useRef<{ stop: () => void } | null>(null)

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return phone
  }

  const lookupCaller = useCallback(async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    const { data } = await supabase
      .from('customer_phones')
      .select('customers(name)')
      .or(`phone.ilike.%${cleanPhone.slice(-10)}%`)
      .limit(1)

    if (data && data.length > 0 && data[0].customers) {
      return (data[0].customers as any).name
    }
    return null
  }, [])

  // Simple ringtone using Web Audio API
  const startRingtone = useCallback(() => {
    try {
      const audioCtx = new AudioContext()
      let stopped = false

      const ring = () => {
        if (stopped) return
        // Two-tone ring pattern
        const osc1 = audioCtx.createOscillator()
        const osc2 = audioCtx.createOscillator()
        const gain = audioCtx.createGain()

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(audioCtx.destination)

        osc1.frequency.value = 440
        osc2.frequency.value = 480
        gain.gain.value = 0.15

        const now = audioCtx.currentTime
        osc1.start(now)
        osc2.start(now)
        osc1.stop(now + 1)
        osc2.stop(now + 1)

        gain.gain.setValueAtTime(0.15, now)
        gain.gain.setValueAtTime(0, now + 1)

        if (!stopped) setTimeout(ring, 3000)
      }

      ring()

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Incoming Call', {
          body: 'Your business line is ringing',
          tag: 'incoming-call',
          requireInteraction: true
        })
      }

      ringtoneRef.current = {
        stop: () => {
          stopped = true
          audioCtx.close()
        }
      }
    } catch (e) {
      console.error('Ringtone error:', e)
    }
  }, [])

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop()
    ringtoneRef.current = null
  }, [])

  // Load Twilio Voice SDK via script tag (bypasses bundler issues)
  const loadTwilioSDK = useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      // Already loaded
      if ((window as any).Twilio?.Device) {
        resolve((window as any).Twilio.Device)
        return
      }
      // Already loading
      const existing = document.querySelector('script[src="/twilio-voice.min.js"]')
      if (existing) {
        existing.addEventListener('load', () => resolve((window as any).Twilio.Device))
        existing.addEventListener('error', reject)
        return
      }
      const script = document.createElement('script')
      script.src = '/twilio-voice.min.js'
      script.onload = () => resolve((window as any).Twilio.Device)
      script.onerror = reject
      document.head.appendChild(script)
    })
  }, [])

  // Initialize Twilio Device
  useEffect(() => {
    let device: any
    let mounted = true

    async function init() {
      try {
        const Device = await loadTwilioSDK()

        const res = await fetch('/api/voice/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: 'ops-dashboard' })
        })

        if (!res.ok) {
          console.error('Failed to get voice token')
          if (mounted) setState('error')
          return
        }

        const { token } = await res.json()

        device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          logLevel: 1
        })

        device.on('incoming', async (call: any) => {
          const from = call.parameters.From || ''
          const name = await lookupCaller(from)

          if (mounted) {
            setCallerInfo({ from, name: name || undefined })
            setState('incoming')
            setExpanded(true)
            startRingtone()
          }

          activeCallRef.current = call

          call.on('cancel', () => {
            if (mounted) {
              stopRingtone()
              setState('ready')
              setExpanded(false)
              activeCallRef.current = null
            }
          })

          call.on('disconnect', () => {
            if (mounted) {
              stopRingtone()
              setState('ready')
              setExpanded(false)
              setCallDuration(0)
              setMuted(false)
              activeCallRef.current = null
              if (timerRef.current) clearInterval(timerRef.current)
            }
          })
        })

        // Auto-refresh token before expiry
        device.on('tokenWillExpire', async () => {
          try {
            const res = await fetch('/api/voice/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identity: 'ops-dashboard' })
            })
            const { token: newToken } = await res.json()
            device.updateToken(newToken)
          } catch (e) {
            console.error('Token refresh failed:', e)
          }
        })

        device.on('error', (err: any) => {
          console.error('Twilio Device error:', err)
        })

        await device.register()
        deviceRef.current = device
        if (mounted) setState('ready')

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }
      } catch (err) {
        console.error('Phone widget init error:', err)
        if (mounted) setState('error')
      }
    }

    init()

    return () => {
      mounted = false
      stopRingtone()
      if (timerRef.current) clearInterval(timerRef.current)
      device?.destroy()
    }
  }, [lookupCaller, startRingtone, stopRingtone, loadTwilioSDK])

  const answerCall = () => {
    if (activeCallRef.current) {
      stopRingtone()
      activeCallRef.current.accept()
      setState('active')
      setCallDuration(0)
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    }
  }

  const declineCall = () => {
    if (activeCallRef.current) {
      stopRingtone()
      activeCallRef.current.reject()
      activeCallRef.current = null
      setState('ready')
      setExpanded(false)
    }
  }

  const hangUp = () => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect()
      activeCallRef.current = null
      setState('ready')
      setExpanded(false)
      setCallDuration(0)
      setMuted(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const toggleMute = () => {
    if (activeCallRef.current) {
      const newMuted = !muted
      activeCallRef.current.mute(newMuted)
      setMuted(newMuted)
    }
  }

  const makeCall = async (number: string) => {
    if (!deviceRef.current || !number.trim()) return

    try {
      const formatted = number.startsWith('+') ? number : `+1${number.replace(/\D/g, '')}`
      const call = await deviceRef.current.connect({
        params: { To: formatted }
      })

      activeCallRef.current = call
      setCallerInfo({ from: formatted })
      setState('active')
      setExpanded(true)
      setDialNumber('')
      setCallDuration(0)
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)

      call.on('disconnect', () => {
        setState('ready')
        setExpanded(false)
        setCallDuration(0)
        setMuted(false)
        activeCallRef.current = null
        if (timerRef.current) clearInterval(timerRef.current)
      })
    } catch (err) {
      console.error('Outbound call error:', err)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const statusColor = state === 'ready' ? '#22c55e' :
                      state === 'incoming' ? '#f59e0b' :
                      state === 'active' ? '#3b82f6' :
                      state === 'error' ? '#ef4444' : '#64748b'

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '12px'
    }}>
      {/* Expanded panel */}
      {expanded && (
        <div style={{
          background: '#1d1d1d',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '16px',
          width: '320px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Incoming call */}
          {state === 'incoming' && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                animation: 'phoneRingPulse 1.5s ease-in-out infinite'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Incoming Call
              </p>
              <h3 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0' }}>
                {callerInfo.name || formatPhone(callerInfo.from)}
              </h3>
              {callerInfo.name && (
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
                  {formatPhone(callerInfo.from)}
                </p>
              )}
              {!callerInfo.name && <div style={{ height: '20px' }} />}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button
                  onClick={declineCall}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <button
                  onClick={answerCall}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Active call */}
          {state === 'active' && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Connected
              </p>
              <h3 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0' }}>
                {callerInfo.name || formatPhone(callerInfo.from)}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '24px', fontFamily: 'monospace', margin: '4px 0 24px 0' }}>
                {formatDuration(callDuration)}
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button
                  onClick={toggleMute}
                  title={muted ? 'Unmute' : 'Mute'}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: muted ? '#f59e0b' : '#282a30',
                    border: muted ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {muted ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .54-.06 1.07-.18 1.57" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={hangUp}
                  title="Hang up"
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                    <line x1="23" y1="1" x2="1" y2="23" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Ready state - quick dial */}
          {state === 'ready' && (
            <div style={{ padding: '20px' }}>
              <p style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Quick Dial
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="tel"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  placeholder="Enter phone number..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && dialNumber.trim()) makeCall(dialNumber) }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: '#111111',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => makeCall(dialNumber)}
                  disabled={!dialNumber.trim()}
                  style={{
                    padding: '10px 16px',
                    background: dialNumber.trim() ? '#22c55e' : '#282a30',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: dialNumber.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0' }}>
                Phone system offline
              </p>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                Check Twilio configuration
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => {
          if (state !== 'incoming') setExpanded(!expanded)
        }}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: statusColor,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 20px ${statusColor}40`,
          animation: state === 'incoming' ? 'phoneRingPulse 1s ease-in-out infinite' : 'none',
          transition: 'background 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </button>

      <style>{`
        @keyframes phoneRingPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
