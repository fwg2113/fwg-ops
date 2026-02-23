'use client'

import type { NihTeamMember, NihPrize } from '../types'
import { useState } from 'react'

interface LeaderboardProps {
  teamMembers: NihTeamMember[]
  prizes: NihPrize[]
  onPrizesUpdate: (prizes: NihPrize[]) => void
}

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7f32'] // gold, silver, bronze
const RANK_LABELS = ['1st', '2nd', '3rd']

export default function Leaderboard({ teamMembers, prizes, onPrizesUpdate }: LeaderboardProps) {
  const [showPrizes, setShowPrizes] = useState(true)
  const [editingPrizes, setEditingPrizes] = useState(false)
  const [prizeTexts, setPrizeTexts] = useState(prizes.map(p => p.prize_text))
  const [savingPrizes, setSavingPrizes] = useState(false)

  // Only show members with points, sorted by total_points desc
  const ranked = teamMembers
    .filter(m => m.total_points > 0)
    .sort((a, b) => b.total_points - a.total_points)

  if (ranked.length === 0) return null

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
      margin: '0 16px 8px',
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

      {/* Ranked list */}
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

      {/* Prizes section */}
      {showPrizes && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 16px',
          background: 'rgba(215,28,209,0.04)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#d71cd1',
            }}>
              Prizes
            </span>
            {!editingPrizes ? (
              <button
                onClick={() => {
                  setPrizeTexts(prizes.map(p => p.prize_text))
                  setEditingPrizes(true)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '4px 8px',
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
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrizes}
                  disabled={savingPrizes}
                  style={{
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 10px',
                    fontFamily: 'inherit',
                    opacity: savingPrizes ? 0.6 : 1,
                  }}
                >
                  {savingPrizes ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {prizes.map((prize, i) => (
            <div
              key={prize.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
              }}
            >
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: RANK_COLORS[i] || '#4b5563',
                width: '30px',
                flexShrink: 0,
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
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: '#f1f5f9',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <span style={{
                  flex: 1,
                  fontSize: '14px',
                  color: prize.prize_text ? '#e2e8f0' : '#4b5563',
                  fontStyle: prize.prize_text ? 'normal' : 'italic',
                }}>
                  {prize.prize_text || 'No prize set'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
