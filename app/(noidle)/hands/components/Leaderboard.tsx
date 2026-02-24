'use client'

import type { NihTeamMember, NihPrize } from '../types'
import { useState } from 'react'
import PinModal from './PinModal'

interface LeaderboardProps {
  teamMembers: NihTeamMember[]
  prizes: NihPrize[]
  onPrizesUpdate: (prizes: NihPrize[]) => void
  onPointsUpdate: (members: NihTeamMember[]) => void
}

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7f32'] // gold, silver, bronze
const RANK_LABELS = ['1st', '2nd', '3rd']

export default function Leaderboard({ teamMembers, prizes, onPrizesUpdate, onPointsUpdate }: LeaderboardProps) {
  const [showPrizes, setShowPrizes] = useState(true)
  const [editingPrizes, setEditingPrizes] = useState(false)
  const [prizeTexts, setPrizeTexts] = useState(prizes.map(p => p.prize_text))
  const [savingPrizes, setSavingPrizes] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)

  const [editingPoints, setEditingPoints] = useState(false)
  const [showPointsPinModal, setShowPointsPinModal] = useState(false)
  const [pointValues, setPointValues] = useState<Record<string, number>>({})
  const [savingPoints, setSavingPoints] = useState(false)

  // Only show members with points, sorted by total_points desc
  const ranked = teamMembers
    .filter(m => m.total_points > 0)
    .sort((a, b) => b.total_points - a.total_points)

  // All members for editing (including those with 0 points)
  const allMembers = [...teamMembers].sort((a, b) => b.total_points - a.total_points)

  const handleSavePoints = async () => {
    setSavingPoints(true)
    try {
      const members = allMembers.map(m => ({
        id: m.id,
        total_points: pointValues[m.id] ?? m.total_points,
      }))
      const res = await fetch('/api/noidle/leaderboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      })
      if (res.ok) {
        const updated = await res.json()
        onPointsUpdate(updated)
        setEditingPoints(false)
      }
    } finally {
      setSavingPoints(false)
    }
  }

  const handleSavePrizes = async () => {
    setSavingPrizes(true)
    try {
      const res = await fetch('/api/noidle/prizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizes: prizes.map((p, i) => ({ position: p.position, prize_text: prizeTexts[i] || '' })),
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onPrizesUpdate(updated)
        setEditingPrizes(false)
      }
    } finally {
      setSavingPrizes(false)
    }
  }

  const hasPrizes = prizes.some(p => p.prize_text.trim())

  return (
    <div style={{
      maxWidth: '960px',
      margin: '0 auto 8px',
      padding: '0',
      background: '#1a1a1c',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* Leaderboard header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px 8px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#d71cd1',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.8" />
          </svg>
          Leaderboard
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!editingPoints && (
            <button
              onClick={() => setShowPointsPinModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 8px',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Points
            </button>
          )}
          {(hasPrizes || prizes.length > 0) && (
            <button
              onClick={() => setShowPrizes(!showPrizes)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 8px',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 2H13V6C13 9.3 10.8 11.5 8 12C5.2 11.5 3 9.3 3 6V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8 6V9M8 9L6.5 7.5M8 9L9.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Prizes
            </button>
          )}
        </div>
      </div>

      {/* Ranked list / Edit points mode */}
      {editingPoints ? (
        <div style={{ padding: '0 12px 12px' }}>
          {allMembers.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: member.avatar_color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}>
                {member.name[0]}
              </span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                {member.name}
              </span>
              <input
                type="number"
                min={0}
                value={pointValues[member.id] ?? member.total_points}
                onChange={e => setPointValues(prev => ({ ...prev, [member.id]: Math.max(0, Number(e.target.value)) }))}
                style={{
                  width: '60px',
                  background: '#282a30',
                  border: '1px solid #3f4451',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#d71cd1',
                  fontFamily: 'inherit',
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>pts</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={() => setEditingPoints(false)}
              style={{
                background: 'none',
                border: '1px solid #3f4451',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '5px 12px',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePoints}
              disabled={savingPoints}
              style={{
                background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '5px 12px',
                fontFamily: 'inherit',
                opacity: savingPoints ? 0.6 : 1,
              }}
            >
              {savingPoints ? 'Saving...' : 'Save Points'}
            </button>
          </div>
        </div>
      ) : ranked.length > 0 ? (
        <div style={{ padding: '0 12px 12px' }}>
          {ranked.map((member, i) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 4px',
                borderBottom: i < ranked.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              {/* Rank number */}
              <span style={{
                width: '24px',
                fontSize: '13px',
                fontWeight: 700,
                color: i < 3 ? RANK_COLORS[i] : '#4b5563',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {i + 1}
              </span>

              {/* Avatar */}
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: member.avatar_color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
                border: i < 3 ? `2px solid ${RANK_COLORS[i]}` : '2px solid transparent',
              }}>
                {member.name[0]}
              </span>

              {/* Name */}
              <span style={{
                flex: 1,
                fontSize: '14px',
                fontWeight: 600,
                color: '#e2e8f0',
              }}>
                {member.name}
              </span>

              {/* Points */}
              <span style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#d71cd1',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {member.total_points}
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', marginLeft: '2px' }}>pts</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Prizes section */}
      {showPrizes && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 16px 12px',
          background: 'linear-gradient(135deg, rgba(215,28,209,0.08) 0%, rgba(139,92,246,0.06) 50%, rgba(215,28,209,0.08) 100%)',
        }}>
          <style>{`
            @keyframes prize-shimmer {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          `}</style>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'prize-shimmer 2s ease-in-out infinite' }}>
                <path d="M4 2H12V6C12 9 10.2 11 8 11.5C5.8 11 4 9 4 6V2Z" stroke="#fbbf24" strokeWidth="1.3" fill="rgba(251,191,36,0.2)" strokeLinejoin="round" />
                <path d="M4 4H2.5C2.5 4 2 6.5 4 7" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
                <path d="M12 4H13.5C13.5 4 14 6.5 12 7" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
                <path d="M6.5 14H9.5" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M8 11.5V14" stroke="#fbbf24" strokeWidth="1.3" />
              </svg>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #fbbf24, #d71cd1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Prizes
              </span>
            </div>
            {!editingPrizes ? (
              <button
                onClick={() => setShowPinModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontFamily: 'inherit',
                }}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setEditingPrizes(false)}
                  style={{
                    background: 'none',
                    border: '1px solid #3f4451',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrizes}
                  disabled={savingPrizes}
                  style={{
                    background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontFamily: 'inherit',
                    opacity: savingPrizes ? 0.6 : 1,
                  }}
                >
                  {savingPrizes ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {prizes.map((prize, i) => (
              <div
                key={prize.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, ${RANK_COLORS[i]}11 0%, transparent 100%)`,
                  border: `1px solid ${RANK_COLORS[i]}22`,
                }}
              >
                {/* Rank badge */}
                <span style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${RANK_COLORS[i]}, ${RANK_COLORS[i]}88)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#000',
                  flexShrink: 0,
                  boxShadow: `0 0 8px ${RANK_COLORS[i]}44`,
                }}>
                  {RANK_LABELS[i]}
                </span>

                {editingPrizes ? (
                  <input
                    type="text"
                    value={prizeTexts[i] || ''}
                    onChange={e => {
                      const updated = [...prizeTexts]
                      updated[i] = e.target.value
                      setPrizeTexts(updated)
                    }}
                    placeholder="Enter prize..."
                    style={{
                      flex: 1,
                      background: '#282a30',
                      border: '1px solid #3f4451',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '13px',
                      color: '#f1f5f9',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <span style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: prize.prize_text ? 600 : 400,
                    color: prize.prize_text ? '#e2e8f0' : '#4b5563',
                    fontStyle: prize.prize_text ? 'normal' : 'italic',
                  }}>
                    {prize.prize_text || 'TBD'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PIN modal for editing prizes */}
      {showPinModal && (
        <PinModal
          onSuccess={() => {
            setShowPinModal(false)
            setPrizeTexts(prizes.map(p => p.prize_text))
            setEditingPrizes(true)
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {/* PIN modal for editing points */}
      {showPointsPinModal && (
        <PinModal
          onSuccess={() => {
            setShowPointsPinModal(false)
            const vals: Record<string, number> = {}
            teamMembers.forEach(m => { vals[m.id] = m.total_points })
            setPointValues(vals)
            setEditingPoints(true)
          }}
          onClose={() => setShowPointsPinModal(false)}
        />
      )}
    </div>
  )
}
