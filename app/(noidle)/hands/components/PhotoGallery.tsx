'use client'

import { useState } from 'react'
import type { NihTaskCompletion } from '../types'

interface PhotoGalleryProps {
  completions: NihTaskCompletion[]
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export default function PhotoGallery({ completions, onDelete, onClose }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const photosOnly = completions.filter(c => c.completion_photo_url)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this photo from the gallery? This cannot be undone.')) return
    setDeleting(id)
    await onDelete(id)
    // If we were viewing this photo in lightbox, close it
    if (lightboxIndex !== null) {
      const currentPhoto = photosOnly[lightboxIndex]
      if (currentPhoto?.id === id) {
        setLightboxIndex(null)
      }
    }
    setDeleting(null)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  // Filter out deleted items for lightbox navigation
  const currentPhotos = photosOnly.filter(c => c.id !== deleting)

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
          WebkitOverflowScrolling: 'touch' as const,
        }}
      >
        {/* Pull indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#3f4451' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                background: 'rgba(215,28,209,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '36px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="14" rx="3" stroke="#d71cd1" strokeWidth="1.5" />
                <circle cx="12" cy="13" r="4" stroke="#d71cd1" strokeWidth="1.5" />
                <path d="M8 6L9 3H15L16 6" stroke="#d71cd1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
                Photo Gallery
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                {currentPhotos.length} photo{currentPhotos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {currentPhotos.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#6b7280',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
              <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 6L9 3H15L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px' }}>No photos yet</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Photos will appear here when tasks are completed</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
          }}>
            {currentPhotos.map((completion, idx) => (
              <div
                key={completion.id}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: '#1a1a1c',
                }}
              >
                <img
                  src={completion.completion_photo_url!}
                  alt={completion.task_title}
                  onClick={() => setLightboxIndex(idx)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                />
                {/* Overlay info */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  padding: '24px 8px 8px',
                }}>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#f1f5f9',
                    margin: 0,
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {completion.task_title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {formatDate(completion.completed_at)}
                    </span>
                    {completion.completed_by_names && (
                      <>
                        <span style={{ fontSize: '11px', color: '#3f4451' }}>·</span>
                        <span style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {completion.completed_by_names}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(completion.id)
                  }}
                  disabled={deleting === completion.id}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    opacity: deleting === completion.id ? 0.4 : 1,
                  }}
                  title="Delete photo"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4.5 4L5 13C5 13.55 5.45 14 6 14H10C10.55 14 11 13.55 11 13L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && currentPhotos[lightboxIndex] && (
        <div
          onClick={() => setLightboxIndex(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
            cursor: 'pointer',
          }}
        >
          {/* Top bar with info and delete */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(rgba(0,0,0,0.7), transparent)',
              cursor: 'default',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                {currentPhotos[lightboxIndex].task_title}
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {formatDate(currentPhotos[lightboxIndex].completed_at)} at {formatTime(currentPhotos[lightboxIndex].completed_at)}
                </span>
                {currentPhotos[lightboxIndex].completed_by_names && (
                  <>
                    <span style={{ color: '#3f4451' }}>·</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      {currentPhotos[lightboxIndex].completed_by_names}
                    </span>
                  </>
                )}
              </div>
              {currentPhotos[lightboxIndex].completion_notes && (
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0', lineHeight: '1.4' }}>
                  {currentPhotos[lightboxIndex].completion_notes}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
              <button
                onClick={() => handleDelete(currentPhotos[lightboxIndex!].id)}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4.5 4L5 13C5 13.55 5.45 14 6 14H10C10.55 14 11 13.55 11 13L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete
              </button>
              <button
                onClick={() => setLightboxIndex(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#f1f5f9',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation arrows */}
          {lightboxIndex > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1) }}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#f1f5f9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {lightboxIndex < currentPhotos.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1) }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#f1f5f9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <img
            src={currentPhotos[lightboxIndex].completion_photo_url!}
            alt={currentPhotos[lightboxIndex].task_title}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 140px)',
              objectFit: 'contain',
              borderRadius: '8px',
              cursor: 'default',
            }}
          />

          {/* Photo counter */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            fontSize: '13px',
            color: '#6b7280',
            background: 'rgba(0,0,0,0.5)',
            padding: '4px 12px',
            borderRadius: '999px',
          }}>
            {lightboxIndex + 1} / {currentPhotos.length}
          </div>
        </div>
      )}
    </div>
  )
}
