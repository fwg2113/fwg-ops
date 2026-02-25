'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ActiveCall {
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
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  'vehicle-wraps-ppf': { label: 'Wraps & PPF', color: '#3b82f6' },
  'stickers-signage': { label: 'Stickers & Signage', color: '#8b5cf6' },
  'apparel': { label: 'Apparel', color: '#f59e0b' },
  'general': { label: 'General', color: '#64748b' },
}

export default function TransferPage() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState(false)
  const [customNumber, setCustomNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  const fetchData = useCallback(async () => {
    try {
      const [callsRes, teamRes] = await Promise.all([
        fetch('/api/voice/active'),
        fetch('/api/voice/team-members'),
      ])
      const { calls } = await callsRes.json()
      const { members } = await teamRes.json()
      setActiveCalls(calls || [])
      setTeamMembers(members || [])
    } catch (e) {
      console.error('Fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 2000) // Poll every 2s for responsiveness
    return () => clearInterval(interval)
  }, [fetchData])

  const activeCall = activeCalls.length > 0 ? activeCalls[0] : null

  const initiateTransfer = async (targetPhone: string, targetName?: string) => {
    if (!activeCall) return
    setTransferring(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/voice/transfer/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: activeCall.call_sid,
          targetPhone,
          targetName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Transfer failed')
        setTransferring(false)
        return
      }
      // Will update via polling
    } catch (e: any) {
      setError(e.message || 'Transfer failed')
      setTransferring(false)
    }
  }

  const completeTransfer = async () => {
    if (!activeCall) return
    try {
      const res = await fetch('/api/voice/transfer/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid: activeCall.call_sid }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess('Transfer completed!')
        setTransferring(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Failed to complete transfer')
      }
    } catch (e: any) {
      setError(e.message || 'Failed to complete transfer')
    }
  }

  const cancelTransfer = async () => {
    if (!activeCall) return
    try {
      const res = await fetch('/api/voice/transfer/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid: activeCall.call_sid }),
      })
      if (res.ok) {
        setTransferring(false)
        setSuccess(null)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to cancel transfer')
    }
  }

  const transferStatus = activeCall?.transfer_status

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      color: '#f1f5f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'rgba(215, 28, 209, 0.15)',
          textDecoration: 'none', flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d71cd1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'rgba(59, 130, 246, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <polyline points="15 14 20 9 15 4" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Call Transfer</h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Frederick Wraps</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#64748b', fontSize: '16px' }}>Loading...</p>
          </div>
        )}

        {/* No active call */}
        {!loading && !activeCall && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(148, 163, 184, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>No Active Call</h2>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0, lineHeight: '1.5' }}>
              When you&apos;re on a call, come back here to transfer it to a team member.
            </p>
          </div>
        )}

        {/* Active call with transfer controls */}
        {!loading && activeCall && (
          <>
            {/* Call info card */}
            <div style={{
              background: '#1d1d1d',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '16px',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 2px 0' }}>
                    {activeCall.customer_name || formatPhone(activeCall.caller_phone || '')}
                  </h3>
                  {activeCall.customer_name && (
                    <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 4px 0' }}>
                      {formatPhone(activeCall.caller_phone || '')}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeCall.category && CATEGORY_LABELS[activeCall.category] && (
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: `${CATEGORY_LABELS[activeCall.category].color}20`,
                        color: CATEGORY_LABELS[activeCall.category].color,
                      }}>
                        {CATEGORY_LABELS[activeCall.category].label}
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      with {activeCall.answered_by || 'team'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error / Success messages */}
            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '12px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444', fontSize: '14px',
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '12px',
                background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
                color: '#22c55e', fontSize: '14px',
              }}>
                {success}
              </div>
            )}

            {/* Transfer status */}
            {(transferStatus === 'initiating' || transferStatus === 'connecting') && (
              <div style={{
                background: '#1d1d1d', borderRadius: '16px', padding: '24px',
                border: '1px solid rgba(139, 92, 246, 0.2)', textAlign: 'center', marginBottom: '16px',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <polyline points="15 14 20 9 15 4" />
                    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                  </svg>
                </div>
                <p style={{ color: '#8b5cf6', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
                  {transferStatus === 'initiating' ? 'Setting up transfer...' : `Calling ${activeCall.transfer_target_name || formatPhone(activeCall.transfer_target_phone || '')}...`}
                </p>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
                  Caller is on hold
                </p>
                <button
                  onClick={cancelTransfer}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px',
                    background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel Transfer
                </button>
              </div>
            )}

            {/* Briefing phase */}
            {transferStatus === 'briefing' && (
              <div style={{
                background: '#1d1d1d', borderRadius: '16px', padding: '24px',
                border: '1px solid rgba(34, 197, 94, 0.2)', textAlign: 'center', marginBottom: '16px',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p style={{ color: '#22c55e', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
                  Speaking with {activeCall.transfer_target_name || formatPhone(activeCall.transfer_target_phone || '')}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.4' }}>
                  Caller is on hold. Brief them, then complete or cancel the transfer.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={completeTransfer}
                    style={{
                      flex: 1, padding: '16px', borderRadius: '12px',
                      background: '#22c55e', border: 'none',
                      color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Complete Transfer
                  </button>
                  <button
                    onClick={cancelTransfer}
                    style={{
                      flex: 1, padding: '16px', borderRadius: '12px',
                      background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Team member selection (when no transfer in progress) */}
            {!transferStatus && !transferring && (
              <>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Transfer to
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {teamMembers
                    .filter(m => m.name !== activeCall.answered_by)
                    .map((member) => (
                    <button
                      key={member.phone}
                      onClick={() => initiateTransfer(member.phone, member.name)}
                      style={{
                        padding: '16px', background: '#1d1d1d',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: '14px', color: '#f1f5f9', cursor: 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: '14px',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ color: '#3b82f6', fontSize: '17px', fontWeight: 700 }}>
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: 600 }}>{member.name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>{formatPhone(member.phone)}</div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <polyline points="15 14 20 9 15 4" />
                        <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                      </svg>
                    </button>
                  ))}
                </div>

                {/* Custom number */}
                <div style={{
                  background: '#1d1d1d', borderRadius: '14px', padding: '16px',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                }}>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0', fontWeight: 600 }}>
                    Or enter a number
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel"
                      value={customNumber}
                      onChange={(e) => setCustomNumber(e.target.value)}
                      placeholder="(555) 123-4567"
                      style={{
                        flex: 1, padding: '14px 16px', background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px',
                        color: '#f1f5f9', fontSize: '16px', outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => customNumber.trim() && initiateTransfer(customNumber)}
                      disabled={!customNumber.trim()}
                      style={{
                        padding: '14px 20px', borderRadius: '10px',
                        background: customNumber.trim() ? '#3b82f6' : '#282a30',
                        border: 'none', color: 'white', fontSize: '15px',
                        fontWeight: 600, cursor: customNumber.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Transfer
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
