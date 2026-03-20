'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ImagePrepState } from './useImagePrepState'

// ── SVG color extraction ──

function extractSvgColors(svgText: string): string[] {
  const colors = new Set<string>()
  const skip = new Set(['none', 'transparent', 'inherit', 'currentcolor', 'url'])

  const namedColorMap: Record<string, string> = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
    blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
    gray: '#808080', grey: '#808080', pink: '#ffc0cb', brown: '#a52a2a',
    cyan: '#00ffff', magenta: '#ff00ff', lime: '#00ff00', navy: '#000080',
    teal: '#008080', maroon: '#800000', olive: '#808000', silver: '#c0c0c0',
    aqua: '#00ffff', fuchsia: '#ff00ff',
  }

  // 1. Match hex colors (#rgb, #rrggbb) — works in attributes, CSS <style> blocks, and inline styles
  const hexMatches = svgText.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g)
  if (hexMatches) {
    for (const hex of hexMatches) {
      const normalized = hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex
      colors.add(normalized.toLowerCase())
    }
  }

  // 2. Match rgb/rgba colors
  const rgbMatches = svgText.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)
  if (rgbMatches) {
    for (const rgb of rgbMatches) {
      const parts = rgb.match(/\d+/g)
      if (parts && parts.length >= 3) {
        const hex = `#${Number(parts[0]).toString(16).padStart(2, '0')}${Number(parts[1]).toString(16).padStart(2, '0')}${Number(parts[2]).toString(16).padStart(2, '0')}`
        colors.add(hex.toLowerCase())
      }
    }
  }

  // 3. Match named colors in fill/stroke attributes AND CSS properties (covers <style> blocks)
  //    Patterns: fill="black", fill:black, fill: black;, stroke="red", fill='blue'
  const colorPropRegex = /(?:fill|stroke|stop-color|color)\s*[:=]\s*['"]?\s*([a-zA-Z]+)\b/gi
  let match
  while ((match = colorPropRegex.exec(svgText)) !== null) {
    const name = match[1].toLowerCase()
    if (!skip.has(name) && namedColorMap[name]) {
      colors.add(namedColorMap[name])
    }
  }

  // 4. If SVG has visible path/shape elements but no explicit colors found,
  //    black is the default fill in SVG — add it
  if (colors.size === 0) {
    const hasVisibleElements = /<(?:path|rect|circle|ellipse|polygon|polyline|line|text)\b/i.test(svgText)
    if (hasVisibleElements) {
      colors.add('#000000')
    }
  }

  // Remove pure white — rarely useful for DTF (transparent background means white isn't printed)
  // But keep it if it's one of very few colors (might be intentional)
  if (colors.size > 2) {
    colors.delete('#ffffff')
  }

  return Array.from(colors)
}

// Reverse map: hex → named color names
const hexToNames: Record<string, string[]> = {
  '#ffffff': ['white'], '#000000': ['black'], '#ff0000': ['red'], '#008000': ['green'],
  '#0000ff': ['blue'], '#ffff00': ['yellow'], '#ffa500': ['orange'], '#800080': ['purple'],
  '#808080': ['gray', 'grey'], '#ffc0cb': ['pink'], '#a52a2a': ['brown'],
  '#00ffff': ['cyan', 'aqua'], '#ff00ff': ['magenta', 'fuchsia'], '#00ff00': ['lime'],
  '#000080': ['navy'], '#008080': ['teal'], '#800000': ['maroon'], '#808000': ['olive'],
  '#c0c0c0': ['silver'],
}

