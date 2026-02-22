'use client'

import { useState } from 'react'
import type { NihTask } from '../types'

interface CompleteModalProps {
  task: NihTask
  onComplete: (notes: string) => Promise<void>
  onClose: () => void
}

export default function CompleteModal({ task, onComplete, onClose }: CompleteModalProps) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (saving) return
    setSaving(true)
    await onComplete(notes.trim())
    setSaving(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1d1d1d',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              background: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8L7 12L13 4"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
            Complete Task
          </h2>
        </div>

        <p style={{ fontSize: '14px', color: '#e2e8f0', margin: '0 0 16px' }}>
          {task.title}
        </p>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#94a3b8',
              marginBottom: '4px',
              display: 'block',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How'd it go? Anything to note?"
            rows={3}
            style={{
              width: '100%',
              background: '#282a30',
              border: '1px solid #3f4451',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '14px',
              color: '#f1f5f9',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #3f4451',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '14px',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              background: '#22c55e',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Completing...' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}
