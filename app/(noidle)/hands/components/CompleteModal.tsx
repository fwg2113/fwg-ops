'use client'

import { useState, useRef } from 'react'
import type { NihTask, NihTeamMember } from '../types'

interface CompleteModalProps {
  task: NihTask
  teamMembers: NihTeamMember[]
  skipPoints?: boolean
  onComplete: (notes: string, photoUrl: string | null, completedByIds: string[]) => Promise<void>
  onClose: () => void
}

export default function CompleteModal({ task, teamMembers, skipPoints, onComplete, onClose }: CompleteModalProps) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [completedByIds, setCompletedByIds] = useState<string[]>(
    // Pre-select assigned team members
    task.nih_task_assignees?.map(a => a.team_member_id || a.nih_team_members?.id).filter(Boolean) as string[] || []
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleMember = (id: string) => {
    setCompletedByIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

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
    await onComplete(notes.trim(), photoUrl, completedByIds)
    setSaving(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1d1d1d',
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Pull indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#3f4451' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              background: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
              {skipPoints ? 'All Sub-Tasks Done!' : task.parent_id ? 'Sub-Task Complete' : 'Job Complete'}
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
            {task.points > 0 && !skipPoints && (
              <p style={{ fontSize: '12px', color: '#d71cd1', margin: '2px 0 0', fontWeight: 600 }}>
                {task.points} pts
              </p>
            )}
          </div>
        </div>

        {/* Camera / Photo — primary action */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {photoPreview ? (
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <img
              src={photoPreview}
              alt="Completion photo"
              style={{
                width: '100%',
                maxHeight: '220px',
                objectFit: 'cover',
                borderRadius: '12px',
                border: '1px solid #3f4451',
              }}
            />
            {uploading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '14px',
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
                  width: '28px',
                  height: '28px',
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
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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
              padding: '24px',
              background: 'rgba(34,211,238,0.06)',
              border: '2px dashed rgba(34,211,238,0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: '#22d3ee',
              marginBottom: '16px',
              minHeight: '48px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 6L9 3H15L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>Take Photo</span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Snap a photo of the completed work</span>
          </button>
        )}

        {uploadError && (
          <p style={{ fontSize: '12px', color: '#ef4444', margin: '-8px 0 12px' }}>
            {uploadError}
          </p>
        )}

        {/* Who completed — team member pills (hidden for auto-complete parent) */}
        {!skipPoints && (
          <div style={{ marginBottom: '16px' }}>
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
              Who completed this?
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {teamMembers.map(m => {
                const selected = completedByIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '999px',
                      border: `2px solid ${selected ? m.avatar_color : '#3f4451'}`,
                      background: selected ? m.avatar_color + '22' : 'transparent',
                      color: selected ? m.avatar_color : '#94a3b8',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '999px',
                        background: m.avatar_color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      {m.name[0]}
                    </span>
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {skipPoints && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
            All sub-tasks are complete. Points have already been awarded. Add an optional photo of the finished project.
          </p>
        )}

        {/* Notes */}
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
              padding: '12px',
              fontSize: '16px',
              color: '#f1f5f9',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'none',
              border: '1px solid #3f4451',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '15px',
              color: '#94a3b8',
              cursor: 'pointer',
              minHeight: '48px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            style={{
              flex: 2,
              background: '#22c55e',
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              opacity: saving || uploading ? 0.6 : 1,
              minHeight: '48px',
            }}
          >
            {saving ? 'Completing...' : uploading ? 'Uploading...' : skipPoints ? 'Complete Project' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}
