'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

type WidgetState = 'initializing' | 'ready' | 'incoming' | 'calling' | 'active' | 'error'
type TransferState = null | 'selecting' | 'initiating' | 'connecting' | 'briefing' | 'completing'

interface ActiveDbCall {
  call_sid: string
  caller_phone: string
  receiver_phone: string
  answered_by: string | null
  agent_call_sid: string | null
  category: string | null
  transfer_status: string | null
  transfer_target_phone: string | null
  transfer_target_name: string | null
  customer_name: string | null
  created_at: string
}

interface TeamMember {
  name: string
  phone: string
  sip_uri: string | null
  enabled: boolean
}

const CALL_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  'vehicle-wraps-ppf': { label: 'Wraps & PPF', color: '#3b82f6' },
  'stickers-signage': { label: 'Stickers & Signage', color: '#8b5cf6' },
  'apparel': { label: 'Apparel', color: '#f59e0b' },
  'general': { label: 'General', color: '#64748b' },
}

export default function PhoneWidget() {
  const [state, setState] = useState<WidgetState>('initializing')
  const [expanded, setExpanded] = useState(false)
  const [muted, setMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callerInfo, setCallerInfo] = useState<{ from: string; name?: string; categoryKey?: string; categoryLabel?: string }>({ from: '' })
  const [dialNumber, setDialNumber] = useState('')

  // Transfer state
  const [transferState, setTransferState] = useState<TransferState>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [transferNumber, setTransferNumber] = useState('')

  // Active calls from DB (for calls answered on other devices)
  const [activeDbCalls, setActiveDbCalls] = useState<ActiveDbCall[]>([])

  const deviceRef = useRef<any>(null)
  const activeCallRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ringtoneRef = useRef<{ stop: () => void } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const loadTwilioSDK = useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).Twilio?.Device) {
        resolve((window as any).Twilio.Device)
        return
      }
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

  // Fetch team members for transfer selection
  const loadTeamMembers = useCallback(async () => {
    const { data } = await supabase
      .from('call_settings')
      .select('name, phone, sip_uri, enabled')
      .eq('enabled', true)
      .order('ring_order', { ascending: true })
    if (data) setTeamMembers(data)
  }, [])

  // Poll for active calls from DB (for calls answered on other devices)
  const pollActiveCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/voice/active')
      const { calls } = await res.json()
      setActiveDbCalls(calls || [])

      // Sync transfer state from DB
      if (calls && calls.length > 0) {
        const activeCall = calls[0]
        if (activeCall.transfer_status) {
          setTransferState(activeCall.transfer_status as TransferState)
        } else if (transferState && transferState !== 'selecting') {
          setTransferState(null)
        }
      }
    } catch (e) {
      // Silent fail
    }
  }, [transferState])

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

          const categoryKey = call.customParameters?.get?.('categoryKey') || undefined
          const categoryLabel = call.customParameters?.get?.('categoryLabel') || undefined

          if (mounted) {
            setCallerInfo({ from, name: name || undefined, categoryKey, categoryLabel })
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
              setTransferState(null)
              activeCallRef.current = null
              if (timerRef.current) clearInterval(timerRef.current)
            }
          })
        })

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

        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }
      } catch (err) {
        console.error('Phone widget init error:', err)
        if (mounted) setState('error')
      }
    }

    init()
    loadTeamMembers()

    // Poll for active calls every 3 seconds
    pollActiveCalls()
    pollRef.current = setInterval(pollActiveCalls, 3000)

    return () => {
      mounted = false
      stopRingtone()
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      device?.destroy()
    }
  }, [lookupCaller, startRingtone, stopRingtone, loadTwilioSDK, loadTeamMembers, pollActiveCalls])

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
      setTransferState(null)
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
      setState('calling')
      setExpanded(true)
      setDialNumber('')
      setCallDuration(0)

      call.on('ringing', () => { console.log('Outbound call ringing') })

      call.on('accept', () => {
        setState('active')
        setCallDuration(0)
        timerRef.current = setInterval(() => {
          setCallDuration(d => d + 1)
        }, 1000)
      })

      call.on('disconnect', () => {
        setState('ready')
        setExpanded(false)
        setCallDuration(0)
        setMuted(false)
        setTransferState(null)
        activeCallRef.current = null
        if (timerRef.current) clearInterval(timerRef.current)
      })

      call.on('error', (err: any) => {
        console.error('Outbound call error:', err)
        setState('ready')
        setExpanded(false)
        activeCallRef.current = null
        if (timerRef.current) clearInterval(timerRef.current)
      })
    } catch (err) {
      console.error('Outbound call error:', err)
    }
  }

  // Transfer functions
  const initiateTransfer = async (callSid: string, targetPhone: string, targetName?: string) => {
    try {
      setTransferState('initiating')
      const res = await fetch('/api/voice/transfer/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, targetPhone, targetName }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Transfer initiate failed:', data.error)
        setTransferState(null)
        return
      }
      // State will be updated via polling
    } catch (e) {
      console.error('Transfer initiate error:', e)
      setTransferState(null)
    }
  }

  const completeTransfer = async (callSid: string) => {
    try {
      setTransferState('completing')
      const res = await fetch('/api/voice/transfer/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Transfer complete failed:', data.error)
        return
      }
      setTransferState(null)
    } catch (e) {
      console.error('Transfer complete error:', e)
    }
  }

  const cancelTransfer = async (callSid: string) => {
    try {
      const res = await fetch('/api/voice/transfer/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Transfer cancel failed:', data.error)
        return
      }
      setTransferState(null)
    } catch (e) {
      console.error('Transfer cancel error:', e)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  // Get the active DB call (for transfer controls when call is on another device)
  const activeDbCall = activeDbCalls.length > 0 ? activeDbCalls[0] : null
  const hasDbCall = activeDbCall && state !== 'active' && state !== 'incoming' && state !== 'calling'

  const statusColor = state === 'ready' ? (hasDbCall ? '#3b82f6' : '#22c55e') :
                      state === 'incoming' ? '#f59e0b' :
                      state === 'calling' ? '#8b5cf6' :
                      state === 'active' ? '#3b82f6' :
                      state === 'error' ? '#ef4444' : '#64748b'

  // Transfer selection UI (shared between browser and DB call panels)
  const renderTransferUI = (callSid: string, answeredBy?: string | null) => {
    if (transferState === 'selecting') {
      return (
        <div style={{ padding: '16px 0 0', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
          <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Transfer to
          </p>
          {/* Team member buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {teamMembers
              .filter(m => m.name !== answeredBy) // Don't show the person already on the call
              .map((member) => (
              <button
                key={member.phone}
                onClick={() => initiateTransfer(callSid, member.phone, member.name)}
                style={{
                  padding: '10px 14px',
                  background: '#282a30',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: 700 }}>
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{member.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{formatPhone(member.phone)}</div>
                </div>
              </button>
            ))}
          </div>
          {/* Custom number */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="tel"
              value={transferNumber}
              onChange={(e) => setTransferNumber(e.target.value)}
              placeholder="Other number..."
              onKeyDown={(e) => { if (e.key === 'Enter' && transferNumber.trim()) initiateTransfer(callSid, transferNumber) }}
              style={{
                flex: 1, padding: '8px 12px', background: '#111111',
                border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '6px',
                color: '#f1f5f9', fontSize: '13px', outline: 'none'
              }}
            />
            <button
              onClick={() => transferNumber.trim() && initiateTransfer(callSid, transferNumber)}
              disabled={!transferNumber.trim()}
              style={{
                padding: '8px 12px', background: transferNumber.trim() ? '#3b82f6' : '#282a30',
                border: 'none', borderRadius: '6px',
                cursor: transferNumber.trim() ? 'pointer' : 'not-allowed',
                color: 'white', fontSize: '13px', fontWeight: 600,
              }}
            >
              Call
            </button>
          </div>
          <button
            onClick={() => setTransferState(null)}
            style={{
              width: '100%', padding: '8px', marginTop: '8px',
              background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: '6px', color: '#64748b', fontSize: '13px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )
    }

    if (transferState === 'initiating' || transferState === 'connecting') {
      const targetName = activeDbCall?.transfer_target_name || ''
      const targetPhone = activeDbCall?.transfer_target_phone || ''
      return (
        <div style={{ padding: '16px 0 0', borderTop: '1px solid rgba(148, 163, 184, 0.1)', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
            background: 'rgba(139, 92, 246, 0.15)', marginBottom: '8px',
          }}>
            <span style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: 600 }}>
              {transferState === 'initiating' ? 'Setting up transfer...' : `Calling ${targetName || formatPhone(targetPhone)}...`}
            </span>
          </div>
          <button
            onClick={() => cancelTransfer(callSid)}
            style={{
              width: '100%', padding: '8px', marginTop: '4px',
              background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px', color: '#ef4444', fontSize: '13px', cursor: 'pointer',
            }}
          >
            Cancel Transfer
          </button>
        </div>
      )
    }

    if (transferState === 'briefing') {
      const targetName = activeDbCall?.transfer_target_name || ''
      const targetPhone = activeDbCall?.transfer_target_phone || ''
      return (
        <div style={{ padding: '16px 0 0', borderTop: '1px solid rgba(148, 163, 184, 0.1)', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
            background: 'rgba(34, 197, 94, 0.15)', marginBottom: '8px',
          }}>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
              Speaking with {targetName || formatPhone(targetPhone)}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 12px' }}>
            Caller is on hold. Brief them, then complete or cancel.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => completeTransfer(callSid)}
              style={{
                flex: 1, padding: '10px', background: '#22c55e',
                border: 'none', borderRadius: '8px', color: 'white',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Complete Transfer
            </button>
            <button
              onClick={() => cancelTransfer(callSid)}
              style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px',
                color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return null
  }

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
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', animation: 'phoneRingPulse 1.5s ease-in-out infinite'
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
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 8px 0' }}>
                  {formatPhone(callerInfo.from)}
                </p>
              )}
              {callerInfo.categoryKey && CALL_CATEGORY_LABELS[callerInfo.categoryKey] ? (
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                  fontSize: '12px', fontWeight: 600, marginBottom: '16px',
                  background: `${CALL_CATEGORY_LABELS[callerInfo.categoryKey].color}20`,
                  color: CALL_CATEGORY_LABELS[callerInfo.categoryKey].color,
                  border: `1px solid ${CALL_CATEGORY_LABELS[callerInfo.categoryKey].color}30`
                }}>
                  {CALL_CATEGORY_LABELS[callerInfo.categoryKey].label}
                </span>
              ) : (
                !callerInfo.name && <div style={{ height: '16px' }} />
              )}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button onClick={declineCall} style={{
                  width: '56px', height: '56px', borderRadius: '50%', background: '#ef4444',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <button onClick={answerCall} style={{
                  width: '56px', height: '56px', borderRadius: '50%', background: '#22c55e',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Calling (outbound ringing) */}
          {state === 'calling' && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(139, 92, 246, 0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', animation: 'phoneRingPulse 1.5s ease-in-out infinite'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <p style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Calling...
              </p>
              <h3 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: '0 0 24px 0' }}>
                {callerInfo.name || formatPhone(callerInfo.from)}
              </h3>
              <button onClick={hangUp} title="Cancel call" style={{
                width: '56px', height: '56px', borderRadius: '50%', background: '#ef4444',
                border: 'none', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
              </button>
            </div>
          )}

          {/* Active call (browser-based) */}
          {state === 'active' && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
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
              {callerInfo.categoryKey && CALL_CATEGORY_LABELS[callerInfo.categoryKey] && (
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                  fontSize: '11px', fontWeight: 600, marginBottom: '4px',
                  background: `${CALL_CATEGORY_LABELS[callerInfo.categoryKey].color}20`,
                  color: CALL_CATEGORY_LABELS[callerInfo.categoryKey].color,
                  border: `1px solid ${CALL_CATEGORY_LABELS[callerInfo.categoryKey].color}30`
                }}>
                  {CALL_CATEGORY_LABELS[callerInfo.categoryKey].label}
                </span>
              )}
              <p style={{ color: '#94a3b8', fontSize: '24px', fontFamily: 'monospace', margin: '4px 0 16px 0' }}>
                {formatDuration(callDuration)}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: muted ? '#f59e0b' : '#282a30',
                  border: muted ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {muted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .54-.06 1.07-.18 1.57" />
                      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
                {/* Transfer button */}
                {!transferState && (
                  <button
                    onClick={() => { loadTeamMembers(); setTransferState('selecting') }}
                    title="Transfer"
                    style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: '#282a30', border: '1px solid rgba(148, 163, 184, 0.2)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <polyline points="15 14 20 9 15 4" />
                      <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                    </svg>
                  </button>
                )}
                <button onClick={hangUp} title="Hang up" style={{
                  width: '48px', height: '48px', borderRadius: '50%', background: '#ef4444',
                  border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                    <line x1="23" y1="1" x2="1" y2="23" />
                  </svg>
                </button>
              </div>
              {/* Transfer UI for browser-based calls */}
              {activeDbCall && renderTransferUI(activeDbCall.call_sid, activeDbCall.answered_by)}
            </div>
          )}

          {/* Active call on another device (phone/SIP) — show transfer controls */}
          {hasDbCall && activeDbCall && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Active Call
              </p>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>
                {activeDbCall.customer_name || formatPhone(activeDbCall.caller_phone || '')}
              </h3>
              {activeDbCall.customer_name && (
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 4px 0' }}>
                  {formatPhone(activeDbCall.caller_phone || '')}
                </p>
              )}
              {activeDbCall.category && CALL_CATEGORY_LABELS[activeDbCall.category] && (
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                  fontSize: '11px', fontWeight: 600, marginBottom: '4px',
                  background: `${CALL_CATEGORY_LABELS[activeDbCall.category].color}20`,
                  color: CALL_CATEGORY_LABELS[activeDbCall.category].color,
                  border: `1px solid ${CALL_CATEGORY_LABELS[activeDbCall.category].color}30`
                }}>
                  {CALL_CATEGORY_LABELS[activeDbCall.category].label}
                </span>
              )}
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 12px 0' }}>
                Answered by {activeDbCall.answered_by || 'team member'}
              </p>
              {/* Transfer button */}
              {!transferState && (
                <button
                  onClick={() => { loadTeamMembers(); setTransferState('selecting') }}
                  style={{
                    width: '100%', padding: '10px', background: '#282a30',
                    border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px',
                    color: '#f1f5f9', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                    <polyline points="15 14 20 9 15 4" />
                    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                  </svg>
                  Warm Transfer
                </button>
              )}
              {renderTransferUI(activeDbCall.call_sid, activeDbCall.answered_by)}
            </div>
          )}

          {/* Ready state - quick dial */}
          {state === 'ready' && !hasDbCall && (
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
                    flex: 1, padding: '10px 14px', background: '#111111',
                    border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px',
                    color: '#f1f5f9', fontSize: '14px', outline: 'none'
                  }}
                />
                <button
                  onClick={() => makeCall(dialNumber)}
                  disabled={!dialNumber.trim()}
                  style={{
                    padding: '10px 16px',
                    background: dialNumber.trim() ? '#22c55e' : '#282a30',
                    border: 'none', borderRadius: '8px',
                    cursor: dialNumber.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center'
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
          width: '56px', height: '56px', borderRadius: '50%',
          background: statusColor, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 20px ${statusColor}40`,
          animation: state === 'incoming' ? 'phoneRingPulse 1s ease-in-out infinite' : 'none',
          transition: 'background 0.2s ease, box-shadow 0.2s ease',
          position: 'relative',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        {/* Badge for active DB calls */}
        {hasDbCall && !expanded && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: '#ef4444', color: 'white', fontSize: '11px',
            fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}>
            {activeDbCalls.length}
          </span>
        )}
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
