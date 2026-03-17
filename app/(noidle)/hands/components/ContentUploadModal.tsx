'use client'

import { useState, useRef } from 'react'
import type { NihTeamMember } from '../types'

interface Props {
  teamMembers: NihTeamMember[]
  onClose: () => void
  onSuccess: (memberId: string, newTotalPoints: number) => void
}

interface FilePreview {
  file: File
  type: 'photo' | 'video'
  previewUrl: string
  points: number
}

export default function ContentUploadModal({ teamMembers, onClose, onSuccess }: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState<{ count: number; points: number; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected) return

    const newFiles: FilePreview[] = []
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i]
      const isVideo = file.type.startsWith('video/')
      newFiles.push({
        file,
        type: isVideo ? 'video' : 'photo',
        previewUrl: URL.createObjectURL(file),
        points: isVideo ? 3 : 1,
      })
    }
    setFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const removed = prev[index]
      URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const photoCount = files.filter(f => f.type === 'photo').length
  const videoCount = files.filter(f => f.type === 'video').length
  const totalPoints = files.reduce((sum, f) => sum + f.points, 0)

  const handleUpload = async () => {
    if (!selectedMemberId || files.length === 0 || uploading) return

    setUploading(true)
    setError(null)
    setUploadProgress({ current: 0, total: files.length })

    let lastTotalPoints = 0
    let memberName = ''

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length })

        const formData = new FormData()
        formData.append('teamMemberId', selectedMemberId)
        formData.append('file', files[i].file)

        const res = await fetch('/api/noidle/content-upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Upload failed for file ${i + 1}`)
        }

        const data = await res.json()
        lastTotalPoints = data.newTotalPoints
        memberName = data.memberName
      }

      // Clean up preview URLs
      files.forEach(f => URL.revokeObjectURL(f.previewUrl))

      setResult({ count: files.length, points: totalPoints, name: memberName })
      onSuccess(selectedMemberId, lastTotalPoints)

      // Auto-close after 2 seconds
      setTimeout(() => onClose(), 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
    } finally {
      setUploading(false)
    }
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
      onClick={e => e.target === e.currentTarget && !uploading && onClose()}
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

        {result ? (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(215,28,209,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d71cd1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
              {result.count} file{result.count !== 1 ? 's' : ''} uploaded!
            </h2>
            <p style={{ fontSize: 16, color: '#d71cd1', fontWeight: 600, margin: 0 }}>
              +{result.points} points for {result.name}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '999px',
                  background: 'rgba(215,28,209,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '36px',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d71cd1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="14" rx="3" />
                    <circle cx="12" cy="13" r="4" />
                    <path d="M8 6L9 3H15L16 6" />
                  </svg>
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
                  Add Content
                </h2>
              </div>
              <button
                onClick={onClose}
                disabled={uploading}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#282a30', border: 'none',
                  color: '#94a3b8', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Team member selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                fontSize: '12px', fontWeight: 500, color: '#94a3b8',
                marginBottom: '8px', display: 'block',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Who is uploading?
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {teamMembers.map(m => {
                  const selected = selectedMemberId === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMemberId(selected ? '' : m.id)}
                      disabled={uploading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '999px',
                        border: `2px solid ${selected ? m.avatar_color : '#3f4451'}`,
                        background: selected ? m.avatar_color + '22' : 'transparent',
                        color: selected ? m.avatar_color : '#94a3b8',
                        fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                        minHeight: '44px', opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '999px',
                        background: m.avatar_color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color: '#fff',
                      }}>
                        {m.name[0]}
                      </span>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* File picker */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: '24px',
                background: 'rgba(215,28,209,0.06)',
                border: '2px dashed rgba(215,28,209,0.3)',
                borderRadius: '12px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '8px',
                color: '#d71cd1', marginBottom: '16px',
                minHeight: '48px', opacity: uploading ? 0.5 : 1,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>
                {files.length > 0 ? 'Add More Files' : 'Select Photos & Videos'}
              </span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Photos = 1 pt each &middot; Videos = 3 pts each
              </span>
            </button>

            {/* Preview grid */}
            {files.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 8,
                }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#282a30' }}>
                      {f.type === 'photo' ? (
                        <img
                          src={f.previewUrl}
                          alt={f.file.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d71cd1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                            {f.file.name}
                          </span>
                        </div>
                      )}
                      {/* Points badge */}
                      <span style={{
                        position: 'absolute', bottom: 4, left: 4,
                        background: f.type === 'video' ? '#d71cd1' : '#22c55e',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 999,
                      }}>
                        {f.points}pt
                      </span>
                      {/* Remove button */}
                      {!uploading && (
                        <button
                          onClick={() => removeFile(i)}
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.7)', border: 'none',
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary line */}
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
                  {photoCount > 0 && `${photoCount} photo${photoCount !== 1 ? 's' : ''}`}
                  {photoCount > 0 && videoCount > 0 && ', '}
                  {videoCount > 0 && `${videoCount} video${videoCount !== 1 ? 's' : ''}`}
                  {' = '}
                  <span style={{ color: '#d71cd1', fontWeight: 600 }}>{totalPoints} points</span>
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 12px' }}>{error}</p>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!selectedMemberId || files.length === 0 || uploading}
              style={{
                width: '100%',
                padding: '14px',
                background: (!selectedMemberId || files.length === 0) ? '#3f4451' : '#d71cd1',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#fff',
                cursor: (!selectedMemberId || files.length === 0 || uploading) ? 'default' : 'pointer',
                opacity: uploading ? 0.7 : 1,
                minHeight: '48px',
              }}
            >
              {uploading
                ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`
                : files.length === 0
                  ? 'Select files to upload'
                  : !selectedMemberId
                    ? 'Select who is uploading'
                    : `Upload ${files.length} file${files.length !== 1 ? 's' : ''} (+${totalPoints} pts)`
              }
            </button>
          </>
        )}
      </div>
    </div>
  )
}
