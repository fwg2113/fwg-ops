'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import JSZip from 'jszip'
import opentype from 'opentype.js'
import { renderDSTFile, parseDST, renderDSTToCanvas } from '@/app/lib/dstParser'
import { pdfToImage } from '@/app/lib/pdfToImage'
import { ImagePrepModal } from '@/app/components/shared/image-tools/ImagePrepModal'
import type { UploadedImage } from '@/app/components/shared/image-tools/types'
import { analyzeImage } from '@/app/(dashboard)/image-enhancer/utils/analyzeImage'
import { trimTransparency } from '@/app/(dashboard)/image-enhancer/utils/trimTransparency'

type Location = 'Front' | 'Back' | 'Sleeves'

interface Logo {
  id: string
  url: string
  originalUrl: string // Store original before background removal
  backgroundRemoved: boolean
  location: Location
  x: number
  y: number
  width: number
  height: number
  rotation: number
  isSvg: boolean
  svgContent?: string // Original SVG content
  colorMap?: { [originalColor: string]: string } // Map of original colors to new colors
  aspectRatio?: number // width / height of the actual image
  isDst?: boolean // Whether this is a DST embroidery file
  dstBuffer?: ArrayBuffer // Raw DST file data for re-rendering
  threadColor?: string // Current thread color for DST files
  isPlaceholder?: boolean // Whether this is a "YOUR LOGO HERE" placeholder
}

interface TextElement {
  id: string
  text: string
  location: Location
  x: number
  y: number
  fontSize: number // in pixels
  fontFamily: string
  color: string
  rotation: number
  textAlign: 'left' | 'center' | 'right' | 'justify'
  fontWeight: number // 300 (thin), 400 (normal), 700 (bold)
  strokeColor: string
  strokeWidth: number // 0 = no stroke
  strokeJoin: 'round' | 'bevel' | 'miter'
  strokeCap: 'round' | 'butt' | 'square'
  lineSpacing: number // multiplier, default 1.25
  offsetPathWidth: number // 0 = no offset path
  offsetPathColor: string
  sourceProjectFile?: string // filename of the project file this was loaded from
  isVariable?: boolean // marks this text as a roster variable
  variableName?: string // label shown in roster table header (e.g. "Player Name", "Number")
}

interface RosterEntry {
  id: string
  values: Record<string, string> // variableName → value
}

interface MockupImage {
  location: Location
  dataUrl: string
}

interface GarmentMockupBuilderProps {
  garmentImageUrl: string
  garmentImageUrls?: {
    Front: string
    Back: string
    Sleeves: string
  }
  garmentName: string
  colorName: string
  initialLogos?: Logo[]
  initialTextElements?: TextElement[]
  initialRoster?: RosterEntry[]
  onSave: (mockups: MockupImage[], logos: Logo[], textElements: TextElement[], roster?: RosterEntry[]) => void
  onSaveConfig: (logos: Logo[], textElements: TextElement[], roster?: RosterEntry[]) => void
  onClose: () => void
  onFileUpload?: (file: File) => void
  onSaveTextArtwork?: (pngFile: File, jsonFile: File, replaceFilenames?: string[]) => Promise<void>
  projectFiles?: Array<{ url: string; thumbnail_url?: string; filename: string; contentType?: string }>
  onGeneratePrints?: (roster: RosterEntry[], textElements: TextElement[], logos: Logo[]) => Promise<void>
  documentId?: string
  customerId?: string
  orderNumber?: string
}

