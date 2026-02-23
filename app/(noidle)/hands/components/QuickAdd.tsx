'use client'

import { useState, useRef } from 'react'

interface QuickAddProps {
  onAdd: (title: string) => Promise<void>
}

export default function QuickAdd({ onAdd }: QuickAddProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    const title = value.trim()
    if (!title || loading) return
    setLoading(true)
    await onAdd(title)
    setValue('')
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="What needs to get done?"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        style={{
          flex: 1,
          background: '#1a1a1c',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '14px 16px',
          fontSize: '16px',
          color: '#f1f5f9',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !value.trim()}
        style={{
          background: '#d71cd1',
          border: 'none',
          borderRadius: '12px',
          padding: '14px 22px',
          fontSize: '15px',
          fontWeight: 600,
          color: '#fff',
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '...' : 'Add'}
      </button>
    </div>
  )
}
