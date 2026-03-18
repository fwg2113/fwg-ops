'use client'

import { useState, useRef, useCallback } from 'react'
import { analyzeImage, generateEdgeHeatmap, type ImageAnalysis } from './utils/analyzeImage'
import { applyAlphaThreshold, previewAlphaThreshold } from './utils/cleanEdges'
import { applyEdgeSmoothing, previewEdgeSmoothing } from './utils/edgeSmoothing'
import { trimTransparency } from './utils/trimTransparency'
import { pdfToImage } from '@/app/lib/pdfToImage'

type CardStatus = 'idle' | 'loading' | 'done' | 'error'

const API_BASE = '/api/image-enhancer'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED_TYPES = '.png,.jpg,.jpeg,.svg,.pdf,.ai,.eps'

// --- Shared UI pieces ---

const Spinner = ({ size = 28 }: { size?: number }) => (
  <div style={{
    width: size, height: size,
    border: '3px solid rgba(34,211,238,0.2)',
    borderTop: '3px solid #22d3ee',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }} />
)

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const cardStyle = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '20px',
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
  border: 'none', borderRadius: '8px',
  color: '#111111', fontSize: '13px', fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
}

const btnOutline: React.CSSProperties = {
  padding: '10px 20px',
  background: 'transparent',
  border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px',
  color: '#22d3ee', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
}

const btnGhost: React.CSSProperties = {
  padding: '10px 20px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
  color: '#94a3b8', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
}

const checkerboard = {
  backgroundColor: '#e8e8e8',
  backgroundImage: 'linear-gradient(45deg, #d0d0d0 25%, transparent 25%), linear-gradient(-45deg, #d0d0d0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d0d0d0 75%), linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
}

const GRADE_COLORS: Record<string, string> = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' }

// --- SVG color helpers ---

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', navy: '#000080',
  teal: '#008080', olive: '#808000', lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff',
  pink: '#ffc0cb', brown: '#a52a2a',
}

function extractSvgColors(svg: string): string[] {
  const colors = new Set<string>()
  const hexMatches = svg.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g)
  if (hexMatches) {
    for (const hex of hexMatches) {
      const normalized = hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex
      colors.add(normalized.toLowerCase())
    }
  }
  const rgbMatches = svg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)
  if (rgbMatches) {
    for (const rgb of rgbMatches) {
      const parts = rgb.match(/\d+/g)
      if (parts && parts.length >= 3) {
        colors.add(`#${Number(parts[0]).toString(16).padStart(2, '0')}${Number(parts[1]).toString(16).padStart(2, '0')}${Number(parts[2]).toString(16).padStart(2, '0')}`)
      }
    }
  }
  const attrMatches = svg.match(/(?:fill|stroke|stop-color)\s*[:=]\s*"?\s*([a-zA-Z]+)\s*"?/g)
  if (attrMatches) {
    for (const attr of attrMatches) {
      const nameMatch = attr.match(/[:=]\s*"?\s*([a-zA-Z]+)\s*"?$/)
      if (nameMatch) {
        const name = nameMatch[1].toLowerCase()
        if (name !== 'none' && name !== 'transparent' && name !== 'inherit' && name !== 'currentcolor' && NAMED_COLORS[name]) {
          colors.add(NAMED_COLORS[name])
        }
      }
    }
  }
  // Keep black only if explicitly present
  colors.delete('#000000')
  if (hexMatches?.some(h => h.toLowerCase() === '#000000' || h.toLowerCase() === '#000')) {
    colors.add('#000000')
  }
  return Array.from(colors)
}

function replaceSvgColor(svgText: string, sourceHex: string, targetHex: string): string {
  const srcLower = sourceHex.toLowerCase()
  const srcUpper = sourceHex.toUpperCase()
  let src3 = ''
  if (srcLower[1] === srcLower[2] && srcLower[3] === srcLower[4] && srcLower[5] === srcLower[6]) {
    src3 = `#${srcLower[1]}${srcLower[3]}${srcLower[5]}`
  }
  let result = svgText
  result = result.split(srcLower).join(targetHex)
  result = result.split(srcUpper).join(targetHex)
  if (src3) {
    result = result.split(src3).join(targetHex)
    result = result.split(src3.toUpperCase()).join(targetHex)
  }
  return result
}

// --- Main Component ---