export default function GarmentMockupBuilder({
  garmentImageUrl,
  garmentImageUrls,
  garmentName,
  colorName,
  initialLogos,
  initialTextElements,
  initialRoster,
  onSave,
  onSaveConfig,
  onClose,
  onFileUpload,
  onSaveTextArtwork,
  projectFiles = [],
  onGeneratePrints,
  documentId,
  customerId,
  orderNumber,
}: GarmentMockupBuilderProps) {
  const [activeLocation, setActiveLocation] = useState<Location>('Front')
  const [logos, setLogos] = useState<Logo[]>(initialLogos || [])
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null)
  const [textElements, setTextElements] = useState<TextElement[]>(initialTextElements || [])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [canvasDragOver, setCanvasDragOver] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(480)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [resizeStartFontSize, setResizeStartFontSize] = useState(48)
  const [showProjectFiles, setShowProjectFiles] = useState(false)
  const [loadingProjectFile, setLoadingProjectFile] = useState<string | null>(null)

  // Roster / Team Design state
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster || [])
  const [showRosterPanel, setShowRosterPanel] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [generatingPrints, setGeneratingPrints] = useState(false)
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
  const [lastGeneratedSvgs, setLastGeneratedSvgs] = useState<{ filename: string; svgContent: string }[]>([])
  const [showVariableBadges, setShowVariableBadges] = useState(true)
  const router = useRouter()

  // Zoom & pan state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [panStartOffset, setPanStartOffset] = useState({ x: 0, y: 0 })

  const [isSavingMockup, setIsSavingMockup] = useState(false)

  // AI Enhance modal state
  const [enhanceLogoId, setEnhanceLogoId] = useState<string | null>(null)
  const [enhanceImage, setEnhanceImage] = useState<UploadedImage | null>(null)
  const [enhanceAiState, setEnhanceAiState] = useState<Record<string, { removingBg?: boolean; upscaling?: boolean; vectorizing?: boolean }>>({})

  const LOCATIONS: Location[] = ['Front', 'Back', 'Sleeves']

  // Get image URL for current location based on garmentImageUrls
  const frontImageUrl = garmentImageUrls?.Front || garmentImageUrl
  const backImageUrl = garmentImageUrls?.Back
  const sleeveImageUrl = garmentImageUrls?.Sleeves

  // Get image URL for current location
  const getLocationImageUrl = (location: Location): string => {
    switch (location) {
      case 'Front':
        return frontImageUrl
      case 'Back':
        return backImageUrl || frontImageUrl
      case 'Sleeves':
        return sleeveImageUrl || frontImageUrl
    }
  }

  const currentImageUrl = getLocationImageUrl(activeLocation)

  // Font list organized by category
  const FONT_CATEGORIES: { label: string; fonts: string[] }[] = [
    { label: 'Sans Serif', fonts: [
      'Arial', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Poppins',
      'Raleway', 'Nunito', 'Inter', 'Outfit', 'Quicksand',
    ]},
    { label: 'Display', fonts: [
      'Oswald', 'Bebas Neue', 'Anton', 'Righteous', 'Russo One',
      'Bungee', 'Permanent Marker', 'Bangers', 'Black Ops One', 'Teko',
    ]},
    { label: 'Serif', fonts: [
      'Georgia', 'Times New Roman', 'Playfair Display', 'Merriweather',
      'Lora', 'Cormorant Garamond',
    ]},
    { label: 'Script', fonts: [
      'Pacifico', 'Lobster', 'Dancing Script', 'Great Vibes',
      'Satisfy', 'Sacramento', 'Caveat',
    ]},
    { label: 'Monospace', fonts: [
      'Roboto Mono', 'Source Code Pro', 'Space Mono',
    ]},
  ]

  // Flat list for lookup
  const ALL_FONTS = FONT_CATEGORIES.flatMap(c => c.fonts)

  // Render a dilated text layer on canvas by drawing text at many offsets in concentric rings.
  // Used for both stroke and offset path — produces smooth, artifact-free outlines.
  const renderDilatedTextOnCanvas = (
    ctx: CanvasRenderingContext2D,
    lines: string[],
    color: string,
    radius: number,
    anchorX: number,
    startY: number,
    lineHeight: number,
  ) => {
    if (radius <= 0) return
    ctx.save()
    ctx.fillStyle = color
    const rings = Math.max(3, Math.ceil(radius))
    for (let r = 1; r <= rings; r++) {
      const rad = (radius * r) / rings
      const steps = Math.max(16, Math.ceil(rad * 8))
      for (let s = 0; s < steps; s++) {
        const angle = (2 * Math.PI * s) / steps
        const dx = Math.cos(angle) * rad
        const dy = Math.sin(angle) * rad
        for (let i = 0; i < lines.length; i++) {
          const ly = startY + i * lineHeight
          ctx.fillText(lines[i], anchorX + dx, ly + dy)
        }
      }
    }
    ctx.restore()
  }

  // Google Fonts that need loading (exclude system fonts)
  const SYSTEM_FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Impact']
  const GOOGLE_FONT_NAMES = ALL_FONTS.filter(f => !SYSTEM_FONTS.includes(f))

  // Load Google Fonts dynamically
  useEffect(() => {
    const families = GOOGLE_FONT_NAMES.map(f =>
      `family=${f.replace(/ /g, '+')}:wght@300;400;700`
    ).join('&')
    const link = document.createElement('link')
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    return () => {
      document.head.removeChild(link)
    }
  }, [])

  // Placement presets for common decoration locations
  const PLACEMENT_PRESETS = [
    { name: 'Left Chest', x: 0.15, y: 0.2, width: 0.15 },
    { name: 'Full Front', x: 0.3, y: 0.3, width: 0.4 },
    { name: 'Back', x: 0.3, y: 0.2, width: 0.4 },
    { name: 'Left Sleeve', x: 0.05, y: 0.35, width: 0.12 },
  ]

  // Convert any CSS color string to hex
  const colorToHex = (color: string): string => {
    const trimmed = color.trim()
    // Already hex
    if (trimmed.startsWith('#')) {
      // Normalize shorthand (#000 → #000000)
      if (trimmed.length === 4) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
      }
      return trimmed.toLowerCase()
    }
    // Use canvas to convert named colors, rgb(), etc. to hex
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return trimmed
    ctx.fillStyle = trimmed
    return ctx.fillStyle // Always returns #rrggbb
  }

  const isSkipColor = (c: string): boolean => {
    const lower = c.trim().toLowerCase()
    return ['none', 'transparent', 'currentcolor', 'inherit'].includes(lower) ||
      lower.startsWith('url(') || lower.startsWith('var(')
  }

  // Extract unique colors from SVG content using DOM parsing for accuracy
  const extractSvgColors = (svgContent: string): string[] => {
    const colors = new Set<string>()

    // Render SVG offscreen so the browser resolves CSS classes, inheritance, defaults
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden'
    container.innerHTML = svgContent
    document.body.appendChild(container)

    try {
      const skipTags = new Set([
        'svg', 'defs', 'title', 'desc', 'metadata', 'style',
        'clippath', 'mask', 'pattern', 'lineargradient',
        'radialgradient', 'stop', 'symbol', 'filter',
        'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix',
      ])

      const elements = container.querySelectorAll('svg *')
      for (const el of elements) {
        if (skipTags.has(el.tagName.toLowerCase())) continue

        const computed = getComputedStyle(el)

        // Check fill (getComputedStyle returns rgb() format)
        const fill = computed.fill
        if (fill && !isSkipColor(fill)) {
          colors.add(colorToHex(fill))
        }

        // Check stroke
        const stroke = computed.stroke
        if (stroke && !isSkipColor(stroke)) {
          colors.add(colorToHex(stroke))
        }
      }
    } finally {
      document.body.removeChild(container)
    }

    return Array.from(colors)
  }

  // Get all possible text representations of a hex color for SVG replacement
  const getColorVariants = (hexColor: string): string[] => {
    const variants = [hexColor, hexColor.toUpperCase()]

    // Shorthand hex (e.g., #000000 → #000)
    if (hexColor.length === 7 &&
        hexColor[1] === hexColor[2] && hexColor[3] === hexColor[4] && hexColor[5] === hexColor[6]) {
      const short = `#${hexColor[1]}${hexColor[3]}${hexColor[5]}`
      variants.push(short, short.toUpperCase())
    }

    // rgb() variants
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)
    variants.push(`rgb(${r},${g},${b})`, `rgb(${r}, ${g}, ${b})`)

    // Common named colors
    const namedColors: Record<string, string> = {
      '#000000': 'black', '#ffffff': 'white', '#ff0000': 'red',
      '#00ff00': 'lime', '#0000ff': 'blue', '#ffff00': 'yellow',
      '#808080': 'gray', '#c0c0c0': 'silver', '#800000': 'maroon',
      '#008000': 'green', '#800080': 'purple', '#000080': 'navy',
      '#ffa500': 'orange',
    }
    const named = namedColors[hexColor.toLowerCase()]
    if (named) variants.push(named)

    return [...new Set(variants)]
  }

  // Apply color mapping to SVG content using DOM manipulation for accuracy.
  // This handles implicit colors (e.g. default black with no fill attribute)
  // that pure regex replacement would miss.
  const applySvgColorMap = (svgContent: string, colorMap: { [key: string]: string }): string => {
    // Build lookup: normalized hex → new color
    const lookup = new Map<string, string>()
    for (const [orig, replacement] of Object.entries(colorMap)) {
      if (orig !== replacement) {
        lookup.set(orig.toLowerCase(), replacement)
      }
    }
    if (lookup.size === 0) return svgContent

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')

    // Check parse errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      console.warn('SVG parse error, falling back to regex replacement')
      return applySvgColorMapRegex(svgContent, colorMap)
    }

    const skipTags = new Set([
      'svg', 'defs', 'title', 'desc', 'metadata', 'style',
      'clippath', 'mask', 'pattern', 'lineargradient',
      'radialgradient', 'stop', 'symbol', 'filter',
    ])

    // Helper: normalize a raw color value to hex and look up replacement
    const getReplacement = (raw: string): string | null => {
      if (isSkipColor(raw)) return null
      const hex = colorToHex(raw)
      return lookup.get(hex) ?? null
    }

    // 1. Collect CSS classes that already define a fill (so we don't
    //    incorrectly treat those elements as implicit-black).
    const classesWithFill = new Set<string>()
    const styleTags = doc.querySelectorAll('style')
    for (const tag of styleTags) {
      const css = tag.textContent || ''
      const matches = css.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{[^}]*fill\s*:/g)
      for (const m of matches) classesWithFill.add(m[1])
    }

    // 2. Replace colors in <style> tag CSS rules
    for (const tag of styleTags) {
      let css = tag.textContent || ''
      css = css.replace(/(fill|stroke)\s*:\s*([^;}\n]+)/g, (_match, prop, val) => {
        const replacement = getReplacement(val.trim())
        return replacement ? `${prop}: ${replacement}` : _match
      })
      tag.textContent = css
    }

    const renderingTags = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'tspan'])

    // 3. Walk rendering elements — update attributes and inline styles
    const elements = doc.querySelectorAll('*')
    for (const el of elements) {
      if (skipTags.has(el.tagName.toLowerCase())) continue

      // fill attribute
      const fill = el.getAttribute('fill')
      if (fill) {
        const r = getReplacement(fill)
        if (r) el.setAttribute('fill', r)
      }

      // stroke attribute
      const stroke = el.getAttribute('stroke')
      if (stroke) {
        const r = getReplacement(stroke)
        if (r) el.setAttribute('stroke', r)
      }

      // Inline style
      const style = el.getAttribute('style')
      if (style) {
        const newStyle = style.replace(/(fill|stroke)\s*:\s*([^;]+)/g, (_m, prop, val) => {
          const r = getReplacement(val.trim())
          return r ? `${prop}: ${r}` : _m
        })
        if (newStyle !== style) el.setAttribute('style', newStyle)
      }

      // Handle implicit default fill — elements with no fill attribute,
      // no inline fill, and no CSS class providing fill default to black.
      if (!fill && !style?.includes('fill') && !el.closest('defs') && renderingTags.has(el.tagName.toLowerCase())) {
        const elClasses = (el.getAttribute('class') || '').split(/\s+/)
        const hasCssFill = elClasses.some(c => classesWithFill.has(c))
        if (!hasCssFill) {
          const blackReplacement = lookup.get('#000000')
          if (blackReplacement) el.setAttribute('fill', blackReplacement)
        }
      }
    }

    const serializer = new XMLSerializer()
    return serializer.serializeToString(doc.documentElement)
  }

  // Regex fallback for applySvgColorMap (used when XML parsing fails)
  const applySvgColorMapRegex = (svgContent: string, colorMap: { [key: string]: string }): string => {
    let modifiedSvg = svgContent

    for (const [originalColor, newColor] of Object.entries(colorMap)) {
      if (originalColor === newColor) continue

      for (const variant of getColorVariants(originalColor)) {
        const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        modifiedSvg = modifiedSvg.replace(new RegExp(`(fill=["'])${escaped}(["'])`, 'gi'), `$1${newColor}$2`)
        modifiedSvg = modifiedSvg.replace(new RegExp(`(fill=)${escaped}(?=[\\s>/])`, 'gi'), `$1"${newColor}"`)
        modifiedSvg = modifiedSvg.replace(new RegExp(`(stroke=["'])${escaped}(["'])`, 'gi'), `$1${newColor}$2`)
        modifiedSvg = modifiedSvg.replace(new RegExp(`(stroke=)${escaped}(?=[\\s>/])`, 'gi'), `$1"${newColor}"`)

        modifiedSvg = modifiedSvg.replace(new RegExp(`(fill\\s*:\\s*)${escaped}`, 'gi'), `$1${newColor}`)
        modifiedSvg = modifiedSvg.replace(new RegExp(`(stroke\\s*:\\s*)${escaped}`, 'gi'), `$1${newColor}`)
      }
    }

    return modifiedSvg
  }

  // Regenerate blob URLs for loaded logos (blob URLs don't persist across sessions)
  useEffect(() => {
    if (!initialLogos || initialLogos.length === 0) return

    const regenerateUrls = async () => {
      const updatedLogos = await Promise.all(initialLogos.map(async (logo) => {
        // For SVG logos with saved content, regenerate the blob URL
        if (logo.isSvg && logo.svgContent && logo.colorMap) {
          const modifiedSvg = applySvgColorMap(logo.svgContent, logo.colorMap)
          const svgBlob = new Blob([modifiedSvg], { type: 'image/svg+xml' })
          const newUrl = URL.createObjectURL(svgBlob)
          return { ...logo, url: newUrl, originalUrl: newUrl }
        }

        // Handle legacy SVG logos that don't have colorMap/svgContent
        // Check if the URL contains SVG data or if file appears to be SVG
        if (logo.url && (logo.url.includes('data:image/svg') || logo.url.includes('.svg'))) {
          try {
            // Fetch the SVG content
            let svgContent = ''
            if (logo.url.startsWith('data:image/svg+xml')) {
              // Extract from data URL
              const base64Match = logo.url.match(/data:image\/svg\+xml;base64,(.+)/)
              if (base64Match) {
                svgContent = atob(base64Match[1])
              } else {
                // URL encoded
                const urlEncodedMatch = logo.url.match(/data:image\/svg\+xml[^,]*,(.+)/)
                if (urlEncodedMatch) {
                  svgContent = decodeURIComponent(urlEncodedMatch[1])
                }
              }
            } else if (logo.url.includes('.svg')) {
              // Try to fetch it
              const response = await fetch(logo.url)
              svgContent = await response.text()
            }

            if (svgContent) {
              // Extract colors and create color map
              const colors = extractSvgColors(svgContent)
              const colorMap: { [key: string]: string } = {}
              colors.forEach(color => {
                colorMap[color] = color // Initially map to same color
              })

              // Create blob URL
              const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
              const newUrl = URL.createObjectURL(svgBlob)

              return {
                ...logo,
                isSvg: true,
                svgContent,
                colorMap,
                url: newUrl,
                originalUrl: newUrl
              }
            }
          } catch (error) {
            console.error('Error processing legacy SVG logo:', error)
          }
        }

        // For regular images, the data URL should still be valid
        return logo
      }))
      setLogos(updatedLogos)
    }

    regenerateUrls()
  }, [initialLogos])

  // Upload logo
  // Generate a placeholder image for non-renderable design files (EMB, DST, PDF)
  const createDesignFilePlaceholder = (fileName: string): string => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.beginPath()
    ctx.roundRect(0, 0, 400, 400, 20)
    ctx.fill()

    // Border
    ctx.strokeStyle = '#a78bfa'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(4, 4, 392, 392, 18)
    ctx.stroke()

    // File icon
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.moveTo(150, 80)
    ctx.lineTo(230, 80)
    ctx.lineTo(260, 110)
    ctx.lineTo(260, 260)
    ctx.lineTo(140, 260)
    ctx.lineTo(140, 80)
    ctx.closePath()
    ctx.fill()

    // File fold
    ctx.fillStyle = '#7c3aed'
    ctx.beginPath()
    ctx.moveTo(230, 80)
    ctx.lineTo(260, 110)
    ctx.lineTo(230, 110)
    ctx.closePath()
    ctx.fill()

    // Extension text
    const ext = fileName.split('.').pop()?.toUpperCase() || '?'
    ctx.fillStyle = '#1a1a2e'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(ext, 200, 200)

    // Filename at bottom
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'center'
    const displayName = fileName.length > 30 ? fileName.slice(0, 27) + '...' : fileName
    ctx.fillText(displayName, 200, 320)

    // "Design File" label
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.fillText('Design File', 200, 350)

    return canvas.toDataURL('image/png')
  }

  // Generate a "YOUR LOGO HERE" placeholder image
  const createPlaceholderImage = (): string => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 600
    const ctx = canvas.getContext('2d')!

    // Light gray background
    ctx.fillStyle = '#e5e7eb'
    ctx.beginPath()
    ctx.roundRect(0, 0, 600, 600, 16)
    ctx.fill()

    // Dashed border
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 4
    ctx.setLineDash([14, 8])
    ctx.beginPath()
    ctx.roundRect(12, 12, 576, 576, 12)
    ctx.stroke()
    ctx.setLineDash([])

    // Icon: simple image/logo icon
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(210, 170, 180, 140, 8)
    ctx.stroke()
    // Mountain shape
    ctx.fillStyle = '#9ca3af'
    ctx.beginPath()
    ctx.moveTo(215, 300)
    ctx.lineTo(270, 240)
    ctx.lineTo(310, 275)
    ctx.lineTo(350, 220)
    ctx.lineTo(385, 300)
    ctx.closePath()
    ctx.fill()
    // Sun circle
    ctx.beginPath()
    ctx.arc(355, 200, 18, 0, Math.PI * 2)
    ctx.fill()

    // "YOUR LOGO HERE" text
    ctx.fillStyle = '#374151'
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('YOUR LOGO', 300, 380)
    ctx.fillText('HERE', 300, 430)

    // Subtitle
    ctx.fillStyle = '#6b7280'
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('Placeholder — final art TBD', 300, 490)

    return canvas.toDataURL('image/png')
  }

  const handleAddPlaceholder = () => {
    const placeholderUrl = createPlaceholderImage()
    const newLogo: Logo = {
      id: `logo_${Date.now()}_${Math.random()}`,
      url: placeholderUrl,
      originalUrl: placeholderUrl,
      backgroundRemoved: false,
      location: activeLocation,
      x: 0.3,
      y: 0.25,
      width: 0.4,
      height: 0.4,
      rotation: 0,
      isSvg: false,
      aspectRatio: 1,
      isPlaceholder: true,
    }
    setLogos(prev => [...prev, newLogo])
    setSelectedLogoId(newLogo.id)
  }

  // Replace a placeholder (or any logo) with a new uploaded file
  const handleReplaceLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedLogoId) return
    const file = files[0]
    const targetLogoId = selectedLogoId
    const targetLogo = logos.find(l => l.id === targetLogoId)
    if (!targetLogo) return

    const isSvgFile = file.type === 'image/svg+xml' || file.name.endsWith('.svg')

    if (isSvgFile) {
      // Read SVG as text to get raw SVG content for color extraction
      const textReader = new FileReader()
      textReader.onload = async (event) => {
        const svgContent = event.target?.result as string
        const colors = extractSvgColors(svgContent)
        const initialColorMap: { [key: string]: string } = {}
        colors.forEach(color => { initialColorMap[color] = color })
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(svgBlob)
        const img = new Image()
        await new Promise((resolve) => { img.onload = resolve; img.src = url })
        const aspectRatio = img.naturalWidth / img.naturalHeight

        updateLogo(targetLogoId, {
          url,
          originalUrl: url,
          isSvg: true,
          svgContent,
          colorMap: initialColorMap,
          aspectRatio,
          isPlaceholder: false,
          backgroundRemoved: false,
        })
      }
      textReader.readAsText(file)
    } else {
      // Read raster images as data URL
      const dataReader = new FileReader()
      dataReader.onload = async (event) => {
        const dataUrl = event.target?.result as string
        const img = new Image()
        await new Promise((resolve) => { img.onload = resolve; img.src = dataUrl })
        const aspectRatio = img.naturalWidth / img.naturalHeight

        updateLogo(targetLogoId, {
          url: dataUrl,
          originalUrl: dataUrl,
          isSvg: false,
          svgContent: undefined,
          colorMap: undefined,
          aspectRatio,
          isPlaceholder: false,
          backgroundRemoved: false,
          isDst: false,
          dstBuffer: undefined,
          threadColor: undefined,
        })
      }
      dataReader.readAsDataURL(file)
    }
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = ''
  }

  const processUploadedFile = (file: File) => {
    const isSvgFile = file.type === 'image/svg+xml' || file.name.endsWith('.svg')
    const isDesignFile = /\.(emb|dst|pdf)$/i.test(file.name)

    // Handle design files (DST = stitch render, PDF = page render, EMB = placeholder)
    if (isDesignFile) {
      const isDst = /\.dst$/i.test(file.name)
      const isPdf = /\.pdf$/i.test(file.name)

      if (isDst) {
        const defaultThreadColor = '#1a1a8b'
        Promise.all([renderDSTFile(file, 800, defaultThreadColor), file.arrayBuffer()]).then(([stitchDataUrl, dstBuffer]) => {
          const img = new Image()
          img.onload = () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight
            const height = 0.3 / aspectRatio
            const newLogo: Logo = {
              id: `logo_${Date.now()}_${Math.random()}`,
              url: stitchDataUrl,
              originalUrl: stitchDataUrl,
              backgroundRemoved: false,
              location: activeLocation,
              x: 0.35, y: 0.3, width: 0.3, height: height, rotation: 0,
              isSvg: false, isDst: true, dstBuffer: dstBuffer,
              threadColor: defaultThreadColor, aspectRatio
            }
            setLogos(prev => [...prev, newLogo])
            setSelectedLogoId(newLogo.id)
          }
          img.src = stitchDataUrl
        }).catch((err) => {
          console.error('DST render failed, falling back to placeholder:', err)
          const placeholderUrl = createDesignFilePlaceholder(file.name)
          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url: placeholderUrl, originalUrl: placeholderUrl,
            backgroundRemoved: false, location: activeLocation,
            x: 0.35, y: 0.3, width: 0.3, height: 0.3, rotation: 0,
            isSvg: false, aspectRatio: 1
          }
          setLogos(prev => [...prev, newLogo])
          setSelectedLogoId(newLogo.id)
        })
      } else if (isPdf) {
        pdfToImage(file).then(({ dataUrl, width, height }) => {
          const aspectRatio = width / height
          const logoHeight = 0.3 / aspectRatio
          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url: dataUrl, originalUrl: dataUrl,
            backgroundRemoved: false, location: activeLocation,
            x: 0.35, y: 0.3, width: 0.3, height: logoHeight, rotation: 0,
            isSvg: false, aspectRatio
          }
          setLogos(prev => [...prev, newLogo])
          setSelectedLogoId(newLogo.id)
        }).catch((err) => {
          console.error('PDF render failed, falling back to placeholder:', err)
          const placeholderUrl = createDesignFilePlaceholder(file.name)
          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url: placeholderUrl, originalUrl: placeholderUrl,
            backgroundRemoved: false, location: activeLocation,
            x: 0.35, y: 0.3, width: 0.3, height: 0.3, rotation: 0,
            isSvg: false, aspectRatio: 1
          }
          setLogos(prev => [...prev, newLogo])
          setSelectedLogoId(newLogo.id)
        })
      } else {
        const placeholderUrl = createDesignFilePlaceholder(file.name)
        const newLogo: Logo = {
          id: `logo_${Date.now()}_${Math.random()}`,
          url: placeholderUrl, originalUrl: placeholderUrl,
          backgroundRemoved: false, location: activeLocation,
          x: 0.35, y: 0.3, width: 0.3, height: 0.3, rotation: 0,
          isSvg: false, aspectRatio: 1
        }
        setLogos(prev => [...prev, newLogo])
        setSelectedLogoId(newLogo.id)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string

      if (isSvgFile) {
        const colors = extractSvgColors(content)
        const initialColorMap: { [key: string]: string } = {}
        colors.forEach(color => { initialColorMap[color] = color })

        const svgBlob = new Blob([content], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(svgBlob)

        const img = new Image()
        await new Promise((resolve) => { img.onload = resolve; img.src = url })

        const aspectRatio = img.naturalWidth / img.naturalHeight
        const height = 0.3 / aspectRatio

        const newLogo: Logo = {
          id: `logo_${Date.now()}_${Math.random()}`,
          url, originalUrl: url, backgroundRemoved: false,
          location: activeLocation, x: 0.35, y: 0.3, width: 0.3, height, rotation: 0,
          isSvg: true, svgContent: content, colorMap: initialColorMap, aspectRatio
        }
        setLogos(prev => [...prev, newLogo])
        setSelectedLogoId(newLogo.id)
      } else {
        const img = new Image()
        await new Promise((resolve) => { img.onload = resolve; img.src = content })

        const aspectRatio = img.naturalWidth / img.naturalHeight
        const height = 0.3 / aspectRatio

        const newLogo: Logo = {
          id: `logo_${Date.now()}_${Math.random()}`,
          url: content, originalUrl: content, backgroundRemoved: false,
          location: activeLocation, x: 0.35, y: 0.3, width: 0.3, height, rotation: 0,
          isSvg: false, aspectRatio
        }
        setLogos(prev => [...prev, newLogo])
        setSelectedLogoId(newLogo.id)
      }
    }

    if (isSvgFile) {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    Array.from(files).forEach(file => processUploadedFile(file))
    e.target.value = ''
  }

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCanvasDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      Array.from(files).forEach(file => processUploadedFile(file))
    }
  }

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setCanvasDragOver(true)
    }
  }

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCanvasDragOver(false)
  }

  const handleProjectFileClick = async (projectFile: { url: string; filename: string; contentType?: string }) => {
    setLoadingProjectFile(projectFile.url)
    try {
      // Proxy R2 URLs through our API to avoid CORS issues
      const fetchUrl = projectFile.url.includes('r2.dev') || projectFile.url.includes('cloudflarestorage')
        ? `/api/image-enhancer/proxy-file?url=${encodeURIComponent(projectFile.url)}`
        : projectFile.url

      // Check if this is a text artwork JSON config
      if (projectFile.filename.startsWith('text-artwork_') && projectFile.filename.endsWith('.json')) {
        const response = await fetch(fetchUrl)
        const config = await response.json()
        const newText: TextElement = {
          id: `text_${Date.now()}_${Math.random()}`,
          location: activeLocation,
          x: 0.35,
          y: 0.4,
          text: config.text || 'Text',
          fontSize: config.fontSize || 48,
          fontFamily: config.fontFamily || 'Arial',
          color: config.color || '#000000',
          rotation: config.rotation || 0,
          textAlign: config.textAlign || 'center',
          fontWeight: config.fontWeight || 400,
          strokeColor: config.strokeColor || '#000000',
          strokeWidth: config.strokeWidth || 0,
          strokeJoin: config.strokeJoin || 'round',
          strokeCap: config.strokeCap || 'round',
          lineSpacing: config.lineSpacing || 1.25,
          offsetPathWidth: config.offsetPathWidth || 0,
          offsetPathColor: config.offsetPathColor || '#000000',
          sourceProjectFile: projectFile.filename,
        }
        setTextElements(prev => [...prev, newText])
        setSelectedTextId(newText.id)
        setSelectedLogoId(null)
        return
      }

      const response = await fetch(fetchUrl)
      const blob = await response.blob()
      const mimeType = projectFile.contentType || blob.type || 'application/octet-stream'
      const file = new File([blob], projectFile.filename, { type: mimeType })
      processUploadedFile(file)
    } catch (err) {
      console.error('Failed to load project file:', err)
    } finally {
      setLoadingProjectFile(null)
    }
  }

  // Remove white background from image
  const removeBackground = async (logoId: string) => {
    const logo = logos.find(l => l.id === logoId)
    if (!logo) return

    try {
      // Create a canvas to process the image
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = logo.originalUrl
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Remove white and near-white pixels
      // Adjust threshold for sensitivity (higher = more aggressive removal)
      const threshold = 240 // Pixels with RGB values above this become transparent

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // If pixel is close to white, make it transparent
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0 // Set alpha to 0 (transparent)
        }
      }

      ctx.putImageData(imageData, 0, 0)
      const processedUrl = canvas.toDataURL('image/png')

      // Update the logo with the processed image
      updateLogo(logoId, {
        url: processedUrl,
        backgroundRemoved: true
      })
    } catch (error) {
      console.error('Error removing background:', error)
    }
  }

  // Toggle between original and background-removed version
  const toggleBackground = (logoId: string) => {
    const logo = logos.find(l => l.id === logoId)
    if (!logo) return

    if (logo.backgroundRemoved) {
      // Switch back to original
      updateLogo(logoId, {
        url: logo.originalUrl,
        backgroundRemoved: false
      })
    } else {
      // Remove background
      removeBackground(logoId)
    }
  }

  // ── AI Enhance: open ImagePrepModal for a logo ──
  const API_BASE = '/api/image-enhancer'

  const openEnhanceModal = useCallback(async (logoId: string) => {
    const logo = logos.find(l => l.id === logoId)
    if (!logo) return

    // Load image to get dimensions
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = logo.url })

    const dummyFile = new File([], logo.url.split('/').pop() || 'logo.png', { type: 'image/png' })
    const analysis = await analyzeImage({
      fileName: dummyFile.name,
      fileType: dummyFile.type,
      objectUrl: logo.url,
      nativeWidth: img.naturalWidth,
      nativeHeight: img.naturalHeight,
    })

    const uploaded: UploadedImage = {
      id: `logo-${logoId}`,
      fileName: dummyFile.name,
      originalFile: dummyFile,
      objectUrl: logo.url,
      nativeWidth: img.naturalWidth,
      nativeHeight: img.naturalHeight,
      aspectRatio: img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1,
      isRaster: !logo.isSvg,
      analysis,
    }

    setEnhanceLogoId(logoId)
    setEnhanceImage(uploaded)
  }, [logos])

  const enhanceReanalyze = useCallback(async (img: UploadedImage): Promise<UploadedImage> => {
    try {
      const a = await analyzeImage({ fileName: img.fileName, fileType: img.originalFile.type, objectUrl: img.objectUrl, nativeWidth: img.nativeWidth, nativeHeight: img.nativeHeight })
      return { ...img, analysis: a }
    } catch { return img }
  }, [])

  const enhanceHandleRemoveBg = useCallback(async (imageId: string): Promise<boolean> => {
    if (!enhanceImage || enhanceImage.id !== imageId) return false
    setEnhanceAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], removingBg: true } }))
    try {
      // Upload to R2 first, then proxy
      const blob = await (await fetch(enhanceImage.objectUrl)).blob()
      const fd = new FormData(); fd.append('file', blob, 'logo.png')
      const uploadRes = await fetch('/api/image-enhancer/presign', { method: 'POST', body: fd })
      if (!uploadRes.ok) return false
      const { fileUrl } = await uploadRes.json() as { fileUrl: string }

      const res = await fetch(`${API_BASE}/remove-background`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrl }) })
      if (!res.ok) return false
      const data = await res.json() as { imageBase64?: string }
      if (!data.imageBase64) return false
      const trimmed = await trimTransparency(data.imageBase64, 'image/png')
      const updated: UploadedImage = { ...enhanceImage, objectUrl: trimmed.url, nativeWidth: trimmed.width, nativeHeight: trimmed.height, aspectRatio: trimmed.height > 0 ? trimmed.width / trimmed.height : 1 }
      setEnhanceImage(await enhanceReanalyze(updated))
      return true
    } catch { return false }
    finally { setEnhanceAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], removingBg: false } })) }
  }, [enhanceImage, enhanceReanalyze])

  const enhanceHandleUpscale = useCallback(async (imageId: string): Promise<boolean> => {
    if (!enhanceImage || enhanceImage.id !== imageId) return false
    setEnhanceAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], upscaling: true } }))
    try {
      const blob = await (await fetch(enhanceImage.objectUrl)).blob()
      const base64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob) })
      const res = await fetch(`${API_BASE}/upscale`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64 }) })
      if (!res.ok) return false
      const data = await res.json() as { imageBase64?: string }
      if (!data.imageBase64) return false
      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => { const i = new Image(); i.onload = () => resolve({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = reject; i.src = data.imageBase64! })
      const updated: UploadedImage = { ...enhanceImage, objectUrl: data.imageBase64!, nativeWidth: dims.width, nativeHeight: dims.height, aspectRatio: dims.height > 0 ? dims.width / dims.height : 1 }
      setEnhanceImage(await enhanceReanalyze(updated))
      return true
    } catch { return false }
    finally { setEnhanceAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], upscaling: false } })) }
  }, [enhanceImage, enhanceReanalyze])

  const enhanceHandleVectorize = useCallback(async (imageId: string): Promise<boolean> => {
    if (!enhanceImage || enhanceImage.id !== imageId) return false
    setEnhanceAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], vectorizing: true } }))
    try {
      const blob = await (await fetch(enhanceImage.objectUrl)).blob()
      const base64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob) })
      const res = await fetch(`${API_BASE}/vectorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64 }) })
      if (!res.ok) return false
      const data = await res.json() as { svg?: string }
      if (!data.svg) return false
      const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data.svg)))}`
      const updated: UploadedImage = { ...enhanceImage, objectUrl: svgDataUrl }
      setEnhanceImage(await enhanceReanalyze(updated))
      return true
    } catch { return false }
    finally { setEnhanceAiState(prev => ({ ...prev, [imageId]: { ...prev[imageId], vectorizing: false } })) }
  }, [enhanceImage, enhanceReanalyze])

  const enhanceHandleCleanEdges = useCallback(async (imageId: string, threshold: number = 50): Promise<boolean> => {
    if (!enhanceImage || enhanceImage.id !== imageId) return false
    try {
      const { applyAlphaThreshold } = await import('@/app/(dashboard)/image-enhancer/utils/cleanEdges')
      const result = await applyAlphaThreshold(enhanceImage.objectUrl, enhanceImage.nativeWidth, enhanceImage.nativeHeight, threshold)
      const updated: UploadedImage = { ...enhanceImage, objectUrl: result.url, nativeWidth: result.width, nativeHeight: result.height, aspectRatio: result.height > 0 ? result.width / result.height : 1 }
      setEnhanceImage(await enhanceReanalyze(updated))
      return true
    } catch { return false }
  }, [enhanceImage, enhanceReanalyze])

  const enhanceHandleSmoothEdges = useCallback(async (imageId: string, contractionRadius: number, smoothingRadius: number): Promise<boolean> => {
    if (!enhanceImage || enhanceImage.id !== imageId) return false
    try {
      const { applyEdgeSmoothing } = await import('@/app/(dashboard)/image-enhancer/utils/edgeSmoothing')
      const result = await applyEdgeSmoothing(enhanceImage.objectUrl, enhanceImage.nativeWidth, enhanceImage.nativeHeight, contractionRadius, smoothingRadius)
      const updated: UploadedImage = { ...enhanceImage, objectUrl: result.url, nativeWidth: result.width, nativeHeight: result.height, aspectRatio: result.height > 0 ? result.width / result.height : 1 }
      setEnhanceImage(await enhanceReanalyze(updated))
      return true
    } catch { return false }
  }, [enhanceImage, enhanceReanalyze])

  const enhanceHandleLocalEdit = useCallback(async (imageId: string, newDataUrl: string, width: number, height: number) => {
    if (!enhanceImage || enhanceImage.id !== imageId) return
    const updated: UploadedImage = { ...enhanceImage, objectUrl: newDataUrl, nativeWidth: width, nativeHeight: height, aspectRatio: height > 0 ? width / height : 1 }
    setEnhanceImage(await enhanceReanalyze(updated))
  }, [enhanceImage, enhanceReanalyze])

  const enhanceHandleComplete = useCallback(() => {
    if (enhanceLogoId && enhanceImage) {
      updateLogo(enhanceLogoId, {
        url: enhanceImage.objectUrl,
        backgroundRemoved: true, // Mark as processed
      })
    }
    setEnhanceLogoId(null)
    setEnhanceImage(null)
    setEnhanceAiState({})
  }, [enhanceLogoId, enhanceImage])

  // Add text element
  const addTextElement = () => {
    const newText: TextElement = {
      id: `text_${Date.now()}_${Math.random()}`,
      text: 'Your Text Here',
      location: activeLocation,
      x: 0.35,
      y: 0.4,
      fontSize: 48,
      fontFamily: 'Arial',
      color: '#000000',
      rotation: 0,
      textAlign: 'center',
      fontWeight: 400,
      strokeColor: '#000000',
      strokeWidth: 0,
      strokeJoin: 'round',
      strokeCap: 'round',
      lineSpacing: 1.25,
      offsetPathWidth: 0,
      offsetPathColor: '#000000',
    }
    setTextElements(prev => [...prev, newText])
    setSelectedTextId(newText.id)
    setSelectedLogoId(null) // Deselect logo when adding text
  }

  // Update text element
  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(text =>
      text.id === id ? { ...text, ...updates } : text
    ))
  }

  // Delete text element
  const deleteTextElement = (id: string) => {
    setTextElements(prev => prev.filter(t => t.id !== id))
    if (selectedTextId === id) {
      setSelectedTextId(null)
    }
  }

  // Render a text element to a standalone canvas (for saving as artwork)
  const renderTextToCanvas = (text: TextElement): HTMLCanvasElement => {
    const lines = text.text.split('\n')
    const weight = text.fontWeight || 400
    const lineHeight = text.fontSize * (text.lineSpacing || 1.25)

    // Measure text width
    const measureCanvas = document.createElement('canvas')
    const mCtx = measureCanvas.getContext('2d')!
    mCtx.font = `${weight} ${text.fontSize}px ${text.fontFamily}`
    const maxLineWidth = Math.max(...lines.map(l => mCtx.measureText(l).width))

    const extraPad = Math.max(text.strokeWidth > 0 ? text.strokeWidth * 2 : 0, text.offsetPathWidth || 0)
    const padding = extraPad + 8
    const w = Math.ceil(maxLineWidth + padding * 2)
    const h = Math.ceil(lines.length * lineHeight + padding * 2)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    ctx.font = `${weight} ${text.fontSize}px ${text.fontFamily}`
    ctx.fillStyle = text.color
    ctx.textAlign = (text.textAlign === 'justify' ? 'left' : text.textAlign) || 'center'
    ctx.textBaseline = 'top'

    let anchorX = w / 2
    if (text.textAlign === 'left') anchorX = padding
    else if (text.textAlign === 'right') anchorX = w - padding

    // 1) Offset path (outermost layer) — dilated by offset + stroke combined
    if ((text.offsetPathWidth || 0) > 0) {
      const totalRadius = (text.offsetPathWidth || 0) + (text.strokeWidth > 0 ? text.strokeWidth : 0)
      renderDilatedTextOnCanvas(ctx, lines, text.offsetPathColor || '#000000', totalRadius, anchorX, padding, lineHeight)
    }

    // 2) Stroke (middle layer) — dilated fill, not strokeText (avoids glyph-point artifacts)
    if (text.strokeWidth > 0) {
      renderDilatedTextOnCanvas(ctx, lines, text.strokeColor || '#000000', text.strokeWidth, anchorX, padding, lineHeight)
    }

    // 3) Fill (top layer)
    for (let i = 0; i < lines.length; i++) {
      const ly = padding + i * lineHeight
      ctx.fillText(lines[i], anchorX, ly)
    }

    return canvas
  }

  // Save selected text element as a project file (PNG preview + JSON config)
  const [savingTextArtwork, setSavingTextArtwork] = useState(false)
  const saveTextAsProjectFile = async (mode: 'new' | 'update' = 'new') => {
    if (!selectedText || !onSaveTextArtwork) return
    setSavingTextArtwork(true)
    try {
      const canvas = renderTextToCanvas(selectedText)
      const pngBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/png')
      })
      const safeName = selectedText.text.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 30) || 'text'
      const ts = Date.now()
      const pngFile = new File([pngBlob], `text-artwork_${safeName}_${ts}.png`, { type: 'image/png' })

      // Save JSON config alongside the PNG so we can reload as editable text
      const { id, location, x, y, sourceProjectFile, ...config } = selectedText
      const jsonBlob = new Blob([JSON.stringify(config)], { type: 'application/json' })
      const jsonFile = new File([jsonBlob], `text-artwork_${safeName}_${ts}.json`, { type: 'application/json' })

      // If updating, pass the old filenames to remove
      const replaceFilenames = mode === 'update' && sourceProjectFile
        ? [sourceProjectFile, sourceProjectFile.replace('.json', '.png')]
        : undefined

      await onSaveTextArtwork(pngFile, jsonFile, replaceFilenames)

      // Update the sourceProjectFile to the new filename
      updateTextElement(selectedText.id, { sourceProjectFile: jsonFile.name })
    } catch (err) {
      console.error('Failed to save text artwork:', err)
    } finally {
      setSavingTextArtwork(false)
    }
  }

  // Apply preset placement
  const applyPreset = (preset: typeof PLACEMENT_PRESETS[0]) => {
    if (!selectedLogoId) return

    setLogos(prev => prev.map(logo => {
      if (logo.id === selectedLogoId) {
        const height = logo.aspectRatio ? preset.width / logo.aspectRatio : preset.width
        return { ...logo, x: preset.x, y: preset.y, width: preset.width, height }
      }
      return logo
    }))
  }

  // Delete logo
  const deleteLogo = (id: string) => {
    setLogos(prev => prev.filter(l => l.id !== id))
    if (selectedLogoId === id) {
      setSelectedLogoId(null)
    }
  }

  // Update logo properties
  const updateLogo = (id: string, updates: Partial<Logo>) => {
    setLogos(prev => prev.map(logo =>
      logo.id === id ? { ...logo, ...updates } : logo
    ))
  }

  // Update SVG color mapping
  const updateSvgColor = (logoId: string, originalColor: string, newColor: string) => {
    const logo = logos.find(l => l.id === logoId)
    if (!logo || !logo.isSvg || !logo.svgContent || !logo.colorMap) return

    // Update color map
    const updatedColorMap = { ...logo.colorMap, [originalColor]: newColor }

    // Apply color map to SVG
    const modifiedSvg = applySvgColorMap(logo.svgContent, updatedColorMap)

    // Convert modified SVG to blob URL
    const svgBlob = new Blob([modifiedSvg], { type: 'image/svg+xml' })
    const newUrl = URL.createObjectURL(svgBlob)

    // Revoke old URL to prevent memory leaks
    if (logo.url !== logo.originalUrl) {
      URL.revokeObjectURL(logo.url)
    }

    // Update logo with new URL and color map
    updateLogo(logoId, {
      url: newUrl,
      colorMap: updatedColorMap
    })
  }

  // Update DST thread color
  const updateDstColor = (logoId: string, newColor: string) => {
    const logo = logos.find(l => l.id === logoId)
    if (!logo || !logo.isDst || !logo.dstBuffer) return

    const design = parseDST(logo.dstBuffer)
    const newUrl = renderDSTToCanvas(design, 800, newColor)

    if (logo.url !== logo.originalUrl) {
      URL.revokeObjectURL(logo.url)
    }

    updateLogo(logoId, {
      url: newUrl,
      threadColor: newColor
    })
  }

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent, logoId: string) => {
    e.preventDefault()
    setSelectedLogoId(logoId)
    setIsDragging(true)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = (e.clientX - rect.left) / rect.width
      const mouseY = (e.clientY - rect.top) / rect.height

      // Calculate offset from mouse position to logo position
      const logo = logos.find(l => l.id === logoId)
      if (logo) {
        setDragOffset({
          x: mouseX - logo.x,
          y: mouseY - logo.y
        })
      }

      setDragStart({ x: mouseX, y: mouseY })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = (e.clientX - rect.left) / rect.width
    const mouseY = (e.clientY - rect.top) / rect.height

    if (isDragging) {
      if (selectedLogoId) {
        // Move logo - apply drag offset to maintain grab point
        updateLogo(selectedLogoId, { x: mouseX - dragOffset.x, y: mouseY - dragOffset.y })
      } else if (selectedTextId) {
        // Move text - apply drag offset to maintain grab point
        updateTextElement(selectedTextId, { x: mouseX - dragOffset.x, y: mouseY - dragOffset.y })
      }
    } else if (isResizing) {
      if (selectedLogoId) {
        // Resize logo from bottom-right corner
        const logo = logos.find(l => l.id === selectedLogoId)
        if (!logo) return

        const width = Math.max(0.05, mouseX - logo.x)
        const height = logo.aspectRatio ? width / logo.aspectRatio : width
        updateLogo(selectedLogoId, { width, height })
      } else if (selectedTextId) {
        // Resize text (font size based on vertical drag distance)
        const deltaY = mouseY - dragStart.y
        const newSize = Math.max(12, Math.min(200, resizeStartFontSize + deltaY * 300))
        updateTextElement(selectedTextId, { fontSize: Math.round(newSize) })
      }
    } else if (isRotating) {
      if (selectedLogoId) {
        // Rotate logo
        const logo = logos.find(l => l.id === selectedLogoId)
        if (!logo) return

        const centerX = logo.x + logo.width / 2
        const centerY = logo.y + logo.height / 2
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI)
        updateLogo(selectedLogoId, { rotation: Math.round(angle + 90) }) // +90 to start from top
      } else if (selectedTextId) {
        // Rotate text
        const text = textElements.find(t => t.id === selectedTextId)
        if (!text) return

        const angle = Math.atan2(mouseY - text.y, mouseX - text.x) * (180 / Math.PI)
        updateTextElement(selectedTextId, { rotation: Math.round(angle + 90) })
      }
    }
  }

  // Handle text element mouse down
  const handleTextMouseDown = (e: React.MouseEvent, textId: string) => {
    e.preventDefault()
    setSelectedTextId(textId)
    setSelectedLogoId(null) // Deselect logo
    setIsDragging(true)

    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = (e.clientX - rect.left) / rect.width
      const mouseY = (e.clientY - rect.top) / rect.height

      // Calculate offset from mouse position to text position
      const text = textElements.find(t => t.id === textId)
      if (text) {
        setDragOffset({
          x: mouseX - text.x,
          y: mouseY - text.y
        })
      }

      setDragStart({ x: mouseX, y: mouseY })
    }
  }

  // Handle text rotation start
  const handleTextRotateStart = (e: React.MouseEvent, textId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedTextId(textId)
    setIsRotating(true)
  }

  // Handle text resize start
  const handleTextResizeStart = (e: React.MouseEvent, textId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedTextId(textId)
    setIsResizing(true)
    const text = textElements.find(t => t.id === textId)
    if (text) {
      setResizeStartFontSize(text.fontSize)
    }
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      setDragStart({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setIsPanning(false)
  }

  // Pan: start when clicking on empty space (not on a logo or text element)
  const handleCanvasBgMouseDown = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement
    // If the click is on a logo/text child element, don't pan — let their handlers take over
    // We allow clicks on: the wrapper divs themselves, the garment image (pointer-events:none falls through),
    // or the canvasRef container
    const isOnElement = el.closest('[data-logo-id]') || el.closest('[data-text-id]')
    if (isOnElement) return
    // Deselect everything
    setSelectedLogoId(null)
    setSelectedTextId(null)
    // Start panning if zoomed in
    if (zoom > 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      setPanStartOffset({ ...panOffset })
    }
  }

  // Pan: mouse move
  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setPanOffset({ x: panStartOffset.x + dx, y: panStartOffset.y + dy })
    }
  }

  // Zoom: mouse wheel (attached via ref to avoid passive listener issue)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Track canvas container width for proportional text scaling
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasContainerWidth(entry.contentRect.width || 480)
      }
    })
    ro.observe(el)
    setCanvasContainerWidth(el.clientWidth || 480)
    return () => ro.disconnect()
  }, [])

  // Reset zoom & pan
  const resetZoom = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  // Handle clicks on resize handle
  const handleResizeStart = (e: React.MouseEvent, logoId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedLogoId(logoId)
    setIsResizing(true)
  }

  // Handle clicks on rotation handle
  const handleRotateStart = (e: React.MouseEvent, logoId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedLogoId(logoId)
    setIsRotating(true)
  }

  // Get garment image URL for a specific location
  const getGarmentImageForLocation = (location: Location) => {
    if (garmentImageUrls) {
      return garmentImageUrls[location] || garmentImageUrl
    }
    return garmentImageUrl
  }

  // Load an image as a blob URL via proxy to avoid CORS canvas tainting
  const loadImageForCanvas = async (url: string): Promise<HTMLImageElement> => {
    const img = new Image()
    // Check if URL is external (supplier CDN) - proxy it to avoid CORS
    const isExternal = url.startsWith('http') && !url.startsWith(window.location.origin)
    const src = isExternal ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = src
    })
    return img
  }

  // Generate a pure SVG string for a location (vector output for print).
  // No garment background — only artwork (text + logos).
  // SVG viewBox is tightly cropped to the artwork bounding box.
  const generateSvgForLocation = async (location: Location, rosterEntry?: RosterEntry): Promise<string> => {
    const containerEl = canvasRef.current
    const containerW = containerEl?.clientWidth || 480
    const containerH = containerEl?.clientHeight || 600

    const locationLogos = logos.filter(l => l.location === location && !l.isPlaceholder)
    const locationTexts = textElements.filter(t => t.location === location)

    // Load fonts via opentype.js for text-to-path conversion
    const fontCache = new Map<string, opentype.Font>()

    const loadFont = async (family: string, weight: number): Promise<opentype.Font | null> => {
      const cacheKey = `${family}-${weight}`
      if (fontCache.has(cacheKey)) return fontCache.get(cacheKey)!

      try {
        const wght = weight >= 700 ? '700' : weight >= 500 ? '500' : '400'

        // Fetch TTF via server-side proxy (browser always gets WOFF2 from Google Fonts).
        // Add cache-bust param and no-cache to avoid stale responses from earlier proxy versions.
        const proxyUrl = `/api/proxy-font?family=${encodeURIComponent(family)}&weight=${wght}&v=3`
        const fontRes = await fetch(proxyUrl, { cache: 'no-cache' })
        if (!fontRes.ok) {
          const errText = await fontRes.text()
          console.warn(`[loadFont] Proxy error ${fontRes.status} for ${family} ${wght}:`, errText)
          return null
        }
        const fontBuffer = await fontRes.arrayBuffer()
        const font = opentype.parse(fontBuffer)
        fontCache.set(cacheKey, font)
        return font
      } catch (err) {
        console.warn(`[loadFont] Failed to load ${family}:`, err)
        return null
      }
    }

    // Pre-load all fonts needed for text elements
    for (const text of locationTexts) {
      if (!SYSTEM_FONTS.includes(text.fontFamily)) {
        await loadFont(text.fontFamily, text.fontWeight || 400)
      }
    }

    // --- Collect element bounds for tight bounding box ---
    interface Rect { x: number; y: number; w: number; h: number }
    const elementBounds: Rect[] = []

    // Measure text using an offscreen canvas for accurate width
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')!

    // Pre-compute text bounds for each text element
    const textBoundsMap = new Map<string, Rect>()
    for (const text of locationTexts) {
      const displayText = rosterEntry && text.isVariable && text.variableName
        ? (rosterEntry.values[text.variableName] || text.text)
        : getDisplayText(text)
      const lines = displayText.split('\n')
      const weight = text.fontWeight || 400

      // Use opentype font for measurement if available, otherwise canvas
      const otFont = fontCache.get(`${text.fontFamily}-${weight}`) || null
      measureCtx.font = `${weight} ${text.fontSize}px "${text.fontFamily}"`

      let maxLineWidth = 0
      for (const line of lines) {
        if (otFont) {
          maxLineWidth = Math.max(maxLineWidth, otFont.getAdvanceWidth(line || ' ', text.fontSize))
        } else {
          const m = measureCtx.measureText(line || ' ')
          maxLineWidth = Math.max(maxLineWidth, m.width)
        }
      }

      const lineHeight = text.fontSize * (text.lineSpacing || 1.25)
      const textHeight = text.fontSize + (lines.length - 1) * lineHeight
      const textX = text.x * containerW
      const textY = text.y * containerH

      // Anchor offset: text is centered at (textX, textY) with text-anchor and dominant-baseline
      const align = text.textAlign || 'center'
      let anchorOffsetX = 0
      if (align === 'center') anchorOffsetX = -maxLineWidth / 2
      else if (align === 'right') anchorOffsetX = -maxLineWidth

      // Expand for stroke/offset path effects (feMorphology dilate)
      let expand = 0
      if ((text.offsetPathWidth || 0) > 0) expand += (text.offsetPathWidth || 0) + (text.strokeWidth > 0 ? text.strokeWidth : 0)
      else if (text.strokeWidth > 0) expand += text.strokeWidth

      const rect: Rect = {
        x: textX + anchorOffsetX - expand,
        y: textY - textHeight / 2 - expand,
        w: maxLineWidth + expand * 2,
        h: textHeight + expand * 2,
      }
      textBoundsMap.set(text.id, rect)
      elementBounds.push(rect)
    }

    // Build logo elements — SVG logos inlined as vector, raster logos as high-res PNG base64
    interface LogoDrawInfo {
      cx: number; cy: number; drawW: number; drawH: number; rotation: number
      inlineSvg?: string  // for SVG logos: the raw SVG content to nest inline
      imageHref?: string  // for raster logos: base64 PNG data URL
    }
    const logoDrawInfos: LogoDrawInfo[] = []

    for (const logo of locationLogos) {
      const logoX = logo.x * containerW
      const logoY = logo.y * containerH
      const maxW = logo.width * containerW
      const maxH = logo.height * containerH
      const cx = logoX + maxW / 2
      const cy = logoY + maxH / 2

      let naturalW = maxW
      let naturalH = maxH
      let inlineSvg: string | undefined
      let imageHref: string | undefined

      if (logo.isSvg && logo.svgContent) {
        // SVG logo — inline as nested <svg> to keep full vector quality
        const svgContent = logo.colorMap
          ? applySvgColorMap(logo.svgContent, logo.colorMap)
          : logo.svgContent

        // Extract viewBox or width/height from the SVG to get natural dimensions
        const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/)
        const svgWMatch = svgContent.match(/\bwidth=["']([0-9.]+)/)
        const svgHMatch = svgContent.match(/\bheight=["']([0-9.]+)/)
        if (vbMatch) {
          const parts = vbMatch[1].trim().split(/\s+/)
          naturalW = parseFloat(parts[2]) || maxW
          naturalH = parseFloat(parts[3]) || maxH
        } else if (svgWMatch && svgHMatch) {
          naturalW = parseFloat(svgWMatch[1]) || maxW
          naturalH = parseFloat(svgHMatch[1]) || maxH
        }

        inlineSvg = svgContent
      } else {
        // Raster logo — fetch via proxy and embed as base64 PNG
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(logo.url)}`
        try {
          const res = await fetch(proxyUrl)
          if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`)
          const blob = await res.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = base64
          })
          naturalW = img.naturalWidth
          naturalH = img.naturalHeight
          imageHref = base64
        } catch (err) {
          console.warn('[generateSvg] Could not embed raster logo:', logo.url, err)
          // Last resort: try direct fetch
          try {
            const res = await fetch(logo.url)
            if (res.ok) {
              const blob = await res.blob()
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
              })
              imageHref = base64
              const img = new Image()
              await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = base64 })
              naturalW = img.naturalWidth
              naturalH = img.naturalHeight
            }
          } catch {
            console.warn('[generateSvg] All embed strategies failed for logo:', logo.url)
            imageHref = logo.url // absolute last resort
          }
        }
      }

      // Fit image within bounding box preserving aspect ratio
      const imgAR = naturalW / naturalH
      const boxAR = maxW / maxH
      let drawW: number, drawH: number
      if (imgAR > boxAR) {
        drawW = maxW
        drawH = maxW / imgAR
      } else {
        drawH = maxH
        drawW = maxH * imgAR
      }

      const rotation = logo.rotation || 0
      logoDrawInfos.push({ cx, cy, drawW, drawH, rotation, inlineSvg, imageHref })

      // Bounding box for rotated logo
      if (rotation === 0) {
        elementBounds.push({ x: cx - drawW / 2, y: cy - drawH / 2, w: drawW, h: drawH })
      } else {
        const rad = (rotation * Math.PI) / 180
        const cos = Math.abs(Math.cos(rad))
        const sin = Math.abs(Math.sin(rad))
        const rotW = drawW * cos + drawH * sin
        const rotH = drawW * sin + drawH * cos
        elementBounds.push({ x: cx - rotW / 2, y: cy - rotH / 2, w: rotW, h: rotH })
      }
    }

    // Compute tight bounding box from all element bounds
    if (elementBounds.length === 0) {
      // No artwork — return empty SVG
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"/>`
    }

    let bbMinX = Infinity, bbMinY = Infinity, bbMaxX = -Infinity, bbMaxY = -Infinity
    for (const r of elementBounds) {
      bbMinX = Math.min(bbMinX, r.x)
      bbMinY = Math.min(bbMinY, r.y)
      bbMaxX = Math.max(bbMaxX, r.x + r.w)
      bbMaxY = Math.max(bbMaxY, r.y + r.h)
    }

    // Small padding (2px) to avoid clipping filter edges
    const pad = 2
    bbMinX -= pad
    bbMinY -= pad
    bbMaxX += pad
    bbMaxY += pad
    const bbW = bbMaxX - bbMinX
    const bbH = bbMaxY - bbMinY

    // --- Build SVG elements with original absolute positions (viewBox handles the crop) ---

    const logoElements: string[] = []
    for (const info of logoDrawInfos) {
      if (info.inlineSvg) {
        // SVG logo — inline as vector content with clipPath (no nested <svg> to avoid opaque viewport)
        const cleaned = info.inlineSvg.replace(/<\?xml[^?]*\?>\s*/g, '')
        const svgTagMatch = cleaned.match(/^<svg[^>]*>/)
        const svgTag = svgTagMatch ? svgTagMatch[0] : ''

        // Extract viewBox — if missing, construct from width/height attributes
        const vbMatch = svgTag.match(/viewBox=["']([^"']+)["']/)
        let viewBox: string
        if (vbMatch) {
          viewBox = vbMatch[1]
        } else {
          // Fallback: use original width/height to construct viewBox
          const origWMatch = svgTag.match(/\bwidth=["']([0-9.]+)/)
          const origHMatch = svgTag.match(/\bheight=["']([0-9.]+)/)
          const origW = origWMatch ? parseFloat(origWMatch[1]) : info.drawW
          const origH = origHMatch ? parseFloat(origHMatch[1]) : info.drawH
          viewBox = `0 0 ${origW} ${origH}`
        }

        // Extract inner content (everything between <svg ...> and </svg>)
        let innerContent = cleaned
          .replace(/^<svg[^>]*>/, '')
          .replace(/<\/svg>\s*$/, '')

        // Namespace CSS classes to avoid collisions when multiple SVGs are inlined
        // into the same document (e.g. two SVGs both using class ".d" with different fills).
        const logoIdx = logoDrawInfos.indexOf(info)
        const prefix = `l${logoIdx}_`
        // Replace class names in <style> blocks: .d { -> .l0_d {
        innerContent = innerContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
          const namespacedCss = css.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, `.${prefix}$1`)
          return `<style>${namespacedCss}</style>`
        })
        // Replace class attributes on elements: class="d" -> class="l0_d"
        innerContent = innerContent.replace(/\bclass="([^"]+)"/g, (_match, classes: string) => {
          const namespacedClasses = classes.split(/\s+/).map(c => `${prefix}${c}`).join(' ')
          return `class="${namespacedClasses}"`
        })
        innerContent = innerContent.replace(/\bclass='([^']+)'/g, (_match, classes: string) => {
          const namespacedClasses = classes.split(/\s+/).map(c => `${prefix}${c}`).join(' ')
          return `class='${namespacedClasses}'`
        })

        // Strip white background rects using DOM parsing (far more reliable than regex).
        // Parses the SVG fragment, finds all <rect> elements with white-ish computed fill,
        // and removes any that look like a background (large size or first element).
        {
          const vbParts = viewBox.split(/\s+/).map(Number)
          const [vbX = 0, vbY = 0, vbW = 0, vbH = 0] = vbParts

          const wrapSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${innerContent}</svg>`
          const parser = new DOMParser()
          const doc = parser.parseFromString(wrapSvg, 'image/svg+xml')
          const rects = doc.querySelectorAll('rect')

          const whiteRgbValues = ['rgb(255, 255, 255)', 'rgb(255,255,255)']
          const whiteHexValues = ['#fff', '#ffffff', '#ffffffff']

          const isWhiteColor = (color: string): boolean => {
            const c = color.toLowerCase().trim()
            if (c === 'white') return true
            if (whiteHexValues.includes(c)) return true
            if (whiteRgbValues.includes(c.replace(/\s/g, '').replace('rgb(', 'rgb( ').replace(')', ' )').trim())) return true
            // Normalize: check rgb(255, 255, 255) with any whitespace
            const rgbMatch = c.match(/^rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)$/)
            if (rgbMatch) return true
            return whiteHexValues.includes(c) || c === 'white'
          }

          const rectsToRemove: Element[] = []
          rects.forEach((rect) => {
            // Check fill — attribute, style, or computed
            const fillAttr = rect.getAttribute('fill')
            const styleFill = rect.style?.fill
            const fill = fillAttr || styleFill || ''

            if (!isWhiteColor(fill)) return

            const w = parseFloat(rect.getAttribute('width') || '0')
            const h = parseFloat(rect.getAttribute('height') || '0')
            const x = parseFloat(rect.getAttribute('x') || '0')
            const y = parseFloat(rect.getAttribute('y') || '0')

            // Check if it's a background-like rect:
            // 1. Full viewBox size
            const isFullSize = vbW > 0 && Math.abs(w - vbW) < 2 && Math.abs(h - vbH) < 2
            // 2. Large rect covering >50% of viewBox at origin
            const isLarge = vbW > 0 && (w * h) > (vbW * vbH * 0.5) &&
                            Math.abs(x - vbX) < 2 && Math.abs(y - vbY) < 2
            // 3. 100% width/height
            const widthAttr = rect.getAttribute('width') || ''
            const heightAttr = rect.getAttribute('height') || ''
            const isPercent = widthAttr === '100%' && heightAttr === '100%'

            if (isFullSize || isLarge || isPercent) {
              rectsToRemove.push(rect)
            }
          })

          // If no size-based match but the very first child element is a white rect, remove it
          if (rectsToRemove.length === 0 && rects.length > 0) {
            const svgRoot = doc.documentElement
            // Find first non-metadata child element
            for (const child of Array.from(svgRoot.children)) {
              const tag = child.tagName.toLowerCase()
              if (['defs', 'style', 'title', 'desc', 'metadata'].includes(tag)) continue
              if (tag === 'rect') {
                const fillAttr = child.getAttribute('fill')
                const styleFill = (child as HTMLElement).style?.fill
                if (isWhiteColor(fillAttr || styleFill || '')) {
                  rectsToRemove.push(child)
                }
              }
              break // only check the very first visible element
            }
          }

          if (rectsToRemove.length > 0) {
            rectsToRemove.forEach(rect => rect.remove())
            // Re-serialize the inner content
            const serializer = new XMLSerializer()
            const svgRoot = doc.documentElement
            innerContent = Array.from(svgRoot.childNodes)
              .map(node => serializer.serializeToString(node))
              .join('')
          }
        }

        // Use <g> + <clipPath> instead of nested <svg> to avoid opaque viewport in Illustrator.
        // Nested <svg> creates a white background in Illustrator because it's treated as a separate viewport.
        const clipId = `clip-logo-${logoDrawInfos.indexOf(info)}`
        const vbNums = viewBox.split(/\s+/).map(Number)
        const [svgVbX = 0, svgVbY = 0, svgVbW = 1, svgVbH = 1] = vbNums
        // Scale factor to fit the SVG content into the target draw area
        const scaleX = info.drawW / svgVbW
        const scaleY = info.drawH / svgVbH
        const scale = Math.min(scaleX, scaleY)
        const scaledW = svgVbW * scale
        const scaledH = svgVbH * scale

        logoElements.push(
          `<defs>
      <clipPath id="${clipId}">
        <rect x="${-scaledW / 2}" y="${-scaledH / 2}" width="${scaledW}" height="${scaledH}"/>
      </clipPath>
    </defs>
    <g transform="translate(${info.cx}, ${info.cy}) rotate(${info.rotation})" clip-path="url(#${clipId})">
      <g transform="translate(${-scaledW / 2}, ${-scaledH / 2}) scale(${scale}) translate(${-svgVbX}, ${-svgVbY})">
        ${innerContent}
      </g>
    </g>`
        )
      } else {
        // Raster logo — embed as base64 PNG
        logoElements.push(
          `<g transform="translate(${info.cx}, ${info.cy}) rotate(${info.rotation})">
      <image xlink:href="${info.imageHref}" x="${-info.drawW / 2}" y="${-info.drawH / 2}" width="${info.drawW}" height="${info.drawH}" preserveAspectRatio="xMidYMid meet"/>
    </g>`
        )
      }
    }

    // Build text elements as outlined paths (no editable text, no font dependencies).
    // Uses opentype.js to convert text to SVG path data.
    // Stroke/offset effects use native SVG stroke on paths (Illustrator-compatible).
    const textElements_svg: string[] = []
    for (const text of locationTexts) {
      const textX = text.x * containerW
      const textY = text.y * containerH

      // Get display text (with roster substitution)
      const displayText = rosterEntry && text.isVariable && text.variableName
        ? (rosterEntry.values[text.variableName] || text.text)
        : getDisplayText(text)
      const lines = displayText.split('\n')

      const weight = text.fontWeight || 400
      const rotation = text.rotation || 0
      const hasStroke = text.strokeWidth > 0
      const hasOffset = (text.offsetPathWidth || 0) > 0

      // Try to load the font for path conversion
      const font = SYSTEM_FONTS.includes(text.fontFamily)
        ? null
        : fontCache.get(`${text.fontFamily}-${weight}`) || null

      const lineHeight = text.fontSize * (text.lineSpacing || 1.25)

      const blockHeight = text.fontSize + (lines.length - 1) * lineHeight

      // Build path data for each line using opentype.js
      const pathLayers: string[] = []

      if (font) {
        // Convert text to outlined paths — fully vector, no font dependency
        // Position to match canvas textBaseline='middle': the em-square center is at Y=0.
        // The alphabetic baseline offset from center = (ascender - descender) / 2 scaled to fontSize.
        const unitsPerEm = font.unitsPerEm || 1000
        const fontAscent = (font.ascender / unitsPerEm) * text.fontSize
        const fontDescent = Math.abs((font.descender || 0) / unitsPerEm) * text.fontSize
        // Baseline relative to center: matches canvas textBaseline='middle'
        const baselineFromCenter = (fontAscent - fontDescent) / 2
        const allPathData: string[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] || ' '
          const lineY = baselineFromCenter + i * lineHeight

          // Measure line width for alignment
          const lineWidth = font.getAdvanceWidth(line, text.fontSize)
          const align = text.textAlign || 'center'
          let lineX = 0
          if (align === 'center') lineX = -lineWidth / 2
          else if (align === 'right') lineX = -lineWidth

          // opentype.js getPath: y is the baseline position
          const path = font.getPath(line, lineX, lineY, text.fontSize)
          const pathData = path.toPathData(2)
          if (pathData && pathData !== 'M0 0') {
            allPathData.push(pathData)
          }
        }

        const combinedPath = allPathData.join(' ')

        // Layer 1 (bottom): Offset path
        if (hasOffset) {
          const totalRadius = (text.offsetPathWidth || 0) + (hasStroke ? text.strokeWidth : 0)
          pathLayers.push(
            `<path d="${combinedPath}" fill="none" stroke="${text.offsetPathColor || '#000000'}" stroke-width="${totalRadius * 2}" stroke-linejoin="round"/>`
          )
        }

        // Layer 2 (middle): Stroke
        if (hasStroke) {
          pathLayers.push(
            `<path d="${combinedPath}" fill="none" stroke="${text.strokeColor || '#000000'}" stroke-width="${text.strokeWidth * 2}" stroke-linejoin="round"/>`
          )
        }

        // Layer 3 (top): Fill
        pathLayers.push(
          `<path d="${combinedPath}" fill="${text.color}"/>`
        )
      } else {
        // Fallback for system fonts: use <text> elements (opentype.js can't load system fonts)
        const anchorMap: Record<string, string> = { left: 'start', center: 'middle', right: 'end', justify: 'start' }
        const textAnchor = anchorMap[text.textAlign || 'center'] || 'middle'
        const ascent = text.fontSize * 0.65
        const firstBaselineY = -blockHeight / 2 + ascent

        const tspans = lines.map((line, i) => {
          const y = firstBaselineY + i * lineHeight
          return `<tspan x="0" y="${y.toFixed(2)}">${escapeXml(line || ' ')}</tspan>`
        }).join('')

        const fontAttrs = `font-family="${escapeXml(text.fontFamily)}" font-size="${text.fontSize}" font-weight="${weight}" text-anchor="${textAnchor}"`

        if (hasOffset) {
          const totalRadius = (text.offsetPathWidth || 0) + (hasStroke ? text.strokeWidth : 0)
          pathLayers.push(
            `<text ${fontAttrs} fill="none" stroke="${text.offsetPathColor || '#000000'}" stroke-width="${totalRadius * 2}" stroke-linejoin="round">${tspans}</text>`
          )
        }
        if (hasStroke) {
          pathLayers.push(
            `<text ${fontAttrs} fill="none" stroke="${text.strokeColor || '#000000'}" stroke-width="${text.strokeWidth * 2}" stroke-linejoin="round">${tspans}</text>`
          )
        }
        pathLayers.push(
          `<text ${fontAttrs} fill="${text.color}">${tspans}</text>`
        )
      }

      textElements_svg.push(
        `<g transform="translate(${textX}, ${textY}) rotate(${rotation})">
      ${pathLayers.join('\n      ')}
    </g>`
      )
    }

    // Set real-world print dimensions (10" max width, height proportional)
    const printWidthIn = 10
    const printHeightIn = printWidthIn * (bbH / bbW)

    // Only include font imports if any text fell back to <text> elements (system fonts)
    const needsFontImports = locationTexts.some(t => SYSTEM_FONTS.includes(t.fontFamily))
    const fontsUsed = new Set<string>()
    if (needsFontImports) {
      locationTexts.forEach(t => {
        if (!SYSTEM_FONTS.includes(t.fontFamily) && !fontCache.has(`${t.fontFamily}-${t.fontWeight || 400}`)) {
          fontsUsed.add(t.fontFamily)
        }
      })
    }
    const fontImports = fontsUsed.size > 0
      ? `<style>
    ${[...fontsUsed].map(f => `@import url('https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@300;400;700&amp;display=swap');`).join('\n    ')}
  </style>`
      : ''

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="${bbMinX} ${bbMinY} ${bbW} ${bbH}" width="${printWidthIn}in" height="${printHeightIn.toFixed(4)}in">
  ${fontImports}
  ${logoElements.join('\n  ')}
  ${textElements_svg.join('\n  ')}
</svg>`
  }

  // Helper to escape XML special characters
  const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Generate mockup image for a specific location.
  // rosterEntry: substitutes variable text values for a specific player.
  // printMode: if true, skips garment background (transparent) and uses higher resolution for print output.
  const generateMockupForLocation = async (location: Location, rosterEntry?: RosterEntry, printMode?: boolean): Promise<string> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    // Load garment image for this location via proxy for CORS-safe canvas export
    const garmentImg = await loadImageForCanvas(getGarmentImageForLocation(location))

    // Match the exact aspect ratio of the preview container so logo
    // positions (stored as percentages of the container) map pixel-perfect.
    const containerEl = canvasRef.current
    const containerW = containerEl?.clientWidth || 480
    const containerH = containerEl?.clientHeight || 600
    const containerAspect = containerW / containerH

    // Print mode: 4x resolution for high-quality output. Mockup preview: 1200px.
    const CANVAS_W = printMode ? 4800 : 1200
    const CANVAS_H = Math.round(CANVAS_W / containerAspect)
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H

    // Draw garment image with object-fit:contain behaviour (matches preview)
    // In print mode, skip the garment — only render artwork on transparent background
    const imgAspect = garmentImg.naturalWidth / garmentImg.naturalHeight
    const canvasAspect = CANVAS_W / CANVAS_H

    let gw, gh, gx, gy
    if (imgAspect > canvasAspect) {
      gw = CANVAS_W
      gh = CANVAS_W / imgAspect
      gx = 0
      gy = (CANVAS_H - gh) / 2
    } else {
      gh = CANVAS_H
      gw = CANVAS_H * imgAspect
      gx = (CANVAS_W - gw) / 2
      gy = 0
    }
    if (!printMode) {
      ctx.drawImage(garmentImg, gx, gy, gw, gh)
    }

    // Draw logos for this location
    const locationLogos = logos.filter(l => l.location === location)
    for (const logo of locationLogos) {
      const logoImg = new Image()

      // For SVG logos, convert to data URL for reliable canvas rendering
      if (logo.isSvg && logo.svgContent && logo.colorMap) {
        const modifiedSvg = applySvgColorMap(logo.svgContent, logo.colorMap)
        // Convert SVG to data URL (more reliable than blob URLs for canvas)
        const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(modifiedSvg)

        await new Promise((resolve, reject) => {
          logoImg.onload = resolve
          logoImg.onerror = reject
          logoImg.src = svgDataUrl
        })
      } else {
        // For regular images, use proxy for external URLs to avoid CORS
        const isExternal = logo.url.startsWith('http') && !logo.url.startsWith(window.location.origin)
        const logoSrc = isExternal ? `/api/proxy-image?url=${encodeURIComponent(logo.url)}` : logo.url
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve
          logoImg.onerror = reject
          logoImg.src = logoSrc
        })
      }

      // Calculate actual dimensions preserving aspect ratio
      const logoX = logo.x * canvas.width
      const logoY = logo.y * canvas.height
      const maxWidth = logo.width * canvas.width
      const maxHeight = logo.height * canvas.height

      // Get the natural aspect ratio of the loaded image
      const imageAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight
      const boxAspectRatio = maxWidth / maxHeight

      let logoW, logoH
      if (imageAspectRatio > boxAspectRatio) {
        // Image is wider than box - fit to width
        logoW = maxWidth
        logoH = maxWidth / imageAspectRatio
      } else {
        // Image is taller than box - fit to height
        logoH = maxHeight
        logoW = maxHeight * imageAspectRatio
      }

      ctx.save()
      ctx.translate(logoX + maxWidth / 2, logoY + maxHeight / 2)
      ctx.rotate((logo.rotation * Math.PI) / 180)
      ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH)
      ctx.restore()
    }

    // Draw text elements for this location
    // Scale text size proportionally — fontSize is in preview-container pixels,
    // but the export canvas is higher resolution
    const scaleRatio = CANVAS_W / containerW
    const locationTexts = textElements.filter(t => t.location === location)
    for (const text of locationTexts) {
      const textX = text.x * canvas.width
      const textY = text.y * canvas.height
      const scaledFontSize = text.fontSize * scaleRatio
      // Use roster entry substitution if provided, otherwise use preview substitution
      const displayText = rosterEntry && text.isVariable && text.variableName
        ? (rosterEntry.values[text.variableName] || text.text)
        : getDisplayText(text)
      const lines = displayText.split('\n')
      const lineHeight = scaledFontSize * (text.lineSpacing || 1.25)
      const weight = text.fontWeight || 400

      ctx.save()
      ctx.translate(textX, textY)
      ctx.rotate((text.rotation * Math.PI) / 180)
      ctx.font = `${weight} ${scaledFontSize}px ${text.fontFamily}`
      ctx.fillStyle = text.color
      ctx.textAlign = (text.textAlign === 'justify' ? 'left' : text.textAlign) || 'center'
      ctx.textBaseline = 'middle'

      // Calculate vertical offset to center the block
      const totalHeight = (lines.length - 1) * lineHeight
      const startY = -totalHeight / 2

      // 1) Offset path (outermost layer) — dilated by offset + stroke combined
      if ((text.offsetPathWidth || 0) > 0) {
        const totalRadius = ((text.offsetPathWidth || 0) + (text.strokeWidth > 0 ? text.strokeWidth : 0)) * scaleRatio
        renderDilatedTextOnCanvas(ctx, lines, text.offsetPathColor || '#000000', totalRadius, 0, startY, lineHeight)
      }

      // 2) Stroke (middle layer) — dilated fill, not strokeText
      if (text.strokeWidth > 0) {
        renderDilatedTextOnCanvas(ctx, lines, text.strokeColor || '#000000', text.strokeWidth * scaleRatio, 0, startY, lineHeight)
      }

      // 3) Fill (top layer)
      for (let i = 0; i < lines.length; i++) {
        const ly = startY + i * lineHeight
        ctx.fillText(lines[i], 0, ly)
      }

      ctx.restore()
    }

    // Export as data URL
    return canvas.toDataURL('image/png')
  }

  // Generate mockup images for all locations with designs and save
  const handleSaveMockup = async () => {
    setIsSavingMockup(true)
    try {
      const mockups: MockupImage[] = []

      // Generate a mockup for each location that has designs
      for (const location of LOCATIONS) {
        const locationLogos = logos.filter(l => l.location === location)
        const locationTexts = textElements.filter(t => t.location === location)

        // Only generate mockup if this location has designs
        if (locationLogos.length > 0 || locationTexts.length > 0) {
          try {
            const dataUrl = await generateMockupForLocation(location)
            mockups.push({ location, dataUrl })
          } catch (error) {
            console.error(`Error generating mockup for ${location}:`, error)
          }
        }
      }

      if (mockups.length === 0) {
        return
      }

      onSave(mockups, logos, textElements, roster.length > 0 ? roster : undefined)
      onSaveConfig(logos, textElements, roster.length > 0 ? roster : undefined)
      onClose()
    } finally {
      setIsSavingMockup(false)
    }
  }

  // Handle close - save config before closing
  const handleClose = () => {
    // Save the current config (logos, text, roster) before closing
    onSaveConfig(logos, textElements, roster.length > 0 ? roster : undefined)
    onClose()
  }

  // Filter elements by active location
  const activeLogos = logos.filter(l => l.location === activeLocation)
  const activeTexts = textElements.filter(t => t.location === activeLocation)

  const selectedLogo = logos.find(l => l.id === selectedLogoId)
  const selectedText = textElements.find(t => t.id === selectedTextId)

  // Variable text elements for roster feature
  const variableTexts = textElements.filter(t => t.isVariable && t.variableName)
  const hasVariables = variableTexts.length > 0

  // Get display text for a text element (substituted if roster has entries)
  const getDisplayText = (text: TextElement): string => {
    if (!text.isVariable || !text.variableName || roster.length === 0) return text.text
    const firstEntry = roster[0]
    return firstEntry.values[text.variableName] || text.text
  }

  // CSV parsing helper
  const parseCsvText = (raw: string): RosterEntry[] => {
    const lines = raw.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return []

    // Detect delimiter
    const firstLine = lines[0]
    const delimiter = firstLine.includes('\t') ? '\t' : ','

    const firstCols = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''))
    const entries: RosterEntry[] = []
    const varNames = variableTexts.map(t => t.variableName!)

    // Detect if first row is a header or data:
    // It's a header if any column matches a variable name (case-insensitive)
    const hasHeaderRow = firstCols.some(h =>
      varNames.some(v => v.toLowerCase() === h.toLowerCase())
    )

    const headerMap: Record<number, string> = {}
    if (hasHeaderRow) {
      // Match headers to variable names
      firstCols.forEach((h, i) => {
        const exact = varNames.find(v => v.toLowerCase() === h.toLowerCase())
        if (exact) {
          headerMap[i] = exact
        } else if (i < varNames.length) {
          headerMap[i] = varNames[i]
        }
      })
    } else {
      // No header — map columns by order to variable names
      firstCols.forEach((_, i) => {
        if (i < varNames.length) {
          headerMap[i] = varNames[i]
        }
      })
    }

    const startRow = hasHeaderRow ? 1 : 0
    for (let r = startRow; r < lines.length; r++) {
      const cols = lines[r].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''))
      const values: Record<string, string> = {}
      Object.entries(headerMap).forEach(([colIdx, varName]) => {
        values[varName] = cols[parseInt(colIdx)] || ''
      })
      if (Object.values(values).some(v => v)) {
        entries.push({ id: `roster-${Date.now()}-${r}`, values })
      }
    }
    return entries
  }

  // Add empty roster row
  const addRosterRow = () => {
    const values: Record<string, string> = {}
    variableTexts.forEach(t => { values[t.variableName!] = '' })
    setRoster(prev => [...prev, { id: `roster-${Date.now()}`, values }])
  }

  // Remove roster row
  const removeRosterRow = (id: string) => {
    setRoster(prev => prev.filter(r => r.id !== id))
  }

  // Update roster cell
  const updateRosterCell = (id: string, varName: string, value: string) => {
    setRoster(prev => prev.map(r => r.id === id ? { ...r, values: { ...r.values, [varName]: value } } : r))
  }

  // Get count of decorations per location
  const getLocationCount = (location: Location) => {
    const logoCount = logos.filter(l => l.location === location).length
    const textCount = textElements.filter(t => t.location === location).length
    return logoCount + textCount
  }

  // Get the appropriate image URL for the current location
  const getCurrentGarmentImage = () => {
    if (garmentImageUrls) {
      return garmentImageUrls[activeLocation] || garmentImageUrl
    }
    return garmentImageUrl
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          background: '#111',
          borderRadius: '16px',
          border: '1px solid rgba(148,163,184,0.3)',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(148,163,184,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
              Mockup Builder
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
              {garmentName} - {colorName}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Canvas Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0a'
          }}>
            {/* Location Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '16px 24px 0 24px',
              borderBottom: '1px solid rgba(148,163,184,0.1)'
            }}>
              {LOCATIONS.map(location => {
                const count = getLocationCount(location)
                return (
                  <button
                    key={location}
                    onClick={() => {
                      setActiveLocation(location)
                      setSelectedLogoId(null)
                      setSelectedTextId(null)
                    }}
                    style={{
                      padding: '10px 20px',
                      background: activeLocation === location
                        ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                        : 'transparent',
                      border: activeLocation === location
                        ? 'none'
                        : '1px solid rgba(148,163,184,0.2)',
                      borderRadius: '8px 8px 0 0',
                      color: activeLocation === location ? 'white' : '#94a3b8',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {location}
                    {count > 0 && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        background: activeLocation === location ? 'rgba(255,255,255,0.2)' : 'rgba(139,92,246,0.2)',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Canvas Container with zoom/pan */}
            <div
              style={{
                flex: 1,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
              }}
              ref={canvasAreaRef}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
            >
            {canvasDragOver && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 50,
                background: 'rgba(139, 92, 246, 0.15)',
                border: '3px dashed #8b5cf6',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{ color: '#8b5cf6', fontSize: '18px', fontWeight: 700 }}>Drop artwork here</div>
              </div>
            )}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                overflow: 'hidden',
                cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
              }}
              onMouseDown={handleCanvasBgMouseDown}
              onMouseMove={(e) => { handlePanMouseMove(e); handleMouseMove(e) }}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
            <div
              ref={canvasRef}
              style={{
                position: 'relative',
                maxWidth: '600px',
                maxHeight: '600px',
                width: '100%',
                aspectRatio: '4/5',
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                transformOrigin: 'center center',
                transition: isPanning || isDragging ? 'none' : 'transform 0.1s ease-out',
                cursor: isDragging ? 'grabbing' : isPanning ? 'grabbing' : 'default',
              }}
            >
              {/* Garment Image */}
              <img
                src={getCurrentGarmentImage()}
                alt={garmentName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />

              {/* Logos */}
              {activeLogos.map(logo => (
                <div
                  key={logo.id}
                  data-logo-id={logo.id}
                  onMouseDown={(e) => handleMouseDown(e, logo.id)}
                  style={{
                    position: 'absolute',
                    left: `${logo.x * 100}%`,
                    top: `${logo.y * 100}%`,
                    width: `${logo.width * 100}%`,
                    height: `${logo.height * 100}%`,
                    transform: `rotate(${logo.rotation}deg)`,
                    transformOrigin: 'center center',
                    cursor: isDragging && selectedLogoId === logo.id ? 'grabbing' : 'grab',
                    border: selectedLogoId === logo.id ? '2px solid #8b5cf6' : '2px dashed transparent',
                    boxSizing: 'border-box',
                    transition: selectedLogoId === logo.id ? 'none' : 'border 0.15s ease'
                  }}
                >
                  <img
                    src={logo.url}
                    alt="Logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  />

                  {/* Resize Handle - Bottom Right */}
                  {selectedLogoId === logo.id && (
                    <>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, logo.id)}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          bottom: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#8b5cf6',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'nwse-resize',
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />

                      {/* Rotation Handle - Top Right */}
                      <div
                        onMouseDown={(e) => handleRotateStart(e, logo.id)}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          top: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#22c55e',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'grab',
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                    </>
                  )}
                </div>
              ))}

              {/* SVG Filters for Stroke + Offset Path (feMorphology dilate = smooth, artifact-free) */}
              <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <defs>
                  {activeTexts.filter(t => t.strokeWidth > 0 || (t.offsetPathWidth || 0) > 0).map(t => {
                    const hasStroke = t.strokeWidth > 0
                    const hasOffset = (t.offsetPathWidth || 0) > 0
                    return (
                    <filter key={`text-fx-${t.id}`} id={`text-fx-${t.id}`}
                      x="-50%" y="-50%" width="200%" height="200%"
                    >
                      {/* Build layers bottom-up, then merge */}
                      {hasOffset && (
                        <>
                          <feMorphology operator="dilate" radius={(t.offsetPathWidth || 0) + (hasStroke ? t.strokeWidth : 0)} in="SourceAlpha" result="offsetDilated" />
                          <feFlood floodColor={t.offsetPathColor} result="offsetColor" />
                          <feComposite in="offsetColor" in2="offsetDilated" operator="in" result="offsetLayer" />
                        </>
                      )}
                      {hasStroke && (
                        <>
                          <feMorphology operator="dilate" radius={t.strokeWidth} in="SourceAlpha" result="strokeDilated" />
                          <feFlood floodColor={t.strokeColor} result="strokeColor" />
                          <feComposite in="strokeColor" in2="strokeDilated" operator="in" result="strokeLayer" />
                        </>
                      )}
                      <feMerge>
                        {hasOffset && <feMergeNode in="offsetLayer" />}
                        {hasStroke && <feMergeNode in="strokeLayer" />}
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    )
                  })}
                </defs>
              </svg>

              {/* Text Elements — fontSize scales proportionally with container width */}
              {activeTexts.map(text => {
                const hasEffect = text.strokeWidth > 0 || (text.offsetPathWidth || 0) > 0
                // Scale fontSize relative to the 480px reference width so text scales with the container
                const textScale = canvasContainerWidth / 480
                return (
                <div
                  key={text.id}
                  data-text-id={text.id}
                  onMouseDown={(e) => handleTextMouseDown(e, text.id)}
                  style={{
                    position: 'absolute',
                    left: `${text.x * 100}%`,
                    top: `${text.y * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
                    transformOrigin: 'center center',
                    cursor: isDragging && selectedTextId === text.id ? 'grabbing' : 'grab',
                    userSelect: 'none',
                  } as React.CSSProperties}
                >
                  {/* Variable badge */}
                  {showVariableBadges && text.isVariable && text.variableName && (
                    <div style={{
                      position: 'absolute',
                      top: '-18px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#8b5cf6',
                      color: 'white',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.5px',
                      pointerEvents: 'none',
                    }}>{text.variableName}</div>
                  )}
                  {/* Border wrapper — separate from filter so dilate doesn't affect the border */}
                  <div style={{
                    border: selectedTextId === text.id ? '2px solid #3b82f6' : '2px dashed transparent',
                    borderRadius: '2px',
                    padding: 0,
                    transition: selectedTextId === text.id ? 'none' : 'border 0.15s ease',
                    display: 'inline-block',
                    lineHeight: 0,
                  }}>
                    <span style={{
                      fontFamily: text.fontFamily,
                      fontSize: `${text.fontSize * textScale}px`,
                      color: text.color,
                      fontWeight: text.fontWeight || 400,
                      lineHeight: 1,
                      textAlign: text.textAlign || 'center',
                      display: 'inline-block',
                      filter: hasEffect ? `url(#text-fx-${text.id})` : undefined,
                    } as React.CSSProperties}>
                      {getDisplayText(text).split('\n').map((line, i) => (
                        <div key={i} style={{
                          marginTop: i > 0 ? `${((text.lineSpacing || 1.25) - 1) * text.fontSize * textScale}px` : 0,
                        }}>{line || '\u00A0'}</div>
                      ))}
                    </span>
                  </div>

                  {selectedTextId === text.id && (
                    <>
                      {/* Rotation Handle */}
                      <div
                        onMouseDown={(e) => handleTextRotateStart(e, text.id)}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          top: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#22c55e',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'grab',
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                      {/* Resize Handle */}
                      <div
                        onMouseDown={(e) => handleTextResizeStart(e, text.id)}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          bottom: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#8b5cf6',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'nwse-resize',
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                    </>
                  )}
                </div>
              )})}
            </div>
            </div>

            {/* Zoom Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 0 0 0',
              flexShrink: 0,
            }}>
              <button
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                style={{
                  width: '28px',
                  height: '28px',
                  background: '#282a30',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                −
              </button>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ width: '140px' }}
              />
              <button
                onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
                style={{
                  width: '28px',
                  height: '28px',
                  background: '#282a30',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, minWidth: '40px' }}>
                {Math.round(zoom * 100)}%
              </span>
              {zoom !== 1 && (
                <button
                  onClick={resetZoom}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: '6px',
                    color: '#a78bfa',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            </div>
          </div>

          {/* Right Sidebar - Controls */}
          <div style={{
            width: '300px',
            borderLeft: '1px solid rgba(148,163,184,0.2)',
            padding: '24px',
            overflowY: 'auto',
            background: '#161616'
          }}>
            {/* Upload Logo */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                Add Logo
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.emb,.dst,.pdf"
                multiple
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#8b5cf6',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Upload Logo
              </button>
              <button
                onClick={handleAddPlaceholder}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  background: 'transparent',
                  border: '1px dashed rgba(148,163,184,0.4)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Use Placeholder Image
              </button>
            </div>

            {/* Project Files */}
            {projectFiles.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <button
                  onClick={() => setShowProjectFiles(!showProjectFiles)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#282a30',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <span>Project Files ({projectFiles.length})</span>
                  <span style={{ fontSize: '12px', transition: 'transform 0.2s', transform: showProjectFiles ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {showProjectFiles && (() => {
                  // Build a set of PNG filenames that are companions to text artwork JSON files
                  const textArtworkPngs = new Set<string>()
                  projectFiles.forEach(pf => {
                    if (pf.filename.startsWith('text-artwork_') && pf.filename.endsWith('.json')) {
                      textArtworkPngs.add(pf.filename.replace('.json', '.png'))
                    }
                  })

                  // Filter out companion PNGs — the JSON entry represents the text artwork
                  const visibleFiles = projectFiles.filter(pf => !textArtworkPngs.has(pf.filename))

                  // Find matching PNG thumbnail for a text artwork JSON
                  const findTextArtworkThumbnail = (jsonFilename: string): string | undefined => {
                    const pngName = jsonFilename.replace('.json', '.png')
                    const pngFile = projectFiles.find(pf => pf.filename === pngName)
                    return pngFile?.url
                  }

                  return (
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}>
                    {visibleFiles.map((pf, idx) => {
                      const isImage = pf.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pf.filename)
                      const isTextArtwork = pf.filename.startsWith('text-artwork_') && pf.filename.endsWith('.json')
                      const isLoading = loadingProjectFile === pf.url
                      const ext = pf.filename.split('.').pop()?.toUpperCase() || '?'
                      const thumbnailUrl = isTextArtwork ? findTextArtworkThumbnail(pf.filename) : undefined
                      return (
                        <button
                          key={idx}
                          onClick={() => handleProjectFileClick(pf)}
                          disabled={isLoading}
                          title={pf.filename}
                          style={{
                            padding: '6px',
                            background: '#1e1f25',
                            border: `1px solid ${isTextArtwork ? 'rgba(59,130,246,0.3)' : 'rgba(148,163,184,0.2)'}`,
                            borderRadius: '6px',
                            cursor: isLoading ? 'wait' : 'pointer',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: '10px',
                            opacity: isLoading ? 0.5 : 1,
                            width: '100%',
                            textAlign: 'left',
                          }}
                        >
                          {isTextArtwork ? (
                            thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt="Text artwork"
                                style={{
                                  width: '48px',
                                  height: '48px',
                                  objectFit: 'contain',
                                  borderRadius: '4px',
                                  background: '#fff',
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '48px',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                borderRadius: '4px',
                                color: '#3b82f6',
                                fontSize: '18px',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}>
                                Aa
                              </div>
                            )
                          ) : isImage ? (
                            <img
                              src={pf.thumbnail_url || pf.url}
                              alt={pf.filename}
                              style={{
                                width: '48px',
                                height: '48px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                background: '#fff',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '48px',
                              height: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#282a30',
                              borderRadius: '4px',
                              color: '#94a3b8',
                              fontSize: '11px',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>
                              {ext}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              color: isTextArtwork ? '#93c5fd' : '#f1f5f9',
                              fontSize: '12px',
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {isTextArtwork ? pf.filename.replace('text-artwork_', '').replace(/(_\d+)?\.json$/, '') : pf.filename}
                            </div>
                            {isTextArtwork && (
                              <div style={{ color: '#3b82f6', fontSize: '10px', marginTop: '2px' }}>
                                Editable Text
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  )
                })()}
              </div>
            )}

            {/* Add Text */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                Add Text
              </h3>
              <button
                onClick={addTextElement}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Add Text
              </button>
            </div>

            {/* Placement Presets */}
            {selectedLogo && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Quick Placement
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {PLACEMENT_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      style={{
                        padding: '8px',
                        background: '#282a30',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '6px',
                        color: '#94a3b8',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Logo Properties */}
            {selectedLogo && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Adjust Logo
                </h3>

                {/* Size */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Size: {(selectedLogo.width * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={selectedLogo.width * 100}
                    onChange={(e) => {
                      const width = parseFloat(e.target.value) / 100
                      const height = selectedLogo.aspectRatio ? width / selectedLogo.aspectRatio : width
                      updateLogo(selectedLogo.id, { width, height })
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Rotation */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Rotation: {selectedLogo.rotation}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedLogo.rotation}
                    onChange={(e) => updateLogo(selectedLogo.id, { rotation: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Logo Color Controls */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                    {selectedLogo.isDst ? 'Thread Color' : 'Logo Colors (SVG)'}
                  </h4>
                  {selectedLogo.isDst && selectedLogo.dstBuffer ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        value={selectedLogo.threadColor || '#1a1a8b'}
                        onChange={(e) => updateDstColor(selectedLogo.id, e.target.value)}
                        style={{
                          width: '40px',
                          height: '24px',
                          border: '1px solid rgba(148,163,184,0.3)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                        title="Thread color"
                      />
                      <input
                        type="text"
                        value={selectedLogo.threadColor || '#1a1a8b'}
                        onChange={(e) => {
                          const value = e.target.value
                          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                            updateDstColor(selectedLogo.id, value)
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          background: '#1d1d1d',
                          border: '1px solid rgba(148,163,184,0.2)',
                          borderRadius: '4px',
                          color: '#f1f5f9',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                        placeholder="#1a1a8b"
                      />
                    </div>
                  ) : selectedLogo.isSvg && selectedLogo.colorMap && Object.keys(selectedLogo.colorMap).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Object.entries(selectedLogo.colorMap).map(([originalColor, currentColor]) => (
                        <div key={originalColor} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Original color preview */}
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: '1px solid rgba(148,163,184,0.3)',
                              background: originalColor,
                              flexShrink: 0
                            }}
                            title={`Original: ${originalColor}`}
                          />
                          <span style={{ color: '#64748b', fontSize: '12px' }}>→</span>
                          {/* Color picker for new color */}
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => updateSvgColor(selectedLogo.id, originalColor, e.target.value)}
                            style={{
                              width: '40px',
                              height: '24px',
                              border: '1px solid rgba(148,163,184,0.3)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                            title={`Change from ${originalColor}`}
                          />
                          {/* Hex input */}
                          <input
                            type="text"
                            value={currentColor}
                            onChange={(e) => {
                              const value = e.target.value
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                updateSvgColor(selectedLogo.id, originalColor, value)
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '4px 6px',
                              background: '#1d1d1d',
                              border: '1px solid rgba(148,163,184,0.2)',
                              borderRadius: '4px',
                              color: '#f1f5f9',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }}
                            placeholder="#000000"
                          />
                          {/* Reset button */}
                          {currentColor !== originalColor && (
                            <button
                              onClick={() => updateSvgColor(selectedLogo.id, originalColor, originalColor)}
                              style={{
                                padding: '4px 8px',
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '4px',
                                color: '#ef4444',
                                fontSize: '11px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                              title="Reset to original"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !selectedLogo.isDst ? (
                    <div style={{ padding: '12px', background: '#1d1d1d', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.2)' }}>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                        {selectedLogo.isSvg
                          ? 'No colors detected in this SVG. Try re-uploading the logo.'
                          : 'Upload an SVG or DST file to change colors.'}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Background Removal - Only for non-SVG images */}
                {!selectedLogo.isSvg && (
                  <div style={{ marginBottom: '16px' }}>
                    <button
                      onClick={() => toggleBackground(selectedLogo.id)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: selectedLogo.backgroundRemoved
                          ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                          : 'rgba(139,92,246,0.15)',
                        border: selectedLogo.backgroundRemoved
                          ? 'none'
                          : '1px solid rgba(139,92,246,0.3)',
                        borderRadius: '6px',
                        color: selectedLogo.backgroundRemoved ? 'white' : '#a78bfa',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {selectedLogo.backgroundRemoved ? (
                        <>
                          <span>✓</span>
                          <span>Background Removed</span>
                        </>
                      ) : (
                        <>
                          <span>✂</span>
                          <span>Remove Background</span>
                        </>
                      )}
                    </button>
                    {selectedLogo.backgroundRemoved && (
                      <p style={{
                        color: '#64748b',
                        fontSize: '11px',
                        marginTop: '6px',
                        textAlign: 'center'
                      }}>
                        Click again to restore original
                      </p>
                    )}
                  </div>
                )}

                {/* AI Enhance — full tool suite */}
                {!selectedLogo.isDst && (
                  <div style={{ marginBottom: '16px' }}>
                    <button
                      onClick={() => openEnhanceModal(selectedLogo.id)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'rgba(34,211,238,0.1)',
                        border: '1px solid rgba(34,211,238,0.3)',
                        borderRadius: '6px',
                        color: '#22d3ee',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>✦</span>
                      <span>Enhance with AI</span>
                    </button>
                    <p style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', textAlign: 'center' }}>
                      Remove BG, upscale, vectorize, crop, color replace
                    </p>
                  </div>
                )}

                {/* Replace with Upload */}
                {selectedLogo.isPlaceholder && (
                  <>
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
                      onChange={handleReplaceLogo}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => replaceInputRef.current?.click()}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '8px',
                        background: 'rgba(34,197,94,0.15)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: '6px',
                        color: '#22c55e',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Replace with Artwork
                    </button>
                  </>
                )}

                {/* Delete */}
                <button
                  onClick={() => deleteLogo(selectedLogo.id)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '6px',
                    color: '#ef4444',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Remove Logo
                </button>
              </div>
            )}

            {/* Text Properties */}
            {selectedText && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Edit Text
                </h3>

                {/* Text Input - Textarea for multi-line */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Text <span style={{ color: '#64748b', fontSize: '11px' }}>(Shift+Enter for new line)</span>
                  </label>
                  <textarea
                    value={selectedText.text}
                    onChange={(e) => updateTextElement(selectedText.id, { text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault() // plain Enter does nothing (Shift+Enter inserts newline)
                      }
                    }}
                    rows={Math.min(5, Math.max(2, selectedText.text.split('\n').length))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: '6px',
                      color: '#f1f5f9',
                      fontSize: '13px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.4,
                    }}
                  />
                </div>

                {/* Toolbar row: Alignment + Weight */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {/* Alignment buttons */}
                  {(['left', 'center', 'right', 'justify'] as const).map(align => {
                    const icons: Record<string, string> = { left: '≡◁', center: '≡', right: '▷≡', justify: '⊞' }
                    const labels: Record<string, string> = { left: 'Left', center: 'Center', right: 'Right', justify: 'Justify' }
                    const isActive = (selectedText.textAlign || 'center') === align
                    return (
                      <button
                        key={align}
                        onClick={() => updateTextElement(selectedText.id, { textAlign: align })}
                        title={labels[align]}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          background: isActive ? '#3b82f6' : '#1d1d1d',
                          border: `1px solid ${isActive ? '#3b82f6' : 'rgba(148,163,184,0.2)'}`,
                          borderRadius: '4px',
                          color: isActive ? 'white' : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {labels[align]}
                      </button>
                    )
                  })}
                </div>

                {/* Weight buttons */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {([
                    { value: 300, label: 'Thin' },
                    { value: 400, label: 'Normal' },
                    { value: 700, label: 'Bold' },
                  ] as const).map(w => {
                    const isActive = (selectedText.fontWeight || 400) === w.value
                    return (
                      <button
                        key={w.value}
                        onClick={() => updateTextElement(selectedText.id, { fontWeight: w.value })}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          background: isActive ? '#3b82f6' : '#1d1d1d',
                          border: `1px solid ${isActive ? '#3b82f6' : 'rgba(148,163,184,0.2)'}`,
                          borderRadius: '4px',
                          color: isActive ? 'white' : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: w.value,
                          cursor: 'pointer',
                        }}
                      >
                        {w.label}
                      </button>
                    )
                  })}
                </div>

                {/* Font Family - categorized */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Font
                  </label>
                  <select
                    value={selectedText.fontFamily}
                    onChange={(e) => updateTextElement(selectedText.id, { fontFamily: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: '6px',
                      color: '#f1f5f9',
                      fontSize: '13px',
                      fontFamily: selectedText.fontFamily,
                    }}
                  >
                    {FONT_CATEGORIES.map(cat => (
                      <optgroup key={cat.label} label={cat.label}>
                        {cat.fonts.map(font => (
                          <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Size: {selectedText.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="200"
                    value={selectedText.fontSize}
                    onChange={(e) => updateTextElement(selectedText.id, { fontSize: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Line Spacing */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Line Spacing: {(selectedText.lineSpacing || 1.25).toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="3"
                    step="0.05"
                    value={selectedText.lineSpacing || 1.25}
                    onChange={(e) => updateTextElement(selectedText.id, { lineSpacing: parseFloat(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Fill Color */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Fill Color
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selectedText.color}
                      onChange={(e) => updateTextElement(selectedText.id, { color: e.target.value })}
                      style={{
                        width: '40px',
                        height: '32px',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <input
                      type="text"
                      value={selectedText.color}
                      onChange={(e) => updateTextElement(selectedText.id, { color: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        background: '#1d1d1d',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>

                {/* Stroke */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Stroke: {selectedText.strokeWidth > 0 ? `${selectedText.strokeWidth}px` : 'Off'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={selectedText.strokeWidth || 0}
                    onChange={(e) => updateTextElement(selectedText.id, { strokeWidth: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  {selectedText.strokeWidth > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <input
                          type="color"
                          value={selectedText.strokeColor || '#000000'}
                          onChange={(e) => updateTextElement(selectedText.id, { strokeColor: e.target.value })}
                          style={{
                            width: '40px',
                            height: '32px',
                            border: '1px solid rgba(148,163,184,0.2)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="text"
                          value={selectedText.strokeColor || '#000000'}
                          onChange={(e) => updateTextElement(selectedText.id, { strokeColor: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            background: '#1d1d1d',
                            border: '1px solid rgba(148,163,184,0.2)',
                            borderRadius: '6px',
                            color: '#f1f5f9',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Offset Path */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Offset Path: {(selectedText.offsetPathWidth || 0) > 0 ? `${selectedText.offsetPathWidth}px` : 'Off'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={selectedText.offsetPathWidth || 0}
                    onChange={(e) => updateTextElement(selectedText.id, { offsetPathWidth: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  {(selectedText.offsetPathWidth || 0) > 0 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={selectedText.offsetPathColor || '#000000'}
                        onChange={(e) => updateTextElement(selectedText.id, { offsetPathColor: e.target.value })}
                        style={{
                          width: '40px',
                          height: '32px',
                          border: '1px solid rgba(148,163,184,0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />
                      <input
                        type="text"
                        value={selectedText.offsetPathColor || '#000000'}
                        onChange={(e) => updateTextElement(selectedText.id, { offsetPathColor: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: '#1d1d1d',
                          border: '1px solid rgba(148,163,184,0.2)',
                          borderRadius: '6px',
                          color: '#f1f5f9',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Roster Variable Toggle */}
                <div style={{
                  marginBottom: '12px',
                  padding: '10px',
                  background: selectedText.isVariable ? 'rgba(139,92,246,0.1)' : 'transparent',
                  border: `1px solid ${selectedText.isVariable ? 'rgba(139,92,246,0.3)' : 'rgba(148,163,184,0.15)'}`,
                  borderRadius: '8px',
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={!!selectedText.isVariable}
                      onChange={(e) => {
                        const isVar = e.target.checked
                        updateTextElement(selectedText.id, {
                          isVariable: isVar,
                          variableName: isVar ? (selectedText.variableName || selectedText.text.split('\n')[0].trim()) : undefined,
                        })
                      }}
                      style={{ accentColor: '#8b5cf6' }}
                    />
                    <span>Use as Roster Variable</span>
                  </label>
                  {selectedText.isVariable && (
                    <input
                      type="text"
                      value={selectedText.variableName || ''}
                      onChange={(e) => updateTextElement(selectedText.id, { variableName: e.target.value })}
                      placeholder="Variable name (e.g. Player Name)"
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '6px 8px',
                        background: '#1d1d1d',
                        border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '12px',
                      }}
                    />
                  )}
                </div>

                {/* Rotation */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Rotation: {selectedText.rotation}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedText.rotation}
                    onChange={(e) => updateTextElement(selectedText.id, { rotation: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Save as Project File */}
                {onSaveTextArtwork && (
                  selectedText.sourceProjectFile ? (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <button
                        onClick={() => saveTextAsProjectFile('update')}
                        disabled={savingTextArtwork}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          background: savingTextArtwork ? '#282a30' : 'rgba(59,130,246,0.15)',
                          border: '1px solid rgba(59,130,246,0.3)',
                          borderRadius: '6px',
                          color: savingTextArtwork ? '#64748b' : '#3b82f6',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: savingTextArtwork ? 'wait' : 'pointer',
                        }}
                      >
                        {savingTextArtwork ? '...' : 'Update'}
                      </button>
                      <button
                        onClick={() => saveTextAsProjectFile('new')}
                        disabled={savingTextArtwork}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          background: savingTextArtwork ? '#282a30' : 'rgba(34,197,94,0.15)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          borderRadius: '6px',
                          color: savingTextArtwork ? '#64748b' : '#22c55e',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: savingTextArtwork ? 'wait' : 'pointer',
                        }}
                      >
                        {savingTextArtwork ? '...' : 'Save as New'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => saveTextAsProjectFile('new')}
                      disabled={savingTextArtwork}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '8px',
                        background: savingTextArtwork ? '#282a30' : 'rgba(34,197,94,0.15)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: '6px',
                        color: savingTextArtwork ? '#64748b' : '#22c55e',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: savingTextArtwork ? 'wait' : 'pointer',
                      }}
                    >
                      {savingTextArtwork ? 'Saving...' : 'Save Text as Project File'}
                    </button>
                  )
                )}

                {/* Delete */}
                <button
                  onClick={() => deleteTextElement(selectedText.id)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '6px',
                    color: '#ef4444',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Remove Text
                </button>
              </div>
            )}

            {/* Logos List */}
            {activeLogos.length > 0 && (
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Logos ({activeLogos.length})
                </h3>
                {activeLogos.map((logo, index) => (
                  <div
                    key={logo.id}
                    onClick={() => setSelectedLogoId(logo.id)}
                    style={{
                      padding: '8px',
                      background: selectedLogoId === logo.id ? '#282a30' : '#1d1d1d',
                      border: `1px solid ${selectedLogoId === logo.id ? '#8b5cf6' : 'rgba(148,163,184,0.2)'}`,
                      borderRadius: '6px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <img src={logo.url} alt={`Logo ${index + 1}`} style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                    <span style={{ color: logo.isPlaceholder ? '#f59e0b' : '#94a3b8', fontSize: '13px' }}>
                      {logo.isPlaceholder ? 'Placeholder' : `Logo ${index + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Text Elements List */}
            {activeTexts.length > 0 && (
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Text Elements ({activeTexts.length})
                </h3>
                {activeTexts.map((text, index) => (
                  <div
                    key={text.id}
                    onClick={() => {
                      setSelectedTextId(text.id)
                      setSelectedLogoId(null)
                    }}
                    style={{
                      padding: '8px',
                      background: selectedTextId === text.id ? '#282a30' : '#1d1d1d',
                      border: `1px solid ${selectedTextId === text.id ? '#3b82f6' : 'rgba(148,163,184,0.2)'}`,
                      borderRadius: '6px',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Text {index + 1}: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{text.text.split('\n')[0]}{text.text.includes('\n') ? '...' : ''}</span>
                      {text.isVariable && (
                        <span style={{ background: '#8b5cf6', color: 'white', fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>VAR</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Roster Panel */}
        {hasVariables && (
          <div style={{
            borderTop: '1px solid rgba(148,163,184,0.2)',
            padding: '12px 24px',
            background: '#161618',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <button
                onClick={() => setShowRosterPanel(!showRosterPanel)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#8b5cf6',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <span style={{ transform: showRosterPanel ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
                Team Roster ({roster.length} player{roster.length !== 1 ? 's' : ''})
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {roster.length > 0 && showRosterPanel && (
                  <span style={{ color: '#64748b', fontSize: '11px' }}>
                    Previewing: Player 1 of {roster.length}
                  </span>
                )}
                <button
                  onClick={() => setShowVariableBadges(!showVariableBadges)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: showVariableBadges ? '#8b5cf6' : '#475569',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                  title={showVariableBadges ? 'Hide variable badges' : 'Show variable badges'}
                >{showVariableBadges ? 'Hide Badges' : 'Show Badges'}</button>
              </div>
            </div>

            {showRosterPanel && (
              <div>
                {/* Roster Table */}
                <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 8px', color: '#64748b', fontSize: '11px', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>#</th>
                        {variableTexts.map(vt => (
                          <th key={vt.id} style={{ padding: '6px 8px', color: '#8b5cf6', fontSize: '11px', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                            {vt.variableName}
                          </th>
                        ))}
                        <th style={{ padding: '6px 8px', width: '30px', borderBottom: '1px solid rgba(148,163,184,0.2)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((entry, idx) => (
                        <tr key={entry.id}>
                          <td style={{ padding: '4px 8px', color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                          {variableTexts.map(vt => (
                            <td key={vt.id} style={{ padding: '2px 4px' }}>
                              <input
                                type="text"
                                value={entry.values[vt.variableName!] || ''}
                                onChange={(e) => updateRosterCell(entry.id, vt.variableName!, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  background: '#1d1d1d',
                                  border: '1px solid rgba(148,163,184,0.15)',
                                  borderRadius: '4px',
                                  color: '#f1f5f9',
                                  fontSize: '12px',
                                }}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '2px 4px' }}>
                            <button
                              onClick={() => removeRosterRow(entry.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                            >&times;</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={addRosterRow}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(139,92,246,0.15)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: '6px',
                      color: '#8b5cf6',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >+ Add Row</button>
                  <button
                    onClick={() => { setCsvText(''); setShowCsvModal(true) }}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: '6px',
                      color: '#3b82f6',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >Paste from Spreadsheet</button>
                  {roster.length > 0 && (
                    <button
                      onClick={() => setRoster([])}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >Clear All</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CSV Paste Modal */}
        {showCsvModal && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}>
            <div style={{
              background: '#1e1e20',
              borderRadius: '12px',
              padding: '24px',
              width: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid rgba(148,163,184,0.2)',
            }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                Paste Roster from Spreadsheet
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px' }}>
                Paste tab-separated or comma-separated data. First row should be headers matching your variable names: {variableTexts.map(v => v.variableName).join(', ')}
              </p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`${variableTexts.map(v => v.variableName).join('\t')}\nJohn Smith\t23\nJane Doe\t7`}
                style={{
                  width: '100%',
                  height: '200px',
                  padding: '10px',
                  background: '#161618',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  marginBottom: '12px',
                }}
              />
              {/* CSV file input */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  background: 'rgba(148,163,184,0.1)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}>
                  Or upload .csv file
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          setCsvText(ev.target?.result as string || '')
                        }
                        reader.readAsText(file)
                      }
                    }}
                  />
                </label>
              </div>
              {/* Preview */}
              {csvText.trim() && (() => {
                const parsed = parseCsvText(csvText)
                return parsed.length > 0 ? (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ color: '#22c55e', fontSize: '12px', marginBottom: '6px' }}>
                      Preview: {parsed.length} player{parsed.length !== 1 ? 's' : ''} detected
                    </div>
                    <div style={{ maxHeight: '120px', overflow: 'auto', background: '#161618', borderRadius: '6px', padding: '8px' }}>
                      {parsed.slice(0, 5).map((entry, i) => (
                        <div key={i} style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}>
                          {i + 1}. {Object.entries(entry.values).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                        </div>
                      ))}
                      {parsed.length > 5 && (
                        <div style={{ color: '#64748b', fontSize: '11px' }}>...and {parsed.length - 5} more</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '12px' }}>
                    Could not parse any rows. Check your format.
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCsvModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={() => {
                    const parsed = parseCsvText(csvText)
                    if (parsed.length > 0) {
                      setRoster(parsed)
                      setShowCsvModal(false)
                      setShowRosterPanel(true)
                    }
                  }}
                  disabled={!csvText.trim()}
                  style={{
                    padding: '8px 16px',
                    background: csvText.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : '#282a30',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: csvText.trim() ? 'pointer' : 'not-allowed',
                  }}
                >Import Roster</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(148,163,184,0.2)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveMockup}
            disabled={isSavingMockup || (logos.length === 0 && textElements.length === 0)}
            style={{
              padding: '10px 24px',
              background: logos.length === 0 && textElements.length === 0 ? '#282a30' : isSavingMockup ? '#16a34a' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: logos.length === 0 && textElements.length === 0 || isSavingMockup ? 'not-allowed' : 'pointer',
              opacity: logos.length === 0 && textElements.length === 0 ? 0.5 : isSavingMockup ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSavingMockup && (
              <div style={{
                width: 16, height: 16,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
            {isSavingMockup ? 'Saving...' : 'Save Mockup'}
          </button>
          {hasVariables && roster.length > 0 && (
            <button
              onClick={async () => {
                if (!roster.every(r => variableTexts.every(vt => r.values[vt.variableName!]?.trim()))) {
                  alert('Some roster entries have empty values. Please fill in all fields.')
                  return
                }
                setGeneratingPrints(true)
                setGenerateProgress({ current: 0, total: roster.length })
                try {
                  // Step 1: Generate SVG files for each player
                  const svgFiles: { filename: string; svgContent: string }[] = []
                  const multipleLocations = LOCATIONS.filter(loc =>
                    logos.some(l => l.location === loc) || textElements.some(t => t.location === loc)
                  ).length > 1

                  for (let i = 0; i < roster.length; i++) {
                    setGenerateProgress({ current: i + 1, total: roster.length })
                    const entry = roster[i]
                    const playerLabel = Object.values(entry.values).filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_') || `player_${i + 1}`

                    for (const location of LOCATIONS) {
                      const locLogos = logos.filter(l => l.location === location)
                      const locTexts = textElements.filter(t => t.location === location)
                      if (locLogos.length === 0 && locTexts.length === 0) continue

                      const svgContent = await generateSvgForLocation(location, entry)
                      const locationSuffix = multipleLocations ? `_${location}` : ''
                      svgFiles.push({
                        filename: `${playerLabel}${locationSuffix}.svg`,
                        svgContent,
                      })
                    }
                  }

                  // Step 2: Bundle SVGs into a zip and download
                  const zip = new JSZip()
                  for (const file of svgFiles) {
                    zip.file(file.filename, file.svgContent)
                  }
                  const zipBlob = await zip.generateAsync({ type: 'blob' })
                  const zipUrl = URL.createObjectURL(zipBlob)
                  const link = document.createElement('a')
                  link.href = zipUrl
                  link.download = `${orderNumber || 'team'}_print_files.zip`
                  link.click()
                  URL.revokeObjectURL(zipUrl)

                  setLastGeneratedSvgs(svgFiles)
                  alert(`Generated ${svgFiles.length} print file${svgFiles.length !== 1 ? 's' : ''}${documentId ? ' and saved to project files' : ''}. Zip downloaded.`)
                } catch (err) {
                  console.error('Error generating print files:', err)
                  alert('Failed to generate print files. Check console for details.')
                } finally {
                  setGeneratingPrints(false)
                }
              }}
              disabled={generatingPrints}
              style={{
                padding: '10px 24px',
                background: generatingPrints ? '#282a30' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: generatingPrints ? 'wait' : 'pointer',
              }}
            >
              {generatingPrints
                ? `Generating ${generateProgress.current}/${generateProgress.total}...`
                : `Generate Print Files (${roster.length})`
              }
            </button>
          )}
          {lastGeneratedSvgs.length > 0 && (
            <button
              onClick={() => {
                sessionStorage.setItem('gangSheetFiles', JSON.stringify(lastGeneratedSvgs))
                router.push('/gang-sheet-builder')
              }}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create Gang Sheet ({lastGeneratedSvgs.length})
            </button>
          )}
        </div>
      </div>

      {/* AI Enhance Modal */}
      {enhanceImage && (
        <ImagePrepModal
          images={[enhanceImage]}
          onRemoveBg={enhanceHandleRemoveBg}
          onUpscale={enhanceHandleUpscale}
          onVectorize={enhanceHandleVectorize}
          onCleanEdges={enhanceHandleCleanEdges}
          onSmoothEdges={enhanceHandleSmoothEdges}
          onComplete={enhanceHandleComplete}
          onApplyLocalEdit={enhanceHandleLocalEdit}
          aiProcessingState={enhanceAiState}
        />
      )}
    </div>
  )
}