function replaceSvgColor(svgText: string, sourceHex: string, targetHex: string): string {
  const srcLower = sourceHex.toLowerCase()
  const srcUpper = sourceHex.toUpperCase()

  // 3-char shorthand version if applicable
  let src3 = ''
  if (srcLower[1] === srcLower[2] && srcLower[3] === srcLower[4] && srcLower[5] === srcLower[6]) {
    src3 = `#${srcLower[1]}${srcLower[3]}${srcLower[5]}`
  }

  let result = svgText
  // Replace hex values (case-insensitive)
  result = result.split(srcLower).join(targetHex)
  result = result.split(srcUpper).join(targetHex)
  if (src3) {
    result = result.split(src3).join(targetHex)
    result = result.split(src3.toUpperCase()).join(targetHex)
  }

  // Also replace named color equivalents (e.g., fill="black" → fill="#ff0000")
  const names = hexToNames[srcLower]
  if (names) {
    for (const name of names) {
      const attrRegex = new RegExp(`((?:fill|stroke|stop-color|color)\\s*[:=]\\s*['"]?)${name}\\b`, 'gi')
      result = result.replace(attrRegex, `$1${targetHex}`)
    }
  }

  // Handle implicit black: if replacing #000000 and the SVG has elements without explicit fill,
  // add fill="targetHex" to path/shape elements that don't have a fill attribute.
  // SVG spec: elements without fill default to black.
  if (srcLower === '#000000') {
    result = result.replace(
      /(<(?:path|rect|circle|ellipse|polygon|polyline|line|text)\b)(?![^>]*\bfill\s*=)/gi,
      `$1 fill="${targetHex}"`
    )
    // Also handle CSS: if there's a <style> block, add a rule for the target color
    if (!result.includes('fill:') && !result.includes('fill=')) {
      // No fills anywhere — all elements use default black, add fill to <svg> tag
      result = result.replace(/(<svg\b[^>]*)>/i, `$1 fill="${targetHex}">`)
    }
  }

  return result
}

// ── Panel ──

export function ColorsPanel({ state }: { state: ImagePrepState }) {
  const { current, colorReplacedUrls, setColorReplacedUrls } = state

  // Detect SVG: check file type, extension, or objectUrl data URI
  const isSvg = current.originalFile.type === 'image/svg+xml'
    || current.fileName.toLowerCase().endsWith('.svg')
    || current.objectUrl.startsWith('data:image/svg+xml')

  if (isSvg) {
    return <SvgColorReplace state={state} />
  }
  return <RasterColorReplace state={state} />
}

// ── SVG Color Swatch Grid ──

