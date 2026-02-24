'use client'

import { useState, useCallback } from 'react'

const CORRECT_PIN = '8888'

interface PinModalProps {
  onSuccess: () => void
  onClose: () => void
}

export default function PinModal({ onSuccess, onClose }: PinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  const handleDigit = useCallback((digit: string) => {
    setError(false)
    setPin(prev => {
      const next = prev + digit
      if (next.length === 4) {
        if (next === CORRECT_PIN) {
          onSuccess()
          return next
        } else {
          setError(true)
          setShaking(true)
          setTimeout(() => {
            setShaking(false)
            setPin('')
            setError(false)
          }, 600)
          return next
        }
      }
      return next
    })
  }, [onSuccess])

  const handleDelete = useCallback(() => {
    setError(false)
    setPin(prev => prev.slice(0, -1))
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1500,
        padding: '20px',
      }}
    >
      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1a1c',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '28px 24px',
          width: '100%',
          maxWidth: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        {/* Lock icon */}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: '#d71cd1' }}>
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 11V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
        </svg>

        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#94a3b8',
          letterSpacing: '0.02em',
        }}>
          Enter PIN to continue
        </span>

        {/* PIN dots */}
        <div
          style={{
            display: 'flex',
            gap: '14px',
            animation: shaking ? 'pin-shake 0.4s ease-in-out' : 'none',
          }}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '999px',
                background: pin.length > i
                  ? error ? '#ef4444' : '#d71cd1'
                  : 'transparent',
                border: `2px solid ${
                  pin.length > i
                    ? error ? '#ef4444' : '#d71cd1'
                    : '#3f4451'
                }`,
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </div>

        {error && (
          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500, marginTop: '-12px' }}>
            Incorrect PIN
          </span>
        )}

        {/* Number pad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          width: '100%',
          maxWidth: '240px',
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              style={{
                height: '52px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#e2e8f0',
                fontSize: '22px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseDown={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseUp={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: empty, 0, delete */}
          <div />
          <button
            onClick={() => handleDigit('0')}
            style={{
              height: '52px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#e2e8f0',
              fontSize: '22px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseUp={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            0
          </button>
          <button
            onClick={handleDelete}
            style={{
              height: '52px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H9L3 12L9 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M14 9L10 15M10 9L14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Cancel link */}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#4b5563',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '4px 12px',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
