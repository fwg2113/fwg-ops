'use client'

import { useState, useRef, useEffect } from 'react'

interface Logo {
  id: string
  url: string
  x: number
  y: number
  width: number
  height: number
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
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (!isDragging || !selectedLogoId) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    updateLogo(selectedLogoId, { x, y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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

    // Export as data URL
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  const selectedLogo = logos.find(l => l.id === selectedLogoId)

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
                    cursor: 'grab',
                    border: selectedLogoId === logo.id ? '2px solid #8b5cf6' : '2px dashed transparent',
                    boxSizing: 'border-box',
                    transition: 'border 0.15s ease'
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
            disabled={logos.length === 0}
            style={{
              padding: '10px 24px',
              background: logos.length === 0 ? '#282a30' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: logos.length === 0 ? 'not-allowed' : 'pointer',
              opacity: logos.length === 0 ? 0.5 : 1
            }}
          >
            Save Mockup
          </button>
        </div>
      </div>
    </div>
  )
}
