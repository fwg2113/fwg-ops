'use client'

import { useState, useRef, useEffect } from 'react'

interface Logo {
  id: string
  url: string
  originalUrl: string // Store original before background removal
  backgroundRemoved: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

interface TextElement {
  id: string
  text: string
  x: number
  y: number
  fontSize: number // in pixels
  fontFamily: string
  color: string
  rotation: number
}

interface GarmentMockupBuilderProps {
  garmentImageUrl: string
  garmentName: string
  colorName: string
  onSave: (mockupDataUrl: string) => void
  onClose: () => void
}

export default function GarmentMockupBuilder({
  garmentImageUrl,
  garmentName,
  colorName,
  onSave,
  onClose
}: GarmentMockupBuilderProps) {
  const [logos, setLogos] = useState<Logo[]>([])
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null)
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Upload logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const url = event.target?.result as string
        const newLogo: Logo = {
          id: `logo_${Date.now()}_${Math.random()}`,
          url,
          originalUrl: url,
          backgroundRemoved: false,
          x: 0.35, // Center horizontally
          y: 0.3,  // Upper third
          width: 0.3,
          height: 0.3,
          rotation: 0
        }
        setLogos(prev => [...prev, newLogo])
        setSelectedLogoId(newLogo.id)
      }
      reader.readAsDataURL(file)
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

    setLogos(prev => prev.map(logo =>
      logo.id === selectedLogoId
        ? { ...logo, x: preset.x, y: preset.y, width: preset.width, height: preset.width }
        : logo
    ))
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

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent, logoId: string) => {
    e.preventDefault()
    setSelectedLogoId(logoId)
    setIsDragging(true)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      setDragStart({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = (e.clientX - rect.left) / rect.width
    const mouseY = (e.clientY - rect.top) / rect.height

    if (isDragging) {
      if (selectedLogoId) {
        // Move logo
        updateLogo(selectedLogoId, { x: mouseX, y: mouseY })
      } else if (selectedTextId) {
        // Move text
        updateTextElement(selectedTextId, { x: mouseX, y: mouseY })
      }
    } else if (isResizing && selectedLogoId) {
      // Resize from bottom-right corner
      const logo = logos.find(l => l.id === selectedLogoId)
      if (!logo) return

      const width = Math.max(0.05, mouseX - logo.x)
      const height = Math.max(0.05, mouseY - logo.y)
      const size = Math.max(width, height) // Keep aspect ratio
      updateLogo(selectedLogoId, { width: size, height: size })
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

  // Generate mockup image and save
  const handleSaveMockup = async () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Load garment image
    const garmentImg = new Image()
    garmentImg.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      garmentImg.onload = resolve
      garmentImg.onerror = reject
      garmentImg.src = garmentImageUrl
    })

    // Set canvas size to garment image size
    canvas.width = garmentImg.width || 800
    canvas.height = garmentImg.height || 1000

    // Draw garment
    ctx.drawImage(garmentImg, 0, 0, canvas.width, canvas.height)

    // Draw logos
    for (const logo of logos) {
      const logoImg = new Image()
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve
        logoImg.onerror = reject
        logoImg.src = logo.url
      })

      const logoX = logo.x * canvas.width
      const logoY = logo.y * canvas.height
      const logoW = logo.width * canvas.width
      const logoH = logo.height * canvas.height

      ctx.save()
      ctx.translate(logoX + logoW / 2, logoY + logoH / 2)
      ctx.rotate((logo.rotation * Math.PI) / 180)
      ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH)
      ctx.restore()
    }

    // Draw text elements
    for (const text of textElements) {
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
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  const selectedLogo = logos.find(l => l.id === selectedLogoId)
  const selectedText = textElements.find(t => t.id === selectedTextId)

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
            onClick={onClose}
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
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a'
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
                src={garmentImageUrl}
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
              {logos.map(logo => (
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
              {textElements.map(text => (
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
                accept="image/*"
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
                      const size = parseFloat(e.target.value) / 100
                      updateLogo(selectedLogo.id, { width: size, height: size })
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

                {/* Background Removal */}
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
            {logos.length > 0 && (
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Logos ({logos.length})
                </h3>
                {logos.map((logo, index) => (
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
            {textElements.length > 0 && (
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Text Elements ({textElements.length})
                </h3>
                {textElements.map((text, index) => (
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
            onClick={onClose}
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
