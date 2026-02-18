'use client'

import { useState, useRef, useEffect } from 'react'
import { renderDSTFile } from '@/app/lib/dstParser'

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
  onSave: (mockups: MockupImage[], logos: Logo[], textElements: TextElement[]) => void
  onSaveConfig: (logos: Logo[], textElements: TextElement[]) => void
  onClose: () => void
  onFileUpload?: (file: File) => void
}

export default function GarmentMockupBuilder({
  garmentImageUrl,
  garmentImageUrls,
  garmentName,
  colorName,
  initialLogos,
  initialTextElements,
  onSave,
  onSaveConfig,
  onClose,
  onFileUpload
}: GarmentMockupBuilderProps) {
  const [activeLocation, setActiveLocation] = useState<Location>('Front')
  const [logos, setLogos] = useState<Logo[]>(initialLogos || [])
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null)
  const [textElements, setTextElements] = useState<TextElement[]>(initialTextElements || [])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [resizeStartFontSize, setResizeStartFontSize] = useState(48)

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

  // Popular Google Fonts
  const GOOGLE_FONTS = [
    'Arial',
    'Roboto',
    'Open Sans',
    'Montserrat',
    'Lato',
    'Oswald',
    'Raleway',
    'Poppins',
    'Bebas Neue',
    'Anton',
    'Pacifico',
    'Lobster',
    'Impact',
    'Georgia',
    'Times New Roman'
  ]

  // Load Google Fonts dynamically
  useEffect(() => {
    const link = document.createElement('link')
    link.href = `https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&family=Open+Sans:wght@400;600&family=Montserrat:wght@400;600&family=Lato:wght@400;600&family=Oswald:wght@400;600&family=Raleway:wght@400;600&family=Poppins:wght@400;600&family=Bebas+Neue&family=Anton&family=Pacifico&family=Lobster&display=swap`
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      const isSvgFile = file.type === 'image/svg+xml' || file.name.endsWith('.svg')
      const isDesignFile = /\.(emb|dst|pdf)$/i.test(file.name)

      // Handle design files (DST = stitch render, PDF = page render, EMB = placeholder)
      if (isDesignFile) {
        const isDst = /\.dst$/i.test(file.name)
        const isPdf = /\.pdf$/i.test(file.name)

        // Upload the actual file as a line item attachment
        if (onFileUpload) {
          onFileUpload(file)
        }

        if (isDst) {
          // Render DST stitch preview
          renderDSTFile(file, 800).then(stitchDataUrl => {
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
                x: 0.35,
                y: 0.3,
                width: 0.3,
                height: height,
                rotation: 0,
                isSvg: false,
                aspectRatio
              }
              setLogos(prev => [...prev, newLogo])
              setSelectedLogoId(newLogo.id)
            }
            img.src = stitchDataUrl
          }).catch(() => {
            // Fallback to placeholder if parsing fails
            const placeholderUrl = createDesignFilePlaceholder(file.name)
            const newLogo: Logo = {
              id: `logo_${Date.now()}_${Math.random()}`,
              url: placeholderUrl,
              originalUrl: placeholderUrl,
              backgroundRemoved: false,
              location: activeLocation,
              x: 0.35, y: 0.3, width: 0.3, height: 0.3, rotation: 0,
              isSvg: false, aspectRatio: 1
            }
            setLogos(prev => [...prev, newLogo])
            setSelectedLogoId(newLogo.id)
          })
        } else if (isPdf) {
          // Render PDF first page using an object URL and canvas
          const pdfUrl = URL.createObjectURL(file)
          // Use an iframe/canvas approach - create a placeholder for now with the filename
          // PDF rendering requires pdf.js which we can add later for full vector support
          const placeholderUrl = createDesignFilePlaceholder(file.name)
          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url: placeholderUrl,
            originalUrl: placeholderUrl,
            backgroundRemoved: false,
            location: activeLocation,
            x: 0.35, y: 0.3, width: 0.3, height: 0.3, rotation: 0,
            isSvg: false, aspectRatio: 1
          }
          setLogos(prev => [...prev, newLogo])
          setSelectedLogoId(newLogo.id)
          URL.revokeObjectURL(pdfUrl)
        } else {
          // EMB and other formats - placeholder (no JS parser available for Wilcom EMB)
          const placeholderUrl = createDesignFilePlaceholder(file.name)
          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url: placeholderUrl,
            originalUrl: placeholderUrl,
            backgroundRemoved: false,
            location: activeLocation,
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
          // Parse SVG and extract colors
          const colors = extractSvgColors(content)
          const initialColorMap: { [key: string]: string } = {}
          colors.forEach(color => {
            initialColorMap[color] = color // Initially map to same color
          })

          // Convert SVG to data URL
          const svgBlob = new Blob([content], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(svgBlob)

          // Load image to get dimensions
          const img = new Image()
          await new Promise((resolve) => {
            img.onload = resolve
            img.src = url
          })

          const aspectRatio = img.naturalWidth / img.naturalHeight
          const height = 0.3 / aspectRatio // Maintain aspect ratio with width of 0.3

          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url,
            originalUrl: url,
            backgroundRemoved: false,
            location: activeLocation,
            x: 0.35,
            y: 0.3,
            width: 0.3,
            height: height,
            rotation: 0,
            isSvg: true,
            svgContent: content,
            colorMap: initialColorMap,
            aspectRatio
          }
          setLogos(prev => [...prev, newLogo])
          setSelectedLogoId(newLogo.id)
        } else {
          // Handle regular image files (PNG, JPG, etc.)
          // Load image to get dimensions
          const img = new Image()
          await new Promise((resolve) => {
            img.onload = resolve
            img.src = content
          })

          const aspectRatio = img.naturalWidth / img.naturalHeight
          const height = 0.3 / aspectRatio // Maintain aspect ratio with width of 0.3

          const newLogo: Logo = {
            id: `logo_${Date.now()}_${Math.random()}`,
            url: content,
            originalUrl: content,
            backgroundRemoved: false,
            location: activeLocation,
            x: 0.35,
            y: 0.3,
            width: 0.3,
            height: height,
            rotation: 0,
            isSvg: false,
            aspectRatio
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
    })
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
      rotation: 0
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
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
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

  // Generate mockup image for a specific location
  const generateMockupForLocation = async (location: Location): Promise<string> => {
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

    // Use high resolution while preserving the container's aspect ratio
    const CANVAS_W = 1200
    const CANVAS_H = Math.round(CANVAS_W / containerAspect)
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H

    // Draw garment image with object-fit:contain behaviour (matches preview)
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
    ctx.drawImage(garmentImg, gx, gy, gw, gh)

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
    const locationTexts = textElements.filter(t => t.location === location)
    for (const text of locationTexts) {
      const textX = text.x * canvas.width
      const textY = text.y * canvas.height

      ctx.save()
      ctx.translate(textX, textY)
      ctx.rotate((text.rotation * Math.PI) / 180)
      ctx.font = `${text.fontSize}px ${text.fontFamily}`
      ctx.fillStyle = text.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text.text, 0, 0)
      ctx.restore()
    }

    // Export as data URL
    return canvas.toDataURL('image/png')
  }

  // Generate mockup images for all locations with designs and save
  const handleSaveMockup = async () => {
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

    onSave(mockups, logos, textElements)
  }

  // Handle close - save config before closing
  const handleClose = () => {
    // Save the current config (logos and text) before closing
    onSaveConfig(logos, textElements)
    onClose()
  }

  // Filter elements by active location
  const activeLogos = logos.filter(l => l.location === activeLocation)
  const activeTexts = textElements.filter(t => t.location === activeLocation)

  const selectedLogo = logos.find(l => l.id === selectedLogoId)
  const selectedText = textElements.find(t => t.id === selectedTextId)

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

            {/* Canvas Container */}
            <div style={{
              flex: 1,
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <div
              ref={canvasRef}
              style={{
                position: 'relative',
                maxWidth: '600px',
                maxHeight: '600px',
                width: '100%',
                aspectRatio: '4/5',
                cursor: isDragging ? 'grabbing' : 'default'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
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

              {/* Text Elements */}
              {activeTexts.map(text => (
                <div
                  key={text.id}
                  onMouseDown={(e) => handleTextMouseDown(e, text.id)}
                  style={{
                    position: 'absolute',
                    left: `${text.x * 100}%`,
                    top: `${text.y * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
                    transformOrigin: 'center center',
                    cursor: isDragging && selectedTextId === text.id ? 'grabbing' : 'grab',
                    border: selectedTextId === text.id ? '2px solid #3b82f6' : '2px dashed transparent',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: selectedTextId === text.id ? 'none' : 'border 0.15s ease',
                    fontFamily: text.fontFamily,
                    fontSize: `${text.fontSize}px`,
                    color: text.color,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                  }}
                >
                  {text.text}

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
              ))}
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
                accept="image/*,.svg,.emb,.dst,.pdf"
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
            </div>

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

                {/* SVG Color Controls - Always visible */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                    Logo Colors (SVG)
                  </h4>
                  {selectedLogo.isSvg && selectedLogo.colorMap && Object.keys(selectedLogo.colorMap).length > 0 ? (
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
                  ) : (
                    <div style={{ padding: '12px', background: '#1d1d1d', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.2)' }}>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                        {selectedLogo.isSvg
                          ? 'No colors detected in this SVG. Try re-uploading the logo.'
                          : 'This is not an SVG logo. Only SVG logos support color changing.'}
                      </p>
                    </div>
                  )}
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

                {/* Text Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Text
                  </label>
                  <input
                    type="text"
                    value={selectedText.text}
                    onChange={(e) => updateTextElement(selectedText.id, { text: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: '6px',
                      color: '#f1f5f9',
                      fontSize: '13px'
                    }}
                  />
                </div>

                {/* Font Family */}
                <div style={{ marginBottom: '16px' }}>
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
                      fontSize: '13px'
                    }}
                  >
                    {GOOGLE_FONTS.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Size: {selectedText.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="16"
                    max="120"
                    value={selectedText.fontSize}
                    onChange={(e) => updateTextElement(selectedText.id, { fontSize: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Color */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                    Color
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selectedText.color}
                      onChange={(e) => updateTextElement(selectedText.id, { color: e.target.value })}
                      style={{
                        width: '50px',
                        height: '36px',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={selectedText.color}
                      onChange={(e) => updateTextElement(selectedText.id, { color: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#1d1d1d',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                {/* Rotation */}
                <div style={{ marginBottom: '16px' }}>
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
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Logo {index + 1}</span>
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
                    <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                      Text {index + 1}: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{text.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
            disabled={logos.length === 0 && textElements.length === 0}
            style={{
              padding: '10px 24px',
              background: logos.length === 0 && textElements.length === 0 ? '#282a30' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: logos.length === 0 && textElements.length === 0 ? 'not-allowed' : 'pointer',
              opacity: logos.length === 0 && textElements.length === 0 ? 0.5 : 1
            }}
          >
            Save Mockup
          </button>
        </div>
      </div>
    </div>
  )
}