function SvgColorReplace({ state }: { state: ImagePrepState }) {
  const { current, colorReplacedUrls, setColorReplacedUrls, onApplyLocalEdit } = state

  const [svgText, setSvgText] = useState<string | null>(null)
  const [svgLoadFailed, setSvgLoadFailed] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [targetColor, setTargetColor] = useState('#ff0000')
  const loadedForIdRef = useRef<string | null>(null)

  // Stable references for the loading function (avoids re-triggering on analysis updates)
  const currentRef = useRef(current)
  currentRef.current = current

  // Load SVG text — only re-runs when the image ID changes, not on every state update
  useEffect(() => {
    // Skip if already loaded for this image
    if (loadedForIdRef.current === current.id && svgText) return

    let cancelled = false
    setSvgText(null)
    setSvgLoadFailed(false)

    const looksLikeSvg = (t: string) =>
      t.length > 10 && (t.trimStart().startsWith('<svg') || t.trimStart().startsWith('<?xml') || t.includes('<svg'))

    const loadSvg = async () => {
      const img = currentRef.current

      // 1. Try objectUrl if it's an SVG data URL
      if (img.objectUrl.startsWith('data:image/svg+xml')) {
        try {
          const text = atob(img.objectUrl.split(',')[1] ?? '')
          if (!cancelled && looksLikeSvg(text)) {
            loadedForIdRef.current = img.id
            setSvgText(text)
            return
          }
        } catch { /* fall through */ }
      }

      // 2. Try reading the original File object
      try {
        if (img.originalFile.size > 0) {
          const text = await img.originalFile.text()
          if (!cancelled && looksLikeSvg(text)) {
            loadedForIdRef.current = img.id
            setSvgText(text)
            return
          }
        }
      } catch { /* fall through */ }

      // 3. Try blob URL
      if (img.objectUrl.startsWith('blob:')) {
        try {
          const resp = await fetch(img.objectUrl)
          const text = await resp.text()
          if (!cancelled && looksLikeSvg(text)) {
            loadedForIdRef.current = img.id
            setSvgText(text)
            return
          }
        } catch { /* fall through */ }
      }

      // All methods exhausted
      if (!cancelled) setSvgLoadFailed(true)
    }

    const timer = setTimeout(() => { if (!cancelled) setSvgLoadFailed(true) }, 8000)
    loadSvg().finally(() => clearTimeout(timer))
    return () => { cancelled = true; clearTimeout(timer) }
    // Only depend on image ID — not objectUrl/originalFile which change on every analysis update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id])

  // Extract unique colors from SVG
  const svgColors = useMemo(() => {
    if (!svgText) return []
    return extractSvgColors(svgText)
  }, [svgText])

  const applyReplace = useCallback(() => {
    if (!svgText || !selectedColor) return

    // Get current working SVG text (apply on top of previous replacements if any)
    const workingText = svgText
    const replaced = replaceSvgColor(workingText, selectedColor, targetColor)

    // Rasterize the modified SVG to PNG for preview
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(replaced)))}`

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = current.nativeWidth
      canvas.height = current.nativeHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/png')
      setColorReplacedUrls(prev => ({ ...prev, [current.id]: dataUrl }))

      // Push the change to the canvas immediately
      if (onApplyLocalEdit) {
        onApplyLocalEdit(current.id, dataUrl, current.nativeWidth, current.nativeHeight)
      }

      // Update SVG text for further edits and re-extract colors
      setSvgText(replaced)
      setSelectedColor(null)
    }
    img.onerror = () => {
      // SVG rasterization failed — likely encoding issue
      console.warn('[ColorsPanel] Failed to rasterize modified SVG')
    }
    img.src = svgDataUrl
  }, [svgText, selectedColor, targetColor, current, setColorReplacedUrls])

  if (!svgText) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
        <p className="text-[12px] text-white/40">
          {svgLoadFailed ? 'Could not load SVG data for color editing.' : 'Loading SVG...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 min-h-0">
      {/* Info */}
      <div className="px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/10">
        <p className="text-[11px] text-blue-400 leading-snug">
          Preview background is for viewing only. It does not affect your print file.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-[14px] font-semibold text-white/80">Color Replace</h3>
        <p className="text-[11px] text-white/40 leading-snug">
          Select a color from your SVG to replace it with a new color.
        </p>

        {svgColors.length === 0 ? (
          <p className="text-[11px] text-white/30 italic">No colors detected in SVG</p>
        ) : (
          <>
            {/* Color swatches */}
            <p className="text-[11px] text-white/50 mb-1">Click a color to replace it:</p>
            <div className="flex flex-wrap gap-2">
              {svgColors.map(color => {
                const isSelected = selectedColor === color
                const isDark = color === '#000000' || color === '#000080' || color === '#800000' || color === '#800080'
                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(isSelected ? null : color)}
                    className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-[#e41e31]/20 border-2 border-[#e41e31] scale-105'
                        : 'bg-white/[0.06] border-2 border-white/20 hover:border-white/40 hover:scale-105'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-md ${isDark ? 'border border-white/30' : 'border border-white/10'}`}
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[9px] font-mono text-white/50">{color}</span>
                  </button>
                )
              })}
            </div>

            {/* Replace controls — shown when a swatch is selected */}
            {selectedColor && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-white/50">From:</span>
                    <div className="w-6 h-6 rounded border border-white/10" style={{ backgroundColor: selectedColor }} />
                    <span className="text-[11px] text-white/40 font-mono">{selectedColor}</span>
                  </div>
                  <svg className="w-4 h-4 text-white/25 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-white/50">To:</span>
                    <input
                      type="color"
                      value={targetColor}
                      onChange={e => setTargetColor(e.target.value)}
                      className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                    />
                    <span className="text-[11px] text-white/40 font-mono">{targetColor}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={applyReplace}
                    className="flex-1 px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#e41e31] text-white transition-all hover:brightness-115 hover:scale-[1.02]"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setSelectedColor(null)}
                    className="px-4 py-2 text-[13px] font-medium rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.03] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Applied indicator */}
      {colorReplacedUrls[current.id] && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Color replacement applied
        </div>
      )}
    </div>
  )
}

