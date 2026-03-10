'use client'

import { useState, useRef, useCallback } from 'react'

interface AnalysisResult {
  dpi: number
  width: number
  height: number
  colorMode: string
  hasTransparency: boolean
  overallPass: boolean
  meetsStandard?: boolean
  channels?: number
  fileType?: string
  fileSizeBytes?: number
  checks?: Array<{ label: string; pass: boolean; detail: string }>
}

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

// --- Main Component ---

export default function ImageEnhancerInternal() {
  // Upload
  const [file, setFile] = useState<File | null>(null)
  const [originalBase64, setOriginalBase64] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analyze
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<CardStatus>('idle')
  const [analysisError, setAnalysisError] = useState('')

  // Enhance
  const [enhancedBase64, setEnhancedBase64] = useState('')
  const [enhanceStatus, setEnhanceStatus] = useState<CardStatus>('idle')
  const [enhanceError, setEnhanceError] = useState('')

  // Remove Background
  const [bgRemovedBase64, setBgRemovedBase64] = useState('')
  const [bgRemoveStatus, setBgRemoveStatus] = useState<CardStatus>('idle')
  const [bgRemoveError, setBgRemoveError] = useState('')
  const [bgColor, setBgColor] = useState<'transparent' | 'white' | 'black'>('transparent')

  // Vectorize
  const [vectorizedSvg, setVectorizedSvg] = useState('')
  const [vectorizeStatus, setVectorizeStatus] = useState<CardStatus>('idle')
  const [vectorizeError, setVectorizeError] = useState('')

  // Save to Document
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docSearchResults, setDocSearchResults] = useState<Array<{ id: string; doc_number: number; doc_type: string; status: string; customer_name: string; company_name: string; created_at: string }>>([])
  const [docSearching, setDocSearching] = useState(false)
  const [savingToDoc, setSavingToDoc] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<{ docNumber: number; docType: string; docId: string } | null>(null)
  const [saveError, setSaveError] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // --- Helpers ---

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(f)
    })

  const getBestRaster = () => bgRemovedBase64 || enhancedBase64 || originalBase64
  const getBestForProcessing = () => enhancedBase64 || originalBase64

  const reset = () => {
    setFile(null); setOriginalBase64('')
    setAnalysisResult(null); setAnalysisStatus('idle'); setAnalysisError('')
    setEnhancedBase64(''); setEnhanceStatus('idle'); setEnhanceError('')
    setBgRemovedBase64(''); setBgRemoveStatus('idle'); setBgRemoveError('')
    setVectorizedSvg(''); setVectorizeStatus('idle'); setVectorizeError('')
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
    if (vectorizedSvg) return { data: vectorizedSvg, filename: `${baseName}-vector.svg`, contentType: 'image/svg+xml' }
    if (bgRemovedBase64) return { data: bgRemovedBase64, filename: `${baseName}-nobg.png`, contentType: 'image/png' }
    if (enhancedBase64) return { data: enhancedBase64, filename: `${baseName}-enhanced.png`, contentType: 'image/png' }
    if (originalBase64) return { data: originalBase64, filename: file?.name || `${baseName}.png`, contentType: file?.type || 'image/png' }
    return null
  }

  const saveToDocument = async (docId: string) => {
    const best = getBestSaveData()
    if (!best) return
    setSavingToDoc(docId); setSaveError('')
    try {
      const res = await fetch('/api/image-enhancer/save-to-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, filename: best.filename, contentType: best.contentType, imageBase64: best.data }),
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
    setFile(f)
    const b64 = await fileToBase64(f)
    setOriginalBase64(b64)
    // Reset tool results
    setAnalysisResult(null); setAnalysisStatus('idle'); setAnalysisError('')
    setEnhancedBase64(''); setEnhanceStatus('idle'); setEnhanceError('')
    setBgRemovedBase64(''); setBgRemoveStatus('idle'); setBgRemoveError('')
    setVectorizedSvg(''); setVectorizeStatus('idle'); setVectorizeError('')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
  }, [])

  // --- API calls ---

  const runAnalyze = async () => {
    if (!originalBase64) return
    setAnalysisStatus('loading'); setAnalysisError('')
    try {
      const res = await fetch(`${API_BASE}/analyze-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: originalBase64 }),
      })
      if (!res.ok) throw new Error(`Analysis failed (${res.status})`)
      setAnalysisResult(await res.json())
      setAnalysisStatus('done')
    } catch (err: any) {
      setAnalysisError(err.message || 'Analysis failed'); setAnalysisStatus('error')
    }
  }

  const runEnhance = async () => {
    if (!originalBase64) return
    setEnhanceStatus('loading'); setEnhanceError('')
    try {
      const res = await fetch(`${API_BASE}/enhance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: originalBase64 }),
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
    const data = getBestForProcessing()
    if (!data) return
    setBgRemoveStatus('loading'); setBgRemoveError('')
    try {
      const res = await fetch(`${API_BASE}/remove-background`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, background: bgColor }),
      })
      if (!res.ok) throw new Error(`Background removal failed (${res.status})`)
      const json = await res.json()
      setBgRemovedBase64(json.imageBase64 || '')
      setBgRemoveStatus('done')
    } catch (err: any) {
      setBgRemoveError(err.message || 'Background removal failed'); setBgRemoveStatus('error')
    }
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
      setVectorizedSvg(json.svg || json.imageBase64 || '')
      setVectorizeStatus('done')
    } catch (err: any) {
      setVectorizeError(err.message || 'Vectorization failed'); setVectorizeStatus('error')
    }
  }

  // --- Vectorize color guard ---
  const analyzeColorCount = analysisResult?.channels || 0
  const tooManyColors = analysisResult ? analyzeColorCount > 10 : false

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

  const renderImagePreview = (src: string, alt: string, bgStyle?: React.CSSProperties) => (
    <div style={{
      borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '140px', border: '1px solid rgba(255,255,255,0.06)',
      background: '#fff', ...bgStyle,
    }}>
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
    </div>
  )

  // --- Tool Cards ---

  const renderAnalyzeCard = () => (
    <div style={cardStyle}>
      {renderCardHeader('Analyze', 'Check DPI, dimensions, color mode', analysisStatus)}

      {analysisStatus === 'idle' && (
        <div style={{ marginTop: '16px' }}>
          <button onClick={runAnalyze} style={btnPrimary}>Run Analysis</button>
        </div>
      )}

      {analysisStatus === 'loading' && renderLoadingState('Analyzing image...')}
      {analysisStatus === 'error' && renderErrorState(analysisError, runAnalyze)}

      {analysisStatus === 'done' && analysisResult && (
        <div>
          {/* Pass/fail banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', marginBottom: '14px',
            background: analysisResult.overallPass || analysisResult.meetsStandard ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${analysisResult.overallPass || analysisResult.meetsStandard ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: '8px',
          }}>
            <span style={{
              color: analysisResult.overallPass || analysisResult.meetsStandard ? '#22c55e' : '#ef4444',
              fontSize: '16px', fontWeight: 700,
            }}>
              {analysisResult.overallPass || analysisResult.meetsStandard ? '\u2713' : '\u2717'}
            </span>
            <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
              {analysisResult.overallPass || analysisResult.meetsStandard ? 'Print Ready' : 'Issues Detected'}
            </span>
          </div>

          {/* Specs grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'DPI', value: `${analysisResult.dpi}` },
              { label: 'Size', value: `${analysisResult.width}\u00d7${analysisResult.height}` },
              { label: 'Color', value: analysisResult.colorMode },
              { label: 'Alpha', value: analysisResult.hasTransparency ? 'Yes' : 'No' },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px', background: '#1a1a1a', borderRadius: '6px' }}>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Quality checks */}
          {analysisResult.checks && analysisResult.checks.length > 0 && (
            <div>
              {analysisResult.checks.map((check, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0',
                  borderBottom: i < analysisResult.checks!.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <span style={{ color: check.pass ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 700 }}>
                    {check.pass ? '\u2713' : '\u2717'}
                  </span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', flex: 1 }}>{check.label}</span>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>{check.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
      )}
    </div>
  )

  const renderBgRemoveCard = () => (
    <div style={cardStyle}>
      {renderCardHeader('Remove Background', 'Isolate subject from background', bgRemoveStatus)}

      {/* BG color picker — always visible when not loading */}
      {bgRemoveStatus !== 'loading' && (
        <div style={{ marginTop: '14px', marginBottom: bgRemoveStatus === 'done' ? '14px' : '0' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['transparent', 'white', 'black'] as const).map(color => (
              <button
                key={color}
                onClick={() => {
                  setBgColor(color)
                  if (bgRemoveStatus === 'done') {
                    setBgRemovedBase64(''); setBgRemoveStatus('idle')
                  }
                }}
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
        </div>
      )}
    </div>
  )

  const renderVectorizeCard = () => (
    <div style={{ ...cardStyle, opacity: tooManyColors ? 0.5 : 1 }}>
      {renderCardHeader('Vectorize', 'Convert to scalable SVG', vectorizeStatus)}

      {tooManyColors && (
        <div style={{ marginTop: '14px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
          <span style={{ color: '#f59e0b', fontSize: '12px' }}>
            Image has too many colors ({analyzeColorCount}) for clean vectorization. Recommended: 10 or fewer.
          </span>
        </div>
      )}

      {vectorizeStatus === 'idle' && !tooManyColors && (
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
        }}>
          {vectorizedSvg.trimStart().startsWith('<svg') || vectorizedSvg.trimStart().startsWith('<?xml') ? (
            <div dangerouslySetInnerHTML={{ __html: vectorizedSvg }} style={{ maxWidth: '100%', maxHeight: '200px' }} />
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

  // --- Downloads Panel ---

  const renderDownloads = () => {
    const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'image'
    const hasAny = originalBase64 || enhancedBase64 || bgRemovedBase64 || vectorizedSvg
    if (!hasAny) return null

    const items: Array<{ label: string; sub: string; data: string; filename: string; mime: string; tier: 'best' | 'great' | 'good' | 'basic' }> = []

    if (vectorizedSvg) {
      items.push({ label: 'SVG Vector', sub: 'Scalable, lossless', data: vectorizedSvg, filename: `${baseName}-vector.svg`, mime: 'image/svg+xml', tier: 'best' })
    }
    if (bgRemovedBase64) {
      items.push({ label: 'BG Removed PNG', sub: 'Transparent background', data: bgRemovedBase64, filename: `${baseName}-nobg.png`, mime: 'image/png', tier: 'great' })
    }
    if (enhancedBase64) {
      items.push({ label: 'Enhanced PNG', sub: 'Upscaled quality', data: enhancedBase64, filename: `${baseName}-enhanced.png`, mime: 'image/png', tier: 'good' })
    }
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
                    }}>
                      {item.tier}
                    </span>
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

        {/* Save to Document */}
        {(enhancedBase64 || bgRemovedBase64 || vectorizedSvg) && (
          <div style={{ marginTop: '14px' }}>
            {saveSuccess ? (
              <div style={{
                padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>
                  Saved to {saveSuccess.docType === 'invoice' ? 'Invoice' : 'Quote'} #{saveSuccess.docNumber}
                </span>
                <a
                  href={`/documents/${saveSuccess.docId}`}
                  style={{ color: '#22d3ee', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
                >
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
          {/* Header */}
          <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0 }}>Save to Document</h3>
            <button onClick={() => setShowSaveModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>&times;</button>
          </div>

          {/* Search input */}
          <div style={{ padding: '16px 20px' }}>
            <input
              type="text"
              value={docSearchQuery}
              onChange={e => searchDocuments(e.target.value)}
              placeholder="Search by customer name or document number..."
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', background: '#111111',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                color: '#f1f5f9', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error */}
          {saveError && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>{saveError}</div>
            </div>
          )}

          {/* Results */}
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
                      <span style={{ fontSize: '10px', fontWeight: 700, color: typeBadge.color, background: typeBadge.bg, padding: '2px 6px', borderRadius: '4px' }}>
                        {typeBadge.label}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.05)',
                        padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize',
                      }}>
                        {doc.status}
                      </span>
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
                      ...btnPrimary,
                      padding: '7px 14px', fontSize: '12px',
                      opacity: isSaving ? 0.6 : 1,
                      cursor: isSaving ? 'wait' : 'pointer',
                    }}
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

  // --- Main Layout ---

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
            Analyze, enhance, remove backgrounds, and vectorize artwork files
          </p>
        </div>

        {/* Upload Section */}
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          {!file ? (
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
              <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                Drag & drop your file here
              </div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>
                or click to browse — PNG, JPG, SVG, PDF, AI, EPS (max 20MB)
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ ...checkerboard, borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
                <img src={originalBase64 || undefined} alt="Preview" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: '4px', display: 'block' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  {file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${(file.size / 1024).toFixed(1)} KB`}
                </div>
              </div>
              <button onClick={reset} style={btnGhost}>Reset</button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </div>

        {/* Tools Grid — only visible when file is uploaded */}
        {file && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {renderAnalyzeCard()}
              {renderEnhanceCard()}
              {renderBgRemoveCard()}
              {renderVectorizeCard()}
            </div>
            {renderDownloads()}
          </>
        )}
      </div>
      {renderSaveModal()}
    </div>
  )
}
