'use client'

import { useState, useRef, useEffect } from 'react'

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
  onClose
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const LOCATIONS: Location[] = ['Front', 'Back', 'Sleeves']

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

  // Extract unique colors from SVG content
  const extractSvgColors = (svgContent: string): string[] => {
    const colors = new Set<string>()

    // Match fill and stroke attributes (with or without quotes)
    const fillMatches = svgContent.matchAll(/fill=["']?([^"'\s>]+)["']?/g)
    const strokeMatches = svgContent.matchAll(/stroke=["']?([^"'\s>]+)["']?/g)

    // Match style attributes
    const styleMatches = svgContent.matchAll(/style=["']([^"']+)["']/g)

    // Match <style> tag CSS rules
    const styleTagMatch = svgContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
    if (styleTagMatch) {
      const cssContent = styleTagMatch[1]
      const cssColorMatches = cssContent.matchAll(/(?:fill|stroke)\s*:\s*([^;}\s]+)/g)
      for (const match of cssColorMatches) {
        const color = match[1].trim().toLowerCase()
        if (color !== 'none' && color !== 'transparent' && color !== 'currentcolor' && !color.includes('url(') && !color.includes('var(')) {
          colors.add(normalizeColor(color))
        }
      }
    }

    for (const match of fillMatches) {
      const color = match[1].toLowerCase()
      if (color !== 'none' && color !== 'transparent' && color !== 'currentcolor' && !color.includes('url(')) {
        colors.add(normalizeColor(color))
      }
    }

    for (const match of strokeMatches) {
      const color = match[1].toLowerCase()
      if (color !== 'none' && color !== 'transparent' && color !== 'currentcolor' && !color.includes('url(')) {
        colors.add(normalizeColor(color))
      }
    }

    for (const match of styleMatches) {
      const style = match[1]
      const fillMatch = style.match(/fill:\s*([^;]+)/)
      const strokeMatch = style.match(/stroke:\s*([^;]+)/)

      if (fillMatch) {
        const color = fillMatch[1].trim().toLowerCase()
        if (color !== 'none' && color !== 'transparent' && color !== 'currentcolor' && !color.includes('url(')) {
          colors.add(normalizeColor(color))
        }
      }

      if (strokeMatch) {
        const color = strokeMatch[1].trim().toLowerCase()
        if (color !== 'none' && color !== 'transparent' && color !== 'currentcolor' && !color.includes('url(')) {
          colors.add(normalizeColor(color))
        }
      }
    }

    console.log('SVG Colors detected:', Array.from(colors))
    return Array.from(colors)
  }

  // Normalize color to hex format
  const normalizeColor = (color: string): string => {
    // If already hex, return it
    if (color.startsWith('#')) return color.toLowerCase()

    // Convert named colors and rgb to hex
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return color

    ctx.fillStyle = color
    return ctx.fillStyle
  }

  // Apply color mapping to SVG content
  const applySvgColorMap = (svgContent: string, colorMap: { [key: string]: string }): string => {
    let modifiedSvg = svgContent

    Object.entries(colorMap).forEach(([originalColor, newColor]) => {
      // Escape special regex characters in color strings
      const escapedOriginal = originalColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      // Replace in fill attributes (with or without quotes)
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`fill=["']${escapedOriginal}["']`, 'gi'),
        `fill="${newColor}"`
      )
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`fill=${escapedOriginal}(?=[\\s>])`, 'gi'),
        `fill="${newColor}"`
      )

      // Replace in stroke attributes (with or without quotes)
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`stroke=["']${escapedOriginal}["']`, 'gi'),
        `stroke="${newColor}"`
      )
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`stroke=${escapedOriginal}(?=[\\s>])`, 'gi'),
        `stroke="${newColor}"`
      )

      // Replace in style attributes
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`fill:\\s*${escapedOriginal}`, 'gi'),
        `fill: ${newColor}`
      )
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`stroke:\\s*${escapedOriginal}`, 'gi'),
        `stroke: ${newColor}`
      )

      // Replace in CSS style tags
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`fill\\s*:\\s*${escapedOriginal}\\s*;`, 'gi'),
        `fill: ${newColor};`
      )
      modifiedSvg = modifiedSvg.replace(
        new RegExp(`stroke\\s*:\\s*${escapedOriginal}\\s*;`, 'gi'),
        `stroke: ${newColor};`
      )
    })

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
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      const isSvgFile = file.type === 'image/svg+xml' || file.name.endsWith('.svg')

      const reader = new FileReader()
      reader.onload = async (event) => {
        const content = event.target?.result as string

        if (isSvgFile) {
          // Parse SVG and extract colors
          console.log('Processing SVG file, content length:', content.length)
          console.log('SVG content preview:', content.substring(0, 500))
          const colors = extractSvgColors(content)
          console.log('Extracted colors:', colors)
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
    } else if (isResizing && selectedLogoId) {
      // Resize from bottom-right corner
      const logo = logos.find(l => l.id === selectedLogoId)
      if (!logo) return

      const width = Math.max(0.05, mouseX - logo.x)
      const height = logo.aspectRatio ? width / logo.aspectRatio : width
      updateLogo(selectedLogoId, { width, height })
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

  // Generate mockup image for a specific location
  const generateMockupForLocation = async (location: Location): Promise<string> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    // Load garment image for this location
    const garmentImg = new Image()
    garmentImg.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      garmentImg.onload = resolve
      garmentImg.onerror = reject
      garmentImg.src = getGarmentImageForLocation(location)
    })

    // Set canvas size to garment image size
    canvas.width = garmentImg.width || 800
    canvas.height = garmentImg.height || 1000

    // Draw garment
    ctx.drawImage(garmentImg, 0, 0, canvas.width, canvas.height)

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
          // For regular images, set crossOrigin before src
          logoImg.crossOrigin = 'anonymous'
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve
            logoImg.onerror = reject
            logoImg.src = logo.url
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
      console.warn('No mockups generated - no designs found')
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

                  {/* Rotation Handle */}
                  {selectedTextId === text.id && (
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
                accept="image/*,.svg"
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