// ── Raster Eyedropper Color Replace ──

function RasterColorReplace({ state }: { state: ImagePrepState }) {
  const { current, colorReplacedUrls, setColorReplacedUrls } = state

  const [active, setActive] = useState(false)
  const [sampledColor, setSampledColor] = useState<string | null>(null)
  const [targetColor, setTargetColor] = useState('#ff0000')
  const [tolerance, setTolerance] = useState(30)

  const applyColorReplace = useCallback(async () => {
    if (!sampledColor) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = colorReplacedUrls[current.id] ?? current.previewUrl ?? current.objectUrl
    })
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const srcR = parseInt(sampledColor.slice(1, 3), 16)
    const srcG = parseInt(sampledColor.slice(3, 5), 16)
    const srcB = parseInt(sampledColor.slice(5, 7), 16)
    const tgtR = parseInt(targetColor.slice(1, 3), 16)
    const tgtG = parseInt(targetColor.slice(3, 5), 16)
    const tgtB = parseInt(targetColor.slice(5, 7), 16)
    const tol = tolerance * 2.55 // Map 0-100 to 0-255

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - srcR
      const dg = data[i + 1] - srcG
      const db = data[i + 2] - srcB
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)
      if (dist <= tol) {
        data[i] = tgtR
        data[i + 1] = tgtG
        data[i + 2] = tgtB
      }
    }

    ctx.putImageData(imageData, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    setColorReplacedUrls(prev => ({ ...prev, [current.id]: dataUrl }))
    setActive(false)
    setSampledColor(null)
  }, [sampledColor, targetColor, tolerance, current, colorReplacedUrls, setColorReplacedUrls])

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 min-h-0">
      {/* Info */}
      <div className="px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/10">
        <p className="text-[11px] text-blue-400 leading-snug">
          Preview background is for viewing only. It does not affect your print file.
        </p>
      </div>

      {/* Color Replace */}
      <div className="space-y-2">
        <h3 className="text-[14px] font-semibold text-white/80">Color Replace</h3>
        <p className="text-[11px] text-white/40 leading-snug">
          Pick a color from your image, then choose a replacement color.
        </p>

        <button
          onClick={() => setActive(true)}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition-all ${
            active
              ? 'border-[#e41e31]/30 bg-[#e41e31]/[0.06] text-[#e41e31]'
              : 'border-white/10 text-white/50 hover:border-white/20'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11l-3 3m0 0l-3-3m3 3V4m0 16a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          Pick Source Color
        </button>

        {active && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
            {sampledColor && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-white/50">Source:</span>
                <div className="w-6 h-6 rounded border border-white/10" style={{ backgroundColor: sampledColor }} />
                <span className="text-[11px] text-white/40 font-mono">{sampledColor}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-white/50">Target:</span>
              <input
                type="color"
                value={targetColor}
                onChange={e => setTargetColor(e.target.value)}
                className="w-6 h-6 rounded border border-white/10 cursor-pointer"
              />
              <span className="text-[11px] text-white/40 font-mono">{targetColor}</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/50">Tolerance: {tolerance}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={tolerance}
                onChange={e => setTolerance(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-fa-red mt-1"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={applyColorReplace}
                disabled={!sampledColor}
                className="flex-1 px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#e41e31] text-white transition-all hover:brightness-115 hover:scale-[1.02] disabled:opacity-40"
              >
                Apply
              </button>
              <button
                onClick={() => { setActive(false); setSampledColor(null) }}
                className="px-4 py-2 text-[13px] font-medium rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.03] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Applied indicator */}
      {colorReplacedUrls[current.id] && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Color replacement applied
        </div>
      )}
    </div>
  )
}
