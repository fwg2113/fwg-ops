'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

interface SvgFile {
  id: string
  filename: string
  svgContent: string
  nativeW: number
  nativeH: number
  qty: number
  widthOverride?: number // per-file width in inches; if set, overrides global designWidth
}

interface PlacedItem {
  fileId: string
  copyIndex: number
  x: number // inches
  y: number // inches
  w: number // inches
  h: number // inches
  rotation: number // degrees (0, 90, 180, 270)
}

// ── Constants ───────────────────────────────────────────────────────────────

const SHEET_WIDTH_IN = 30
const DEFAULT_SPACING_IN = 0.25
const DEFAULT_DESIGN_WIDTH_IN = 4
const PX_PER_INCH = 72

const BG_OPTIONS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Light Gray', value: '#e5e5e5' },
  { label: 'Dark Gray', value: '#333333' },
  { label: 'Checkerboard', value: 'checker' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseSvgDimensions(svgContent: string): { w: number; h: number } {
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/)
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] }
    }
  }
  const wMatch = svgContent.match(/\bwidth=["']([0-9.]+)/)
  const hMatch = svgContent.match(/\bheight=["']([0-9.]+)/)
  const w = wMatch ? parseFloat(wMatch[1]) : 100
  const h = hMatch ? parseFloat(hMatch[1]) : 100
  return { w: w || 100, h: h || 100 }
}

function stripSvgWrapper(svgContent: string): { inner: string; viewBox: string } {
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/)
  const viewBox = vbMatch ? vbMatch[1] : '0 0 100 100'
  const inner = svgContent
    .replace(/<\?xml[^?]*\?>\s*/gi, '')
    .replace(/<!DOCTYPE[^>]*>\s*/gi, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
  return { inner, viewBox }
}

function makeSvgResponsive(svgContent: string): string {
  return svgContent
    .replace(/<\?xml[^?]*\?>\s*/gi, '')
    .replace(/<!DOCTYPE[^>]*>\s*/gi, '')
    .replace(
      /<svg([^>]*)>/i,
      (_, attrs: string) => {
        const cleaned = attrs
          .replace(/\bwidth=["'][^"']*["']/gi, '')
          .replace(/\bheight=["'][^"']*["']/gi, '')
        return `<svg${cleaned} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
      }
    )
}

function autoNest(
  files: SvgFile[],
  designWidthIn: number,
  spacingIn: number,
  useRotation: boolean,
): PlacedItem[] {
  const expanded: { file: SvgFile; copyIndex: number }[] = []
  for (const file of files) {
    for (let c = 0; c < file.qty; c++) {
      expanded.push({ file, copyIndex: c })
    }
  }

  if (!useRotation) {
    return packWithRotations(expanded, designWidthIn, spacingIn, () => 0)
  }

  // Try multiple strategies, pick shortest
  const strategies = [
    // No rotation
    packWithRotations(expanded, designWidthIn, spacingIn, () => 0),
    // Landscape tall items
    packWithRotations(expanded, designWidthIn, spacingIn, (file) =>
      (file.nativeH / file.nativeW) > 1.3 ? 90 : 0
    ),
    // Alternate 0/90
    packWithRotations(expanded, designWidthIn, spacingIn, (_f, _ci, idx) =>
      idx % 2 === 1 ? 90 : 0
    ),
  ]

  let best = strategies[0]
  let bestH = getMaxHeight(best)
  for (let i = 1; i < strategies.length; i++) {
    const h = getMaxHeight(strategies[i])
    if (h < bestH) { best = strategies[i]; bestH = h }
  }
  return best
}

function getMaxHeight(placed: PlacedItem[]): number {
  let max = 0
  for (const p of placed) {
    const b = p.y + p.h
    if (b > max) max = b
  }
  return max
}

function packWithRotations(
  expanded: { file: SvgFile; copyIndex: number }[],
  designWidthIn: number,
  spacingIn: number,
  getRotation: (file: SvgFile, copyIndex: number, indexInRow: number) => number,
): PlacedItem[] {
  const placed: PlacedItem[] = []
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0
  let indexInRow = 0

  for (const { file, copyIndex } of expanded) {
    const rotation = getRotation(file, copyIndex, indexInRow)
    const fileWidth = file.widthOverride || designWidthIn
    const aspect = file.nativeH / file.nativeW
    let w: number, h: number

    if (rotation === 90 || rotation === 270) {
      h = fileWidth
      w = fileWidth * aspect
    } else {
      w = fileWidth
      h = fileWidth * aspect
    }

    if (cursorX > 0 && cursorX + w > SHEET_WIDTH_IN) {
      cursorX = 0
      cursorY += rowHeight + spacingIn
      rowHeight = 0
      indexInRow = 0
    }

    placed.push({ fileId: file.id, copyIndex, x: cursorX, y: cursorY, w, h, rotation })
    cursorX += w + spacingIn
    if (h > rowHeight) rowHeight = h
    indexInRow++
  }

  return placed
}

function buildCombinedSvg(
  files: SvgFile[],
  placed: PlacedItem[],
): string {
  let maxY = 0
  for (const p of placed) {
    const bottom = p.y + p.h
    if (bottom > maxY) maxY = bottom
  }

  const totalWidthPx = SHEET_WIDTH_IN * PX_PER_INCH
  const totalHeightPx = maxY * PX_PER_INCH
  const fileMap = new Map(files.map(f => [f.id, f]))

  const groups: string[] = []
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i]
    const file = fileMap.get(p.fileId)
    if (!file) continue

    const { inner, viewBox } = stripSvgWrapper(file.svgContent)
    const vbParts = viewBox.split(/[\s,]+/).map(Number)
    const [vbX, vbY, vbW, vbH] = vbParts

    const drawW = p.w * PX_PER_INCH
    const drawH = p.h * PX_PER_INCH
    const drawX = p.x * PX_PER_INCH
    const drawY = p.y * PX_PER_INCH

    const scaleX = drawW / vbW
    const scaleY = drawH / vbH

    // Namespace CSS classes
    let namespacedInner = inner
    const prefix = `gs${i}_`
    namespacedInner = namespacedInner.replace(
      /<style[^>]*>([\s\S]*?)<\/style>/gi,
      (_match: string, css: string) => {
        const namespacedCss = css.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, `.${prefix}$1`)
        return `<style>${namespacedCss}</style>`
      },
    )
    namespacedInner = namespacedInner.replace(
      /\bclass="([^"]+)"/g,
      (_match: string, classes: string) => {
        const namespacedClasses = classes.split(/\s+/).map((c: string) => `${prefix}${c}`).join(' ')
        return `class="${namespacedClasses}"`
      },
    )

    const centerX = drawX + drawW / 2
    const centerY = drawY + drawH / 2
    let transform: string

    if (p.rotation === 0) {
      transform = `translate(${drawX.toFixed(2)}, ${drawY.toFixed(2)}) scale(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)}) translate(${-vbX}, ${-vbY})`
    } else if (p.rotation === 180) {
      transform = `translate(${centerX.toFixed(2)}, ${centerY.toFixed(2)}) rotate(180) translate(${(-drawW / 2).toFixed(2)}, ${(-drawH / 2).toFixed(2)}) scale(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)}) translate(${-vbX}, ${-vbY})`
    } else if (p.rotation === 90) {
      const sx = drawW / vbH
      const sy = drawH / vbW
      transform = `translate(${centerX.toFixed(2)}, ${centerY.toFixed(2)}) rotate(90) translate(${(-drawH / 2).toFixed(2)}, ${(-drawW / 2).toFixed(2)}) scale(${sx.toFixed(6)}, ${sy.toFixed(6)}) translate(${-vbX}, ${-vbY})`
    } else {
      const sx = drawW / vbH
      const sy = drawH / vbW
      transform = `translate(${centerX.toFixed(2)}, ${centerY.toFixed(2)}) rotate(270) translate(${(-drawH / 2).toFixed(2)}, ${(-drawW / 2).toFixed(2)}) scale(${sx.toFixed(6)}, ${sy.toFixed(6)}) translate(${-vbX}, ${-vbY})`
    }

    groups.push(`<g transform="${transform}">\n${namespacedInner}\n</g>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${SHEET_WIDTH_IN}in" height="${maxY.toFixed(4)}in"
  viewBox="0 0 ${totalWidthPx} ${totalHeightPx.toFixed(2)}">
${groups.join('\n')}
</svg>`
}

// ── Component ───────────────────────────────────────────────────────────────

export default function GangSheetBuilder() {
  const [files, setFiles] = useState<SvgFile[]>([])
  const [designWidth, setDesignWidth] = useState(DEFAULT_DESIGN_WIDTH_IN)
  const [spacing, setSpacing] = useState(DEFAULT_SPACING_IN)
  const [placed, setPlaced] = useState<PlacedItem[]>([])
  const [canvasBg, setCanvasBg] = useState('#e5e5e5')
  const [useRotation, setUseRotation] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Load files from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('gangSheetFiles')
      if (stored) {
        sessionStorage.removeItem('gangSheetFiles')
        const parsed: { filename: string; svgContent: string }[] = JSON.parse(stored)
        const loaded: SvgFile[] = parsed.map((f, i) => {
          const dims = parseSvgDimensions(f.svgContent)
          return { id: `${Date.now()}-${i}`, filename: f.filename, svgContent: f.svgContent, nativeW: dims.w, nativeH: dims.h, qty: 1 }
        })
        setFiles(loaded)
      }
    } catch { /* ignore */ }
  }, [])

  const runAutoNest = useCallback(() => {
    if (files.length === 0) {
      setPlaced([])
      return
    }
    setPlaced(autoNest(files, designWidth, spacing, useRotation))
    setSelectedIndex(null)
  }, [files, designWidth, spacing, useRotation])

  // Auto-nest on file/config changes
  useEffect(() => { runAutoNest() }, [runAutoNest])

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: SvgFile[] = []
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.svg')) continue
      const text = await file.text()
      const dims = parseSvgDimensions(text)
      newFiles.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, filename: file.name, svgContent: text, nativeW: dims.w, nativeH: dims.h, qty: 1 })
    }
    if (newFiles.length > 0) setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files)
  }, [processFiles])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setSelectedIndex(null)
  }, [])

  const updateQty = useCallback((id: string, qty: number) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, qty: Math.max(1, Math.min(999, qty)) } : f))
  }, [])

  const updateWidthOverride = useCallback((id: string, value: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== id) return f
      if (value === '' || value === '0') {
        const { widthOverride: _, ...rest } = f
        return rest as SvgFile
      }
      const v = parseFloat(value)
      if (v > 0 && v <= SHEET_WIDTH_IN) return { ...f, widthOverride: v }
      return f
    }))
  }, [])

  const downloadGangSheet = useCallback(() => {
    if (placed.length === 0) return
    const svgString = buildCombinedSvg(files, placed)
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gang_sheet.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [files, placed])

  // Rotate selected item
  const rotateSelected = useCallback((delta: number) => {
    if (selectedIndex === null) return
    setPlaced(prev => prev.map((p, i) => {
      if (i !== selectedIndex) return p
      const newRot = ((p.rotation + delta) % 360 + 360) % 360
      // Swap w/h when going between 0/180 and 90/270
      const was90 = p.rotation === 90 || p.rotation === 270
      const is90 = newRot === 90 || newRot === 270
      if (was90 !== is90) {
        return { ...p, rotation: newRot, w: p.h, h: p.w }
      }
      return { ...p, rotation: newRot }
    }))
  }, [selectedIndex])

  // Delete selected item from placed array
  const deleteSelected = useCallback(() => {
    if (selectedIndex === null) return
    setPlaced(prev => prev.filter((_, i) => i !== selectedIndex))
    setSelectedIndex(null)
  }, [selectedIndex])

  // Move selected item in placed array
  const moveSelected = useCallback((dx: number, dy: number) => {
    if (selectedIndex === null) return
    setPlaced(prev => prev.map((p, i) => {
      if (i !== selectedIndex) return p
      return { ...p, x: Math.max(0, p.x + dx), y: Math.max(0, p.y + dy) }
    }))
  }, [selectedIndex])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedIndex === null) return
      const step = e.shiftKey ? 1 : 0.25
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); moveSelected(-step, 0); break
        case 'ArrowRight': e.preventDefault(); moveSelected(step, 0); break
        case 'ArrowUp': e.preventDefault(); moveSelected(0, -step); break
        case 'ArrowDown': e.preventDefault(); moveSelected(0, step); break
        case 'r': case 'R': rotateSelected(90); break
        case 'Delete': case 'Backspace': deleteSelected(); break
        case 'Escape': setSelectedIndex(null); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIndex, moveSelected, rotateSelected, deleteSelected])

  let sheetHeightIn = 0
  for (const p of placed) {
    const bottom = p.y + p.h
    if (bottom > sheetHeightIn) sheetHeightIn = bottom
  }
  const totalCopies = files.reduce((sum, f) => sum + f.qty, 0)

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
            Gang <span style={{ background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sheet Builder</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Arrange SVG print files on a {SHEET_WIDTH_IN}&quot; wide sheet
          </p>
        </div>
        {placed.length > 0 && (
          <button onClick={downloadGangSheet} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Download Gang Sheet SVG
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>Sheet Width:</span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{SHEET_WIDTH_IN}&quot;</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#9ca3af' }}>Design Width:</label>
          <input type="number" value={designWidth} onChange={e => { const v = parseFloat(e.target.value); if (v > 0 && v <= SHEET_WIDTH_IN) setDesignWidth(v) }} step={0.25} min={0.5} max={SHEET_WIDTH_IN} style={{ width: '70px', padding: '6px 8px', background: '#1e1e24', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#e2e8f0', fontSize: '14px', textAlign: 'center' }} />
          <span style={{ fontSize: '13px', color: '#6b7280' }}>in</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#9ca3af' }}>Spacing:</label>
          <input type="number" value={spacing} onChange={e => { const v = parseFloat(e.target.value); if (v >= 0 && v <= 5) setSpacing(v) }} step={0.125} min={0} max={5} style={{ width: '70px', padding: '6px 8px', background: '#1e1e24', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#e2e8f0', fontSize: '14px', textAlign: 'center' }} />
          <span style={{ fontSize: '13px', color: '#6b7280' }}>in</span>
        </div>
        <button
          onClick={() => setUseRotation(r => !r)}
          style={{
            padding: '3px 10px', borderRadius: '4px',
            border: useRotation ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.15)',
            background: useRotation ? 'rgba(168,85,247,0.2)' : 'transparent',
            color: useRotation ? '#c084fc' : '#9ca3af',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Auto-Rotate {useRotation ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={runAutoNest}
          style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#9ca3af', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Re-nest
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>Canvas:</span>
          {BG_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setCanvasBg(opt.value)} title={opt.label} style={{ width: '22px', height: '22px', borderRadius: '4px', border: canvasBg === opt.value ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: opt.value === 'checker' ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px' : opt.value, padding: 0 }} />
          ))}
        </div>
        {placed.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Sheet:</span>
            <span style={{ fontSize: '14px', fontWeight: 600, background: 'linear-gradient(90deg, #22d3ee, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {SHEET_WIDTH_IN}&quot; &times; {sheetHeightIn.toFixed(2)}&quot;
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>
              ({totalCopies} design{totalCopies !== 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>

      {/* Selected item toolbar */}
      {selectedIndex !== null && placed[selectedIndex] && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', marginBottom: '16px',
          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px',
        }}>
          <span style={{ fontSize: '13px', color: '#c084fc', fontWeight: 600 }}>
            Selected: {files.find(f => f.id === placed[selectedIndex!].fileId)?.filename || 'Design'}
          </span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {placed[selectedIndex].w.toFixed(2)}&quot; &times; {placed[selectedIndex].h.toFixed(2)}&quot;
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>W:</span>
            <input
              type="number"
              value={(() => {
                const f = files.find(f => f.id === placed[selectedIndex!].fileId)
                return f?.widthOverride ?? ''
              })()}
              placeholder={String(designWidth)}
              onChange={e => {
                const fileId = placed[selectedIndex!].fileId
                updateWidthOverride(fileId, e.target.value)
              }}
              step={0.25} min={0.5} max={SHEET_WIDTH_IN}
              style={{ width: '52px', padding: '2px 4px', background: '#1e1e24', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#e2e8f0', fontSize: '12px', textAlign: 'center' }}
            />
            <span style={{ fontSize: '11px', color: '#6b7280' }}>in</span>
          </div>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            Rot: {placed[selectedIndex].rotation}°
          </span>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            <button onClick={() => rotateSelected(-90)} title="Rotate CCW" style={smallBtnStyle}>↺ 90°</button>
            <button onClick={() => rotateSelected(90)} title="Rotate CW" style={smallBtnStyle}>↻ 90°</button>
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            <button onClick={() => moveSelected(-0.25, 0)} title="Move left" style={smallBtnStyle}>←</button>
            <button onClick={() => moveSelected(0.25, 0)} title="Move right" style={smallBtnStyle}>→</button>
            <button onClick={() => moveSelected(0, -0.25)} title="Move up" style={smallBtnStyle}>↑</button>
            <button onClick={() => moveSelected(0, 0.25)} title="Move down" style={smallBtnStyle}>↓</button>
          </div>
          <button onClick={deleteSelected} style={{ ...smallBtnStyle, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>Delete</button>
          <button onClick={() => setSelectedIndex(null)} style={{ ...smallBtnStyle, marginLeft: 'auto' }}>Deselect</button>
          <span style={{ fontSize: '11px', color: '#4b5563' }}>Arrow keys to move &middot; R to rotate &middot; Esc to deselect</span>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Left panel */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '32px 16px', border: `2px dashed ${dragOver ? '#a855f7' : 'rgba(255,255,255,0.15)'}`, borderRadius: '10px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.02)', transition: 'all 0.15s ease' }}
          >
            <input ref={fileInputRef} type="file" accept=".svg" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = '' }} />
            <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" style={{ width: 32, height: 32, margin: '0 auto 8px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>Drop SVG files here or click to browse</div>
          </div>

          {files.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', color: '#9ca3af', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                <span>{totalCopies} total</span>
              </div>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {files.map(f => (
                  <div key={f.id} style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ flex: 1, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
                      <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>qty:</span>
                      <input type="number" value={f.qty} onChange={e => updateQty(f.id, parseInt(e.target.value) || 1)} min={1} max={999} style={{ width: '42px', padding: '2px 4px', background: '#1e1e24', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#e2e8f0', fontSize: '12px', textAlign: 'center', flexShrink: 0 }} />
                      <button onClick={() => removeFile(f.id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                          <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                          <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', paddingLeft: '20px' }}>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>width:</span>
                      <input
                        type="number"
                        value={f.widthOverride ?? ''}
                        placeholder={String(designWidth)}
                        onChange={e => updateWidthOverride(f.id, e.target.value)}
                        step={0.25} min={0.5} max={SHEET_WIDTH_IN}
                        style={{ width: '52px', padding: '2px 4px', background: f.widthOverride ? '#1a1a2e' : '#1e1e24', border: `1px solid ${f.widthOverride ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', color: f.widthOverride ? '#c084fc' : '#6b7280', fontSize: '11px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>in</span>
                      {f.widthOverride && (
                        <button onClick={() => updateWidthOverride(f.id, '')} title="Reset to global" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0 2px', fontSize: '11px' }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <button onClick={() => { setFiles([]); setPlaced([]); setSelectedIndex(null) }} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', cursor: 'pointer' }}>
              Clear All
            </button>
          )}
        </div>

        {/* Center - sheet preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {placed.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', color: '#4b5563', fontSize: '14px' }}>
              Upload SVG files to preview the gang sheet layout
            </div>
          ) : (
            <SheetPreview
              files={files}
              placed={placed}
              setPlaced={setPlaced}
              sheetHeightIn={sheetHeightIn}
              canvasBg={canvasBg}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const smallBtnStyle: React.CSSProperties = {
  padding: '3px 8px', borderRadius: '4px',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e2e8f0', fontSize: '12px', cursor: 'pointer',
}

// ── Sheet Preview ───────────────────────────────────────────────────────────

function SheetPreview({
  files, placed, setPlaced, sheetHeightIn, canvasBg, selectedIndex, setSelectedIndex,
}: {
  files: SvgFile[]
  placed: PlacedItem[]
  setPlaced: React.Dispatch<React.SetStateAction<PlacedItem[]>>
  sheetHeightIn: number
  canvasBg: string
  selectedIndex: number | null
  setSelectedIndex: (idx: number | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const dragRef = useRef<{ idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const didInteractRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const scale = containerWidth / SHEET_WIDTH_IN
  const previewHeight = sheetHeightIn * scale
  const fileMap = new Map(files.map(f => [f.id, f]))

  const bgStyle: React.CSSProperties = canvasBg === 'checker'
    ? { background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 16px 16px' }
    : { background: canvasBg }

  const totalCopies = files.reduce((sum, f) => sum + f.qty, 0)

  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    didInteractRef.current = true
    setSelectedIndex(idx)
    const p = placed[idx]
    dragRef.current = { idx, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y }

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const dx = (me.clientX - dragRef.current.startX) / scale
      const dy = (me.clientY - dragRef.current.startY) / scale
      const newX = Math.max(0, dragRef.current.origX + dx)
      const newY = Math.max(0, dragRef.current.origY + dy)
      setPlaced(prev => prev.map((p, i) => i === dragRef.current!.idx ? { ...p, x: newX, y: newY } : p))
    }

    const handleMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [placed, scale, setPlaced, setSelectedIndex])

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div
        onMouseDown={() => {
          // Deselect only if the click is on the background, not on a design
          // The design's onMouseDown sets didInteractRef before this fires
          requestAnimationFrame(() => {
            if (!didInteractRef.current) {
              setSelectedIndex(null)
            }
            didInteractRef.current = false
          })
        }}
        style={{
          position: 'relative', width: '100%', height: `${Math.max(previewHeight, 200)}px`,
          ...bgStyle, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', cursor: 'default',
        }}
      >
        {placed.map((p, i) => {
          const file = fileMap.get(p.fileId)
          if (!file) return null
          const isSelected = selectedIndex === i
          const rotation = p.rotation || 0
          return (
            <div
              key={`${p.fileId}-${p.copyIndex}-${i}`}
              onMouseDown={e => handleMouseDown(e, i)}
              style={{
                position: 'absolute',
                left: `${p.x * scale}px`,
                top: `${p.y * scale}px`,
                width: `${p.w * scale}px`,
                height: `${p.h * scale}px`,
                overflow: 'hidden',
                cursor: 'grab',
                outline: isSelected ? '2px solid #a855f7' : 'none',
                outlineOffset: '1px',
                zIndex: isSelected ? 10 : 1,
              }}
            >
              <div
                style={{
                  width: rotation === 90 || rotation === 270 ? `${p.h * scale}px` : '100%',
                  height: rotation === 90 || rotation === 270 ? `${p.w * scale}px` : '100%',
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                  transformOrigin: 'center center',
                  position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%',
                  pointerEvents: 'none',
                }}
                dangerouslySetInnerHTML={{ __html: makeSvgResponsive(file.svgContent) }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '13px', color: '#6b7280' }}>
        {SHEET_WIDTH_IN}&quot; &times; {sheetHeightIn.toFixed(2)}&quot; &mdash; {totalCopies} design{totalCopies !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
