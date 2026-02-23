'use client'

import { useEffect, useState } from 'react'

interface PointsToastProps {
  points: number
  names: string[]
  onDone: () => void
}

export default function PointsToast({ points, names, onDone }: PointsToastProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true))

    // Start exit after 3s
    const exitTimer = setTimeout(() => setExiting(true), 3000)
    // Remove after exit animation
    const removeTimer = setTimeout(onDone, 3500)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [onDone])

  const perPerson = names.length > 1 ? Math.floor(points / names.length) : points
  const nameStr = names.join(' & ')

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible && !exiting ? '0' : '-100px'})`,
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
        zIndex: 3000,
        pointerEvents: 'none',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #d71cd1, #a020f0)',
        borderRadius: '16px',
        padding: '14px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 8px 32px rgba(215,28,209,0.4)',
        minWidth: '200px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" fill="#fbbf24" stroke="#fbbf24" strokeWidth="0.5" />
          </svg>
          <span style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.01em',
          }}>
            +{names.length > 1 ? perPerson : points} pts
          </span>
        </div>
        <span style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.85)',
        }}>
          {nameStr}
          {names.length > 1 && ` (${points} total split)`}
        </span>
      </div>
    </div>
  )
}
