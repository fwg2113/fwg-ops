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
    <div
      style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="What needs to get done?"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        style={{
          flex: 1,
          background: '#282a30',
          border: '1px solid #3f4451',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '16px',
          color: '#f1f5f9',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !value.trim()}
        style={{
          background: value.trim() ? '#d71cd1' : '#3f4451',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 20px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: value.trim() ? 'pointer' : 'default',
          opacity: loading ? 0.6 : 1,
          transition: 'background 0.15s',
        }}
      >
        {loading ? '...' : 'Add'}
      </button>
    </div>
  )
}
