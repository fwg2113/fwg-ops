'use client'

import { useState, useRef } from 'react'
import type { NihTask } from '../types'

interface CompleteModalProps {
  task: NihTask
  onComplete: (notes: string, photoUrl: string | null) => Promise<void>
  onClose: () => void
}

export default function CompleteModal({ task, onComplete, onClose }: CompleteModalProps) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to R2
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setPhotoUrl(data.url)
    } catch {
      setUploadError('Failed to upload photo. Try again.')
      setPhotoPreview(null)
      setPhotoUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoUrl(null)
    setPhotoPreview(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (saving || uploading) return
    setSaving(true)
    await onComplete(notes.trim(), photoUrl)
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

        <div style={{ marginBottom: '16px' }}>
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

        {/* Photo upload */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#94a3b8',
              marginBottom: '8px',
              display: 'block',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Photo proof (optional)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {photoPreview ? (
            <div style={{ position: 'relative' }}>
              <img
                src={photoPreview}
                alt="Completion photo"
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid #3f4451',
                }}
              />
              {uploading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  Uploading...
                </div>
              )}
              {!uploading && (
                <button
                  onClick={handleRemovePhoto}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '999px',
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  title="Remove photo"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '16px',
                background: '#282a30',
                border: '1px dashed #3f4451',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                color: '#94a3b8',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M1 12L5 8L8 11L11 8L15 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '13px' }}>Tap to add a photo</span>
            </button>
          )}

          {uploadError && (
            <p style={{ fontSize: '12px', color: '#ef4444', margin: '6px 0 0' }}>
              {uploadError}
            </p>
          )}
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
            disabled={saving || uploading}
            style={{
              background: '#22c55e',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              opacity: saving || uploading ? 0.6 : 1,
            }}
          >
            {saving ? 'Completing...' : uploading ? 'Uploading...' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}
