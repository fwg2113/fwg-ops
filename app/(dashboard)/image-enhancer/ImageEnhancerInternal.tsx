'use client'

import { useState, useRef, useCallback } from 'react'
import { analyzeImage, type ImageAnalysis } from './utils/analyzeImage'
import { trimTransparency } from './utils/trimTransparency'
import { pdfToImage } from '@/app/lib/pdfToImage'
import { ImagePrepModal } from '@/app/components/shared/image-tools/ImagePrepModal'
import type { UploadedImage } from '@/app/components/shared/image-tools/types'
import { GradeBadge } from '@/app/components/shared/image-tools/GradeBadge'
import ModalBackdrop from '../../components/ModalBackdrop'

const API_BASE = '/api/image-enhancer'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED_TYPES = '.png,.jpg,.jpeg,.svg,.pdf,.ai,.eps'

// ── Helpers ──

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function measureDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

function triggerDownload(data: string, filename: string) {
  const doDownload = async () => {
    let blob: Blob
    if (data.startsWith('data:')) {
      blob = await (await fetch(data)).blob()
    } else if (data.startsWith('blob:')) {
      blob = await (await fetch(data)).blob()
    } else {
      blob = new Blob([data], { type: 'image/svg+xml' })
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  doDownload()
}

let nextId = 1
function genId() { return `upload_${Date.now()}_${nextId++}` }

// ── Shared UI ──

const Spinner = ({ size = 28 }: { size?: number }) => (
  <div style={{
    width: size, height: size,
    border: '3px solid rgba(34,211,238,0.2)',
    borderTop: '3px solid #22d3ee',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }} />
)

// ── Main Component ──

export default function ImageEnhancerInternal() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stage: 'upload' → 'prep' → 'result'
  const [stage, setStage] = useState<'upload' | 'prep' | 'result'>('upload')
  const [image, setImage] = useState<UploadedImage | null>(null)
  const [fileUrl, setFileUrl] = useState('') // R2 URL from presign upload
  const [uploading, setUploading] = useState(false)

  // AI processing state for ImagePrepModal
  const [aiState, setAiState] = useState<Record<string, { removingBg?: boolean; upscaling?: boolean; vectorizing?: boolean }>>({})

  // Save to Document
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docSearchResults, setDocSearchResults] = useState<Array<{ id: string; doc_number: number; doc_type: string; status: string; customer_name: string; company_name: string; created_at: string }>>([])
  const [docSearching, setDocSearching] = useState(false)
  const [savingToDoc, setSavingToDoc] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<{ docNumber: number; docType: string; docId: string } | null>(null)
  const [saveError, setSaveError] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ── File Upload ──

  const handleFile = useCallback(async (f: File) => {
    if (f.size > MAX_FILE_SIZE) { alert('File exceeds 20MB limit.'); return }

    // Convert PDF to PNG before processing
    const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
    if (isPdf) {
      try {
        const result = await pdfToImage(f)
        f = result.file
      } catch (err) {
        console.error('PDF conversion failed:', err)
        alert('Failed to convert PDF. Please try a different file.')
        return
      }
    }

    setUploading(true)

    try {
      // Read image dimensions
      const b64 = await blobToBase64(f)
      const dims = await measureDataUrl(b64)

      // Upload to R2 via presign
      const formData = new FormData()
      formData.append('file', f)
      const uploadRes = await fetch('/api/image-enhancer/presign', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Failed to upload file')
      const { fileUrl: url } = await uploadRes.json()
      setFileUrl(url)

      // Run local analysis
      const analysis = await analyzeImage({
        fileName: f.name,
        fileType: f.type,
        objectUrl: b64,
        nativeWidth: dims.width,
        nativeHeight: dims.height,
      })

      // Create UploadedImage
      const isSvg = f.type === 'image/svg+xml' || f.name.toLowerCase().endsWith('.svg')
      const uploaded: UploadedImage = {
        id: genId(),
        fileName: f.name,
        originalFile: f,
        objectUrl: b64,
        nativeWidth: dims.width,
        nativeHeight: dims.height,
        aspectRatio: dims.height > 0 ? dims.width / dims.height : 1,
        isRaster: !isSvg,
        analysis,
      }

      setImage(uploaded)
      setStage('prep')
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Failed to upload file. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
  }, [])

  // ── Reanalyze helper ──
  const reanalyze = useCallback(async (img: UploadedImage): Promise<UploadedImage> => {
    try {
      const analysis = await analyzeImage({
        fileName: img.fileName,
        fileType: img.originalFile.type,
        objectUrl: img.objectUrl,
        nativeWidth: img.nativeWidth,
        nativeHeight: img.nativeHeight,
      })
      return { ...img, analysis }
    } catch {
      return img
    }
  }, [])

  // ── AI Tool Handlers (proxy through FWG API) ──

  const handleRemoveBg = useCallback(async (imageId: string): Promise<boolean> => {
    if (!image || image.id !== imageId) return false
    setAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], removingBg: true } }))
    try {
      const res = await fetch(`${API_BASE}/remove-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: fileUrl || image.objectUrl }),
      })
      if (!res.ok) return false
      const data = await res.json() as { imageBase64?: string }
      if (!data.imageBase64) return false
      const trimmed = await trimTransparency(data.imageBase64, 'image/png')
      const updated: UploadedImage = {
        ...image,
        objectUrl: trimmed.url,
        nativeWidth: trimmed.width,
        nativeHeight: trimmed.height,
        aspectRatio: trimmed.height > 0 ? trimmed.width / trimmed.height : 1,
      }
      const final = await reanalyze(updated)
      setImage(final)
      return true
    } catch {
      return false
    } finally {
      setAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], removingBg: false } }))
    }
  }, [image, fileUrl, reanalyze])

  const handleUpscale = useCallback(async (imageId: string): Promise<boolean> => {
    if (!image || image.id !== imageId) return false
    setAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], upscaling: true } }))
    try {
      const base64 = image.objectUrl.startsWith('data:') ? image.objectUrl : await blobToBase64(await (await fetch(image.objectUrl)).blob())
      const res = await fetch(`${API_BASE}/upscale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      if (!res.ok) return false
      const data = await res.json() as { imageBase64?: string }
      if (!data.imageBase64) return false
      const dims = await measureDataUrl(data.imageBase64)
      const updated: UploadedImage = {
        ...image,
        objectUrl: data.imageBase64,
        nativeWidth: dims.width,
        nativeHeight: dims.height,
        aspectRatio: dims.height > 0 ? dims.width / dims.height : 1,
      }
      const final = await reanalyze(updated)
      setImage(final)
      return true
    } catch {
      return false
    } finally {
      setAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], upscaling: false } }))
    }
  }, [image, reanalyze])

  const handleVectorize = useCallback(async (imageId: string): Promise<boolean> => {
    if (!image || image.id !== imageId) return false
    setAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], vectorizing: true } }))
    try {
      const base64 = image.objectUrl.startsWith('data:') ? image.objectUrl : await blobToBase64(await (await fetch(image.objectUrl)).blob())
      const res = await fetch(`${API_BASE}/vectorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      if (!res.ok) return false
      const data = await res.json() as { svg?: string }
      if (!data.svg) return false
      const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data.svg)))}`
      const updated: UploadedImage = { ...image, objectUrl: svgDataUrl }
      const final = await reanalyze(updated)
      setImage(final)
      return true
    } catch {
      return false
    } finally {
      setAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], vectorizing: false } }))
    }
  }, [image, reanalyze])

  const handleCleanEdges = useCallback(async (imageId: string, threshold: number = 50): Promise<boolean> => {
    if (!image || image.id !== imageId) return false
    try {
      const { applyAlphaThreshold } = await import('./utils/cleanEdges')
      const result = await applyAlphaThreshold(image.objectUrl, image.nativeWidth, image.nativeHeight, threshold)
      const updated: UploadedImage = {
        ...image,
        objectUrl: result.url,
        nativeWidth: result.width,
        nativeHeight: result.height,
        aspectRatio: result.height > 0 ? result.width / result.height : 1,
      }
      const final = await reanalyze(updated)
      setImage(final)
      return true
    } catch {
      return false
    }
  }, [image, reanalyze])

  const handleSmoothEdges = useCallback(async (imageId: string, contractionRadius: number, smoothingRadius: number): Promise<boolean> => {
    if (!image || image.id !== imageId) return false
    try {
      const { applyEdgeSmoothing } = await import('./utils/edgeSmoothing')
      const result = await applyEdgeSmoothing(image.objectUrl, image.nativeWidth, image.nativeHeight, contractionRadius, smoothingRadius)
      const updated: UploadedImage = {
        ...image,
        objectUrl: result.url,
        nativeWidth: result.width,
        nativeHeight: result.height,
        aspectRatio: result.height > 0 ? result.width / result.height : 1,
      }
      const final = await reanalyze(updated)
      setImage(final)
      return true
    } catch {
      return false
    }
  }, [image, reanalyze])

  // ── Local edits from ImagePrepModal (color replace, crop) ──
  const handleApplyLocalEdit = useCallback(async (imageId: string, newDataUrl: string, width: number, height: number) => {
    if (!image || image.id !== imageId) return
    const updated: UploadedImage = {
      ...image,
      objectUrl: newDataUrl,
      nativeWidth: width,
      nativeHeight: height,
      aspectRatio: height > 0 ? width / height : 1,
    }
    const final = await reanalyze(updated)
    setImage(final)
  }, [image, reanalyze])

  // ── Stage transitions ──
  const handlePrepComplete = useCallback(() => setStage('result'), [])
  const handleEditAgain = useCallback(() => setStage('prep'), [])

  const handleStartOver = useCallback(() => {
    if (image) URL.revokeObjectURL(image.objectUrl)
    setImage(null)
    setFileUrl('')
    setStage('upload')
    setAiState({})
    setSaveSuccess(null)
  }, [image])

  // ── Downloads ──
  const baseName = image?.fileName.replace(/\.[^.]+$/, '') ?? 'artwork'
  const isSvg = image?.objectUrl.startsWith('data:image/svg+xml')

  // ── Save to Document ──
  const searchDocuments = (query: string) => {
    setDocSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (query.trim().length < 2) { setDocSearchResults([]); return }
    searchTimeoutRef.current = setTimeout(async () => {
      setDocSearching(true)
      try {
        const res = await fetch(`/api/documents/search?q=${encodeURIComponent(query.trim())}`)
        const json = await res.json()
        setDocSearchResults(json.results || [])
      } catch { setDocSearchResults([]) }
      finally { setDocSearching(false) }
    }, 300)
  }

  const saveToDocument = async (docId: string) => {
    if (!image) return
    setSavingToDoc(docId); setSaveError('')
    try {
      const formData = new FormData()
      formData.append('documentId', docId)

      const src = image.objectUrl
      const isSvgData = src.startsWith('data:image/svg+xml')
      const filename = `${baseName}-enhanced.${isSvgData ? 'svg' : 'png'}`
      const contentType = isSvgData ? 'image/svg+xml' : 'image/png'

      formData.append('filename', filename)
      formData.append('contentType', contentType)

      if (src.startsWith('data:')) {
        const blob = await (await fetch(src)).blob()
        formData.append('file', blob, filename)
      } else {
        formData.append('imageData', src)
      }

      const res = await fetch('/api/image-enhancer/save-to-document', { method: 'POST', body: formData })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Save failed') }
      const json = await res.json()
      setSaveSuccess({ docNumber: json.docNumber, docType: json.docType, docId })
      setShowSaveModal(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingToDoc(null)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: '100vh', background: '#111111', padding: '32px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700, margin: 0 }}>
            <span style={{ background: 'linear-gradient(90deg, #22d3ee, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Image Enhancer
            </span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '6px 0 0' }}>
            Analyze, enhance, clean edges, remove backgrounds, vectorize, and recolor artwork
          </p>
        </div>

        {/* Upload Stage */}
        {stage === 'upload' && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px', justifyContent: 'center' }}>
                <Spinner size={22} />
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Uploading and analyzing...</span>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(34,211,238,0.3)', borderRadius: '10px',
                  padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.2s', background: 'rgba(34,211,238,0.02)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#22d3ee')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" style={{ width: 40, height: 40, margin: '0 auto 12px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Drag & drop your file here</div>
                <div style={{ color: '#6b7280', fontSize: '13px' }}>or click to browse — PNG, JPG, SVG, PDF, AI, EPS (max 20MB)</div>
              </div>
            )}
            <input
              ref={fileInputRef} type="file" accept={ACCEPTED_TYPES}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Prep Stage — ImagePrepModal */}
        {stage === 'prep' && image && (
          <ImagePrepModal
            images={[image]}
            onRemoveBg={handleRemoveBg}
            onUpscale={handleUpscale}
            onVectorize={handleVectorize}
            onCleanEdges={handleCleanEdges}
            onSmoothEdges={handleSmoothEdges}
            onComplete={handlePrepComplete}
            onApplyLocalEdit={handleApplyLocalEdit}
            aiProcessingState={aiState}
          />
        )}

        {/* Result Stage — Download + Save to Document */}
        {stage === 'result' && image && (
          <div>
            {/* File info bar */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}>
              <div style={{
                backgroundColor: '#e8e8e8',
                backgroundImage: 'linear-gradient(45deg, #d0d0d0 25%, transparent 25%), linear-gradient(-45deg, #d0d0d0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d0d0d0 75%), linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                borderRadius: '8px',
                padding: '4px',
                flexShrink: 0,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl ?? image.objectUrl} alt="Preview" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: '4px', display: 'block' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{image.fileName}</span>
                  {image.analysis && <GradeBadge grade={image.analysis.grade} label={image.analysis.gradeLabel} />}
                </div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                  {image.nativeWidth} &times; {image.nativeHeight}px
                </div>
              </div>
              <button onClick={handleStartOver} style={{
                padding: '8px 16px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                color: '#94a3b8', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}>
                Reset
              </button>
            </div>

            {/* Download + actions */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Download Enhanced Artwork</h3>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => triggerDownload(image.previewUrl ?? image.objectUrl, `${baseName}-enhanced.png`)}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                    border: 'none', borderRadius: '8px',
                    color: '#111111', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <DownloadIcon /> Download PNG
                </button>
                {isSvg && (
                  <button
                    onClick={() => triggerDownload(image.objectUrl, `${baseName}-vector.svg`)}
                    style={{
                      padding: '10px 20px', background: 'transparent',
                      border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px',
                      color: '#22d3ee', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <DownloadIcon /> Download SVG
                  </button>
                )}
              </div>

              {/* Edit Again */}
              <div style={{ marginTop: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={handleEditAgain}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                >
                  Edit Again
                </button>
              </div>

              {/* Save to Document */}
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                {saveSuccess ? (
                  <div style={{
                    padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>
                      Saved to {saveSuccess.docType === 'invoice' ? 'Invoice' : 'Quote'} #{saveSuccess.docNumber}
                    </span>
                    <a href={`/documents/${saveSuccess.docId}`} style={{ color: '#22d3ee', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                      Open Document
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowSaveModal(true); setSaveSuccess(null); setSaveError(''); setDocSearchQuery(''); setDocSearchResults([]) }}
                    style={{
                      padding: '10px 20px', background: 'transparent',
                      border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px',
                      color: '#22d3ee', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                      width: '100%', justifyContent: 'center',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="11" x2="12" y2="17" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                    Save to Document
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save to Document Modal */}
      {showSaveModal && (
        <ModalBackdrop onClose={() => setShowSaveModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1a1a', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)',
              width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0 }}>Save to Document</h3>
              <button onClick={() => setShowSaveModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>&times;</button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              <input
                type="text" value={docSearchQuery}
                onChange={e => searchDocuments(e.target.value)}
                placeholder="Search by customer name or document number..."
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', background: '#111111',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {saveError && (
              <div style={{ padding: '0 20px 12px' }}>
                <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>{saveError}</div>
              </div>
            )}

            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              {docSearching && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 0' }}>
                  <Spinner size={18} />
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Searching...</span>
                </div>
              )}

              {!docSearching && docSearchQuery.length >= 2 && docSearchResults.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>No documents found</div>
              )}

              {docSearchResults.map(doc => {
                const isSaving = savingToDoc === doc.id
                const typeBadge = doc.doc_type === 'invoice'
                  ? { label: 'Invoice', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' }
                  : { label: 'Quote', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' }
                return (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', padding: '12px',
                    background: '#111111', borderRadius: '8px', marginBottom: '6px',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700 }}>#{doc.doc_number}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: typeBadge.color, background: typeBadge.bg, padding: '2px 6px', borderRadius: '4px' }}>{typeBadge.label}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>{doc.status}</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.customer_name}{doc.company_name ? ` \u2014 ${doc.company_name}` : ''}
                      </div>
                      <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '2px' }}>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => saveToDocument(doc.id)}
                      disabled={isSaving}
                      style={{
                        padding: '7px 14px',
                        background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                        border: 'none', borderRadius: '8px',
                        color: '#111111', fontSize: '12px', fontWeight: 700,
                        cursor: isSaving ? 'wait' : 'pointer',
                        opacity: isSaving ? 0.6 : 1,
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      {isSaving ? <Spinner size={14} /> : 'Attach'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

// ── Icons ──

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