export default function ImageEnhancerInternal() {
  // Upload
  const [file, setFile] = useState<File | null>(null)
  const [originalBase64, setOriginalBase64] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analyze
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<CardStatus>('idle')
  const [analysisError, setAnalysisError] = useState('')
  const [heatmapUrl, setHeatmapUrl] = useState('')

  // Enhance
  const [enhancedBase64, setEnhancedBase64] = useState('')
  const [enhanceStatus, setEnhanceStatus] = useState<CardStatus>('idle')
  const [enhanceError, setEnhanceError] = useState('')

  // Remove Background
  const [bgRemovedBase64, setBgRemovedBase64] = useState('')
  const [bgRemoveStatus, setBgRemoveStatus] = useState<CardStatus>('idle')
  const [bgRemoveError, setBgRemoveError] = useState('')
  const [bgColor, setBgColor] = useState<'transparent' | 'white' | 'black'>('transparent')

  // Clean Edges
  const [cleanedBase64, setCleanedBase64] = useState('')
  const [cleanupStatus, setCleanupStatus] = useState<CardStatus>('idle')
  const [cleanupError, setCleanupError] = useState('')
  const [cleanThreshold, setCleanThreshold] = useState(50)
  const [cleanPreview, setCleanPreview] = useState('')
  const [cleanMode, setCleanMode] = useState<'threshold' | 'smooth'>('threshold')
  const [contractionRadius, setContractionRadius] = useState(2)
  const [smoothingRadius, setSmoothingRadius] = useState(3)
  const [smoothPreview, setSmoothPreview] = useState('')

  // Vectorize
  const [vectorizedSvg, setVectorizedSvg] = useState('')
  const [vectorizeStatus, setVectorizeStatus] = useState<CardStatus>('idle')
  const [vectorizeError, setVectorizeError] = useState('')

  // Color Replace
  const [svgColors, setSvgColors] = useState<string[]>([])
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [targetColor, setTargetColor] = useState('#ff0000')
  const [colorReplaceSvg, setColorReplaceSvg] = useState('')

  // Zoom lightbox — can show any image
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
  const [zoomLabel, setZoomLabel] = useState('')

  // Save to Document
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docSearchResults, setDocSearchResults] = useState<Array<{ id: string; doc_number: number; doc_type: string; status: string; customer_name: string; company_name: string; created_at: string }>>([])
  const [docSearching, setDocSearching] = useState(false)
  const [savingToDoc, setSavingToDoc] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<{ docNumber: number; docType: string; docId: string } | null>(null)
  const [saveError, setSaveError] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // --- Helpers ---

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(f)
    })

  const getBestRaster = () => bgRemovedBase64 || cleanedBase64 || enhancedBase64 || originalBase64

  const reset = () => {
    setFile(null); setOriginalBase64(''); setFileUrl(''); setUploading(false)
    setAnalysisResult(null); setAnalysisStatus('idle'); setAnalysisError(''); setHeatmapUrl('')
    setEnhancedBase64(''); setEnhanceStatus('idle'); setEnhanceError('')
    setBgRemovedBase64(''); setBgRemoveStatus('idle'); setBgRemoveError('')
    setCleanedBase64(''); setCleanupStatus('idle'); setCleanupError(''); setCleanPreview(''); setSmoothPreview('')
    setVectorizedSvg(''); setVectorizeStatus('idle'); setVectorizeError('')
    setSvgColors([]); setSelectedColor(null); setColorReplaceSvg('')
    setZoomSrc(null); setZoomLabel('')
  }

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

  const getBestSaveData = (): { data: string; filename: string; contentType: string } | null => {
    const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'image'
    if (colorReplaceSvg) return { data: colorReplaceSvg, filename: `${baseName}-recolored.svg`, contentType: 'image/svg+xml' }
    if (vectorizedSvg) return { data: vectorizedSvg, filename: `${baseName}-vector.svg`, contentType: 'image/svg+xml' }
    if (bgRemovedBase64) return { data: bgRemovedBase64, filename: `${baseName}-nobg.png`, contentType: 'image/png' }
    if (cleanedBase64) return { data: cleanedBase64, filename: `${baseName}-cleaned.png`, contentType: 'image/png' }
    if (enhancedBase64) return { data: enhancedBase64, filename: `${baseName}-enhanced.png`, contentType: 'image/png' }
    if (originalBase64) return { data: originalBase64, filename: file?.name || `${baseName}.png`, contentType: file?.type || 'image/png' }
    return null
  }

  const saveToDocument = async (docId: string) => {
    const best = getBestSaveData()
    if (!best) return
    setSavingToDoc(docId); setSaveError('')
    try {
      // Use FormData to avoid JSON size limits on large images
      const formData = new FormData()
      formData.append('documentId', docId)
      formData.append('filename', best.filename)
      formData.append('contentType', best.contentType)

      // For SVG text, send as imageData field. For base64/data URLs, convert to blob.
      if (best.data.startsWith('<svg') || best.data.startsWith('<?xml')) {
        formData.append('imageData', best.data)
      } else if (best.data.startsWith('data:')) {
        const dataUrl = best.data
        const byteString = atob(dataUrl.split(',')[1])
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type: mimeString })
        formData.append('file', blob, best.filename)
      } else {
        formData.append('imageData', best.data)
      }

      const res = await fetch('/api/image-enhancer/save-to-document', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Save failed') }
      const json = await res.json()
      setSaveSuccess({ docNumber: json.docNumber, docType: json.docType, docId })
      setShowSaveModal(false)
    } catch (err: any) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSavingToDoc(null)
    }
  }

  const downloadFile = (data: string, filename: string, mime: string) => {
    const link = document.createElement('a')
    if (mime === 'image/svg+xml') {
      const blob = new Blob([data], { type: mime })
      link.href = URL.createObjectURL(blob)
    } else if (data.startsWith('data:')) {
      link.href = data
    } else {
      link.href = `data:${mime};base64,${data}`
    }
    link.download = filename
    link.click()
  }

  // --- Upload ---

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

    setFile(f)
    setFileUrl('')
    setUploading(true)
    setAnalysisResult(null); setAnalysisStatus('idle'); setAnalysisError(''); setHeatmapUrl('')
    setEnhancedBase64(''); setEnhanceStatus('idle'); setEnhanceError('')
    setBgRemovedBase64(''); setBgRemoveStatus('idle'); setBgRemoveError('')
    setCleanedBase64(''); setCleanupStatus('idle'); setCleanupError(''); setCleanPreview(''); setSmoothPreview('')
    setVectorizedSvg(''); setVectorizeStatus('idle'); setVectorizeError('')
    setSvgColors([]); setSelectedColor(null); setColorReplaceSvg('')
    setZoomSrc(null); setZoomLabel('')

    const b64 = await fileToBase64(f)
    setOriginalBase64(b64)

    try {
      const formData = new FormData()
      formData.append('file', f)
      const uploadRes = await fetch('/api/image-enhancer/presign', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Failed to upload file')
      const { fileUrl: url } = await uploadRes.json()
      setFileUrl(url)
    } catch (err: any) {
      console.error('R2 upload failed:', err)
      alert('Failed to upload file. Please try again.')
      setFile(null); setOriginalBase64('')
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

  // --- Tool functions ---

  const runAnalyze = async () => {
    if (!file || !originalBase64) return
    setAnalysisStatus('loading'); setAnalysisError(''); setHeatmapUrl('')
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = originalBase64
      })

      const result = await analyzeImage({
        fileName: file.name,
        fileType: file.type,
        objectUrl: originalBase64,
        nativeWidth: img.width,
        nativeHeight: img.height,
      })
      setAnalysisResult(result)
      setAnalysisStatus('done')

      // Generate heat map if gradient edges detected
      if (result.suggestCleanEdges && result.gradientEdgePct > 0) {
        generateEdgeHeatmap(originalBase64, img.width, img.height)
          .then(url => setHeatmapUrl(url))
          .catch(() => {})
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Analysis failed'); setAnalysisStatus('error')
    }
  }

  const runEnhance = async () => {
    if (!fileUrl) return
    setEnhanceStatus('loading'); setEnhanceError('')
    try {
      const res = await fetch(`${API_BASE}/enhance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl }),
      })
      if (!res.ok) throw new Error(`Enhancement failed (${res.status})`)
      const json = await res.json()
      setEnhancedBase64(json.imageBase64 || '')
      setEnhanceStatus('done')
    } catch (err: any) {
      setEnhanceError(err.message || 'Enhancement failed'); setEnhanceStatus('error')
    }
  }

  const runBgRemove = async () => {
    if (!fileUrl) return
    setBgRemoveStatus('loading'); setBgRemoveError('')
    try {
      const res = await fetch(`${API_BASE}/remove-background`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, background: bgColor }),
      })
      if (!res.ok) throw new Error(`Background removal failed (${res.status})`)
      const json = await res.json()
      setBgRemovedBase64(json.imageBase64 || '')
      setBgRemoveStatus('done')
    } catch (err: any) {
      setBgRemoveError(err.message || 'Background removal failed'); setBgRemoveStatus('error')
    }
  }

  const getCleanSrc = () => bgRemovedBase64 || enhancedBase64 || originalBase64
  const getCleanDims = (): [number, number] => {
    if (analysisResult) return [analysisResult.nativeWidth, analysisResult.nativeHeight]
    return [0, 0]
  }

  const updateCleanPreview = (threshold: number) => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(async () => {
      const src = getCleanSrc()
      const [w, h] = getCleanDims()
      if (!src || !w) return
      try {
        const url = await previewAlphaThreshold(src, w, h, threshold)
        setCleanPreview(url)
      } catch {}
    }, 150)
  }

  const updateSmoothPreview = (contraction: number, smoothing: number) => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(async () => {
      const src = getCleanSrc()
      const [w, h] = getCleanDims()
      if (!src || !w) return
      try {
        const url = await previewEdgeSmoothing(src, w, h, contraction, smoothing)
        setSmoothPreview(url)
      } catch {}
    }, 200)
  }

  const runCleanEdges = async () => {
    const src = getCleanSrc()
    const [w, h] = getCleanDims()
    if (!src || !w) return
    setCleanupStatus('loading'); setCleanupError('')
    try {
      if (cleanMode === 'threshold') {
        const result = await applyAlphaThreshold(src, w, h, cleanThreshold)
        setCleanedBase64(result.url)
      } else {
        const result = await applyEdgeSmoothing(src, w, h, contractionRadius, smoothingRadius)
        setCleanedBase64(result.url)
      }
      setCleanupStatus('done')
    } catch (err: any) {
      setCleanupError(err.message || 'Cleanup failed'); setCleanupStatus('error')
    }
  }

  const runTrim = async () => {
    const src = cleanedBase64 || bgRemovedBase64 || originalBase64
    if (!src || !file) return
    try {
      const result = await trimTransparency(src, file.type || 'image/png')
      if (result.trimmed) {
        if (cleanedBase64) setCleanedBase64(result.url)
        else if (bgRemovedBase64) setBgRemovedBase64(result.url)
      }
    } catch {}
  }

  const runVectorize = async () => {
    const data = getBestRaster()
    if (!data) return
    setVectorizeStatus('loading'); setVectorizeError('')
    try {
      const res = await fetch(`${API_BASE}/vectorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data }),
      })
      if (!res.ok) throw new Error(`Vectorization failed (${res.status})`)
      const json = await res.json()
      const svg = json.svg || json.imageBase64 || ''
      setVectorizedSvg(svg)
      setVectorizeStatus('done')
      if (svg && (svg.trimStart().startsWith('<svg') || svg.trimStart().startsWith('<?xml'))) {
        setSvgColors(extractSvgColors(svg))
      }
    } catch (err: any) {
      setVectorizeError(err.message || 'Vectorization failed'); setVectorizeStatus('error')
    }
  }

  const applyColorReplace = () => {
    if (!selectedColor || !vectorizedSvg) return
    const working = colorReplaceSvg || vectorizedSvg
    const replaced = replaceSvgColor(working, selectedColor, targetColor)
    setColorReplaceSvg(replaced)
    setSvgColors(extractSvgColors(replaced))
    setSelectedColor(null)
  }

  const resetColors = () => {
    setColorReplaceSvg('')
    setSvgColors(extractSvgColors(vectorizedSvg))
    setSelectedColor(null)
  }

  // --- Render helpers ---

  const renderCardHeader = (title: string, subtitle: string, status: CardStatus) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: status === 'done' ? '16px' : '0' }}>
      <div>
        <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>{title}</h3>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: '2px 0 0' }}>{subtitle}</p>
      </div>
      {status === 'done' && (
        <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600, background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '6px' }}>Done</span>
      )}
    </div>
  )

  const renderLoadingState = (msg: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
      <Spinner size={22} />
      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{msg}</span>
    </div>
  )

  const renderErrorState = (msg: string, retry: () => void) => (
    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#ef4444', fontSize: '13px' }}>{msg}</span>
      <button onClick={retry} style={{ ...btnOutline, padding: '6px 14px', fontSize: '12px', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>Retry</button>
    </div>
  )

  const showZoom = (src: string, label: string) => { setZoomSrc(src); setZoomLabel(label) }

  const renderImagePreview = (src: string, alt: string, bgStyle?: React.CSSProperties, zoomable = true) => (
    <div
      onClick={zoomable ? () => showZoom(src, alt) : undefined}
      style={{
        borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '140px', border: '1px solid rgba(255,255,255,0.06)',
        background: '#fff', ...bgStyle,
        cursor: zoomable ? 'zoom-in' : undefined,
      }}
    >
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
    </div>
  )

  // --- Tool Cards ---

  const renderAnalyzeCard = () => (
    <div style={cardStyle}>
      {renderCardHeader('Analyze', 'Print readiness, DPI, transparency', analysisStatus)}

      {analysisStatus === 'idle' && (
        <div style={{ marginTop: '16px' }}>
          <button onClick={runAnalyze} style={btnPrimary}>Run Analysis</button>
        </div>
      )}

      {analysisStatus === 'loading' && renderLoadingState('Analyzing image...')}
      {analysisStatus === 'error' && renderErrorState(analysisError, runAnalyze)}

      {analysisStatus === 'done' && analysisResult && (() => {
        const r = analysisResult
        const gradeColor = GRADE_COLORS[r.grade] || '#6b7280'
        return (
          <div>
            {/* Grade banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              background: `${gradeColor}10`, border: `1px solid ${gradeColor}30`,
              borderRadius: '8px', marginBottom: '14px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: `${gradeColor}20`, border: `2px solid ${gradeColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 800, color: gradeColor,
              }}>
                {r.grade}
              </div>
              <div>
                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>{r.gradeLabel}</div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>{r.fileTypeLabel} &middot; {r.dpiDetail}</div>
              </div>
            </div>

            {/* Specs grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', background: '#1a1a1a', borderRadius: '6px' }}>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dimensions</div>
                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>
                  {r.nativeWidth} &times; {r.nativeHeight}
                </div>
              </div>
              <div style={{ padding: '10px', background: '#1a1a1a', borderRadius: '6px' }}>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Print at 300 DPI</div>
                <div style={{ color: '#22d3ee', fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>
                  {r.printWidthInches.toFixed(1)}&Prime; &times; {r.printHeightInches.toFixed(1)}&Prime;
                </div>
              </div>
            </div>

            {/* Transparency & edges */}
            <div style={{ padding: '10px', background: '#1a1a1a', borderRadius: '6px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Edges</div>
                {r.gradientEdgeSeverity !== 'none' && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                    color: r.gradientEdgeSeverity === 'minor' ? '#22c55e' : r.gradientEdgeSeverity === 'moderate' ? '#f59e0b' : '#ef4444',
                    background: r.gradientEdgeSeverity === 'minor' ? 'rgba(34,197,94,0.1)' : r.gradientEdgeSeverity === 'moderate' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                  }}>
                    {r.gradientEdgeSeverity}
                  </span>
                )}
              </div>
              <div style={{ color: '#f1f5f9', fontSize: '12px', marginTop: '4px' }}>{r.gradientEdgeLabel}</div>
              {r.suggestCleanEdges && (
                <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px' }}>
                  Use Clean Edges tool to fix for DTF printing
                </div>
              )}
            </div>

            {/* Heat map */}
            {heatmapUrl && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Gradient Edge Heat Map
                </div>
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <img src={heatmapUrl} alt="Edge heat map" style={{ width: '100%', display: 'block' }} />
                </div>
                <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>
                  Red = semi-transparent pixels that cause DTF halos
                </div>
              </div>
            )}

            {/* Tool suggestions */}
            {(r.suggestBgRemoval || r.suggestUpscale || r.suggestVectorize || r.suggestCleanEdges) && (
              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)', borderRadius: '6px' }}>
                <div style={{ color: '#22d3ee', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Suggested Tools</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {r.suggestBgRemoval && <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>Remove Background</span>}
                  {r.suggestUpscale && <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>Enhance</span>}
                  {r.suggestCleanEdges && <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>Clean Edges</span>}
                  {r.suggestVectorize && <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>Vectorize</span>}
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )

  const renderEnhanceCard = () => (
    <div style={cardStyle}>
      {renderCardHeader('Enhance', 'Upscale and improve quality', enhanceStatus)}

      {enhanceStatus === 'idle' && (
        <div style={{ marginTop: '16px' }}>
          <button onClick={runEnhance} style={btnPrimary}>Enhance Image</button>
        </div>
      )}

      {enhanceStatus === 'loading' && renderLoadingState('Enhancing image...')}
      {enhanceStatus === 'error' && renderErrorState(enhanceError, runEnhance)}

      {enhanceStatus === 'done' && enhancedBase64 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', textAlign: 'center' }}>Original</div>
              {renderImagePreview(originalBase64, 'Original')}
            </div>
            <div>
              <div style={{ color: '#22d3ee', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', textAlign: 'center' }}>Enhanced</div>
              {renderImagePreview(enhancedBase64, 'Enhanced')}
            </div>
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Click image to zoom</div>
        </div>
      )}
    </div>
  )

  const renderBgRemoveCard = () => (
    <div style={cardStyle}>
      {renderCardHeader('Remove Background', 'Isolate subject from background', bgRemoveStatus)}

      {bgRemoveStatus !== 'loading' && (
        <div style={{ marginTop: '14px', marginBottom: bgRemoveStatus === 'done' ? '14px' : '0' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['transparent', 'white', 'black'] as const).map(color => (
              <button
                key={color}
                onClick={() => setBgColor(color)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: bgColor === color ? 'rgba(34,211,238,0.12)' : 'transparent',
                  border: bgColor === color ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
                  color: bgColor === color ? '#22d3ee' : '#94a3b8',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}
              >
                <div style={{
                  width: '16px', height: '16px', borderRadius: '3px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: color === 'transparent'
                    ? 'repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50%/8px 8px'
                    : color,
                }} />
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {bgRemoveStatus === 'idle' && (
        <div style={{ marginTop: '14px' }}>
          <button onClick={runBgRemove} style={btnPrimary}>Remove Background</button>
        </div>
      )}

      {bgRemoveStatus === 'loading' && renderLoadingState('Removing background...')}
      {bgRemoveStatus === 'error' && renderErrorState(bgRemoveError, runBgRemove)}

      {bgRemoveStatus === 'done' && bgRemovedBase64 && (
        <div>
          {renderImagePreview(bgRemovedBase64, 'Background removed', {
            background: bgColor === 'transparent'
              ? 'repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 50%/14px 14px'
              : bgColor === 'black' ? '#000' : '#fff',
          })}
          <button onClick={runTrim} style={{ ...btnGhost, marginTop: '8px', padding: '6px 14px', fontSize: '11px' }}>
            Trim Transparent Padding
          </button>
        </div>
      )}
    </div>
  )

  const renderCleanEdgesCard = () => {
    const hasSrc = !!(bgRemovedBase64 || enhancedBase64 || originalBase64)
    const hasAnalysis = !!analysisResult
    const previewSrc = cleanMode === 'threshold' ? cleanPreview : smoothPreview
    return (
      <div style={{ ...cardStyle, opacity: hasSrc ? 1 : 0.5 }}>
        {renderCardHeader('Clean Edges', 'Fix gradient edges & halos for DTF', cleanupStatus)}

        {!hasSrc && (
          <div style={{ marginTop: '14px', color: '#6b7280', fontSize: '12px' }}>Upload an image first</div>
        )}

        {hasSrc && cleanupStatus !== 'loading' && cleanupStatus !== 'done' && (
          <div style={{ marginTop: '14px' }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
              {(['threshold', 'smooth'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setCleanMode(mode); setCleanPreview(''); setSmoothPreview('') }}
                  style={{
                    flex: 1, padding: '7px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: cleanMode === mode ? 'rgba(34,211,238,0.12)' : 'transparent',
                    border: cleanMode === mode ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
                    color: cleanMode === mode ? '#22d3ee' : '#94a3b8',
                  }}
                >
                  {mode === 'threshold' ? 'Alpha Threshold' : 'Edge Smoothing'}
                </button>
              ))}
            </div>

            {cleanMode === 'threshold' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Threshold</span>
                  <span style={{ color: '#f1f5f9', fontSize: '11px', fontWeight: 600 }}>{cleanThreshold}%</span>
                </div>
                <input
                  type="range" min={10} max={90} value={cleanThreshold}
                  onChange={e => { const v = Number(e.target.value); setCleanThreshold(v); updateCleanPreview(v) }}
                  style={{ width: '100%', accentColor: '#22d3ee' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>Keep more</span>
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>Remove more</span>
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '10px' }}>
                  Pixels below {cleanThreshold}% alpha become transparent, above become fully opaque.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Contraction</span>
                    <span style={{ color: '#f1f5f9', fontSize: '11px', fontWeight: 600 }}>{contractionRadius}px</span>
                  </div>
                  <input
                    type="range" min={0} max={10} value={contractionRadius}
                    onChange={e => { const v = Number(e.target.value); setContractionRadius(v); updateSmoothPreview(v, smoothingRadius) }}
                    style={{ width: '100%', accentColor: '#22d3ee' }}
                  />
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>Shrinks edges inward to remove halos</div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Smoothing</span>
                    <span style={{ color: '#f1f5f9', fontSize: '11px', fontWeight: 600 }}>{smoothingRadius}px</span>
                  </div>
                  <input
                    type="range" min={0} max={8} value={smoothingRadius}
                    onChange={e => { const v = Number(e.target.value); setSmoothingRadius(v); updateSmoothPreview(contractionRadius, v) }}
                    style={{ width: '100%', accentColor: '#22d3ee' }}
                  />
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>Smooths pixel staircase edges into curves</div>
                </div>
              </div>
            )}

            {/* Preview */}
            {previewSrc && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Preview</div>
                {renderImagePreview(previewSrc, 'Preview', checkerboard)}
              </div>
            )}

            <button onClick={runCleanEdges} style={btnPrimary}>
              Apply {cleanMode === 'threshold' ? 'Threshold' : 'Smoothing'}
            </button>
          </div>
        )}

        {cleanupStatus === 'loading' && renderLoadingState('Cleaning edges...')}
        {cleanupStatus === 'error' && renderErrorState(cleanupError, runCleanEdges)}

        {cleanupStatus === 'done' && cleanedBase64 && (
          <div>
            {renderImagePreview(cleanedBase64, 'Cleaned', checkerboard)}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button
                onClick={() => { setCleanedBase64(''); setCleanupStatus('idle'); setCleanPreview(''); setSmoothPreview('') }}
                style={{ ...btnGhost, padding: '6px 14px', fontSize: '11px' }}
              >
                Re-run
              </button>
              <button onClick={runTrim} style={{ ...btnGhost, padding: '6px 14px', fontSize: '11px' }}>
                Trim Padding
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderVectorizeCard = () => {
    const complexity = analysisResult?.vectorizeComplexity
    const tooComplex = complexity === 'very_complex'
    const colorGroups = analysisResult?.distinctColorGroups || 0

    return (
      <div style={{ ...cardStyle, opacity: tooComplex ? 0.5 : 1 }}>
        {renderCardHeader('Vectorize', 'Convert to scalable SVG', vectorizeStatus)}

        {tooComplex && (
          <div style={{ marginTop: '14px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
            <span style={{ color: '#f59e0b', fontSize: '12px' }}>
              Image is too complex for clean vectorization ({colorGroups} color groups detected).
            </span>
          </div>
        )}

        {complexity === 'complex' && vectorizeStatus === 'idle' && (
          <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: '6px' }}>
            <span style={{ color: '#f59e0b', fontSize: '11px' }}>
              Complex image ({colorGroups} color groups) — results may vary
            </span>
          </div>
        )}

        {vectorizeStatus === 'idle' && !tooComplex && (
          <div style={{ marginTop: '16px' }}>
            <button onClick={runVectorize} style={btnPrimary}>Vectorize</button>
            <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '10px' }}>May take up to 60s</span>
          </div>
        )}

        {vectorizeStatus === 'loading' && renderLoadingState('Vectorizing — this may take up to 60s...')}
        {vectorizeStatus === 'error' && renderErrorState(vectorizeError, runVectorize)}

        {vectorizeStatus === 'done' && vectorizedSvg && (
          <div style={{
            marginTop: '4px', borderRadius: '8px', padding: '8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', minHeight: '140px',
            border: '1px solid rgba(255,255,255,0.06)', ...checkerboard,
            overflow: 'hidden',
          }}>
            {vectorizedSvg.trimStart().startsWith('<svg') || vectorizedSvg.trimStart().startsWith('<?xml') ? (
              <div
                dangerouslySetInnerHTML={{ __html: vectorizedSvg }}
                style={{ maxWidth: '100%', maxHeight: '200px', overflow: 'hidden' }}
                ref={(el) => {
                  if (el) {
                    const svg = el.querySelector('svg')
                    if (svg) {
                      svg.style.maxWidth = '100%'
                      svg.style.maxHeight = '200px'
                      svg.style.height = 'auto'
                      svg.style.width = 'auto'
                      svg.removeAttribute('width')
                      svg.removeAttribute('height')
                    }
                  }
                }}
              />
            ) : (
              <img
                src={vectorizedSvg.startsWith('data:') || vectorizedSvg.startsWith('http') ? vectorizedSvg : `data:image/svg+xml;base64,${vectorizedSvg}`}
                alt="Vectorized"
                style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  const renderColorReplaceCard = () => {
    const hasSvg = !!(vectorizedSvg && (vectorizedSvg.trimStart().startsWith('<svg') || vectorizedSvg.trimStart().startsWith('<?xml')))
    const displaySvg = colorReplaceSvg || vectorizedSvg
    const hasChanges = !!colorReplaceSvg

    return (
      <div style={{ ...cardStyle, opacity: hasSvg ? 1 : 0.5 }}>
        {renderCardHeader('Color Replace', 'Swap colors in vectorized SVG', hasChanges ? 'done' : 'idle')}

        {!hasSvg && (
          <div style={{ marginTop: '14px', color: '#6b7280', fontSize: '12px' }}>Vectorize an image first to use color replace</div>
        )}

        {hasSvg && svgColors.length === 0 && (
          <div style={{ marginTop: '14px', color: '#6b7280', fontSize: '12px' }}>No replaceable colors found in SVG</div>
        )}

        {hasSvg && svgColors.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            {/* Color swatches */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {svgColors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color === selectedColor ? null : color)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
                    border: selectedColor === color ? '2px solid #22d3ee' : '2px solid rgba(255,255,255,0.1)',
                    background: color, transition: 'all 0.15s',
                    transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                  }}
                  title={color}
                />
              ))}
            </div>

            {/* Replace controls */}
            {selectedColor && (
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>From:</span>
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: selectedColor }} />
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>&rarr;</span>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>To:</span>
                  <input
                    type="color" value={targetColor}
                    onChange={e => setTargetColor(e.target.value)}
                    style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent', padding: 0 }}
                  />
                  <span style={{ color: '#6b7280', fontSize: '10px', fontFamily: 'monospace' }}>{targetColor.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={applyColorReplace} style={{ ...btnPrimary, padding: '7px 14px', fontSize: '12px', flex: 1, justifyContent: 'center' }}>Apply</button>
                  <button onClick={() => setSelectedColor(null)} style={{ ...btnGhost, padding: '7px 14px', fontSize: '12px' }}>Cancel</button>
                </div>
              </div>
            )}

            {hasChanges && (
              <button onClick={resetColors} style={{ ...btnGhost, padding: '6px 14px', fontSize: '11px', marginBottom: '14px' }}>
                Reset Colors
              </button>
            )}

            {/* SVG preview */}
            <div style={{
              borderRadius: '8px', padding: '8px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', minHeight: '140px',
              border: '1px solid rgba(255,255,255,0.06)', ...checkerboard,
              overflow: 'hidden',
            }}>
              <div
                dangerouslySetInnerHTML={{ __html: displaySvg }}
                style={{ maxWidth: '100%', maxHeight: '200px', overflow: 'hidden' }}
                ref={(el) => {
                  if (el) {
                    const svg = el.querySelector('svg')
                    if (svg) {
                      svg.style.maxWidth = '100%'
                      svg.style.maxHeight = '200px'
                      svg.style.height = 'auto'
                      svg.style.width = 'auto'
                      svg.removeAttribute('width')
                      svg.removeAttribute('height')
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- Downloads Panel ---

  const renderDownloads = () => {
    const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'image'
    const hasAny = originalBase64 || enhancedBase64 || bgRemovedBase64 || cleanedBase64 || vectorizedSvg || colorReplaceSvg
    if (!hasAny) return null

    const items: Array<{ label: string; sub: string; data: string; filename: string; mime: string; tier: 'best' | 'great' | 'good' | 'basic' }> = []

    if (colorReplaceSvg) items.push({ label: 'Recolored SVG', sub: 'Color-swapped vector', data: colorReplaceSvg, filename: `${baseName}-recolored.svg`, mime: 'image/svg+xml', tier: 'best' })
    if (vectorizedSvg) items.push({ label: 'SVG Vector', sub: 'Scalable, lossless', data: vectorizedSvg, filename: `${baseName}-vector.svg`, mime: 'image/svg+xml', tier: colorReplaceSvg ? 'good' : 'best' })
    if (bgRemovedBase64) items.push({ label: 'BG Removed PNG', sub: 'Transparent background', data: bgRemovedBase64, filename: `${baseName}-nobg.png`, mime: 'image/png', tier: 'great' })
    if (cleanedBase64) items.push({ label: 'Cleaned PNG', sub: 'Clean edges for DTF', data: cleanedBase64, filename: `${baseName}-cleaned.png`, mime: 'image/png', tier: 'great' })
    if (enhancedBase64) items.push({ label: 'Enhanced PNG', sub: 'Upscaled quality', data: enhancedBase64, filename: `${baseName}-enhanced.png`, mime: 'image/png', tier: 'good' })
    if (originalBase64) {
      const ext = file?.name?.split('.').pop() || 'png'
      items.push({ label: 'Original', sub: file?.name || 'Original file', data: originalBase64, filename: `${baseName}-original.${ext}`, mime: file?.type || 'image/png', tier: 'basic' })
    }

    const tierColors: Record<string, string> = { best: '#22d3ee', great: '#a855f7', good: '#22c55e', basic: '#6b7280' }

    return (
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Downloads</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(item => (
            <div key={item.filename} style={{
              display: 'flex', alignItems: 'center', padding: '10px 12px',
              background: '#1a1a1a', borderRadius: '8px',
              border: item.tier === 'best' ? '1px solid rgba(34,211,238,0.25)' : '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                  {item.tier !== 'basic' && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                      color: tierColors[item.tier], background: `${tierColors[item.tier]}15`,
                      padding: '2px 6px', borderRadius: '4px',
                    }}>{item.tier}</span>
                  )}
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
              </div>
              <button
                onClick={() => downloadFile(item.data, item.filename, item.mime)}
                style={item.tier === 'best' ? { ...btnPrimary, padding: '7px 14px', fontSize: '12px' } : { ...btnGhost, padding: '7px 14px', fontSize: '12px' }}
              >
                <DownloadIcon /> {item.mime === 'image/svg+xml' ? 'SVG' : item.label.includes('Original') ? 'File' : 'PNG'}
              </button>
            </div>
          ))}
        </div>

        {(enhancedBase64 || bgRemovedBase64 || cleanedBase64 || vectorizedSvg || colorReplaceSvg) && (
          <div style={{ marginTop: '14px' }}>
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
                style={{ ...btnOutline, width: '100%', justifyContent: 'center' }}
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
        )}
      </div>
    )
  }

  // --- Save to Document Modal ---

  const renderSaveModal = () => {
    if (!showSaveModal) return null
    return (
      <div
        onClick={() => setShowSaveModal(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}
      >
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
                    style={{ ...btnPrimary, padding: '7px 14px', fontSize: '12px', opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'wait' : 'pointer' }}
                  >
                    {isSaving ? <Spinner size={14} /> : 'Attach'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // --- Zoom Lightbox ---

  const renderZoomLightbox = () => {
    if (!zoomSrc) return null
    return (
      <div
        onClick={() => { setZoomSrc(null); setZoomLabel('') }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', cursor: 'zoom-out',
        }}
      >
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          {zoomLabel && (
            <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>{zoomLabel}</span>
          )}
          <button
            onClick={() => { setZoomSrc(null); setZoomLabel('') }}
            style={{ ...btnGhost, padding: '8px 16px', fontSize: '12px' }}
          >
            Close &times;
          </button>
        </div>
        <img
          src={zoomSrc}
          alt={zoomLabel}
          style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', ...checkerboard }}
        />
      </div>
    )
  }

  // --- Main Layout ---

  return (
    <div style={{ minHeight: '100vh', background: '#111111', padding: '32px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

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

        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          {!file ? (
            <div
              onDrop={handleDrop} onDragOver={handleDragOver}
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ ...checkerboard, borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
                <img src={originalBase64 || undefined} alt="Preview" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: '4px', display: 'block' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  {file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${(file.size / 1024).toFixed(1)} KB`}
                </div>
              </div>
              <button onClick={reset} style={btnGhost}>Reset</button>
            </div>
          )}
          <input
            ref={fileInputRef} type="file" accept={ACCEPTED_TYPES}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </div>

        {file && uploading && (
          <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Spinner size={22} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Uploading file to cloud storage...</span>
          </div>
        )}

        {file && fileUrl && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {renderAnalyzeCard()}
              {renderEnhanceCard()}
              {renderBgRemoveCard()}
              {renderCleanEdgesCard()}
              {renderVectorizeCard()}
              {renderColorReplaceCard()}
            </div>
            {renderDownloads()}
          </>
        )}
      </div>
      {renderSaveModal()}
      {renderZoomLightbox()}
    </div>
  )
}
