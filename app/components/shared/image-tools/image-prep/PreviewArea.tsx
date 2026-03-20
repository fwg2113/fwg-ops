'use client'

import { useRef, useCallback, useEffect } from 'react'
import { previewBgClass, previewBgStyle } from '../PreviewBgSelector'
import { Magnifier, LENS_SIZE, getZoomMultiplier } from './Magnifier'
import type { ImagePrepState } from './useImagePrepState'

const ZOOM_OPTIONS = [2, 3, 4, 6] as const

export function PreviewArea({ state }: { state: ImagePrepState }) {
  const {
    current, displayUrl, previewBg, magnifierActive, setMagnifierActive, activeTab,
    zoomLevel, setZoomLevel,
    cropRect, setCropRect, cropAspectLocked,
    edgeCleanupActive, frozenMagnifiers, handleFreezeClick, handleClearFrozen,
  } = state
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const sourceImgRef = useRef<HTMLImageElement | null>(null)

  // Source for magnifier: use previewUrl (rasterized PNG) for SVGs to avoid canvas taint
  const magnifierSrc = current.previewUrl ?? current.objectUrl

  // Preload source image for snapshot capture on freeze click
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = magnifierSrc
    sourceImgRef.current = img
    return () => { sourceImgRef.current = null }
  }, [magnifierSrc])

  // Generate a snapshot of the zoomed region at the given native coordinates
  const captureSnapshot = useCallback((nativeX: number, nativeY: number): string | null => {
    const sourceImg = sourceImgRef.current
    if (!sourceImg || !sourceImg.complete) return null
    const regionSize = Math.round(LENS_SIZE / getZoomMultiplier(zoomLevel))
    const canvas = document.createElement('canvas')
    canvas.width = LENS_SIZE
    canvas.height = LENS_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const sx = Math.max(0, Math.min(current.nativeWidth - regionSize, Math.round(nativeX - regionSize / 2)))
    const sy = Math.max(0, Math.min(current.nativeHeight - regionSize, Math.round(nativeY - regionSize / 2)))

    // Background matching selected preview background
    if (previewBg === 'checkerboard') {
      const tileSize = 6
      for (let row = 0; row < LENS_SIZE / tileSize; row++) {
        for (let col = 0; col < LENS_SIZE / tileSize; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#e5e5e5'
          ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize)
        }
      }
    } else {
      ctx.fillStyle = previewBg
      ctx.fillRect(0, 0, LENS_SIZE, LENS_SIZE)
    }

    try {
      ctx.drawImage(sourceImg, sx, sy, regionSize, regionSize, 0, 0, LENS_SIZE, LENS_SIZE)
    } catch {
      return null
    }
    return canvas.toDataURL('image/png')
  }, [current.nativeWidth, current.nativeHeight, zoomLevel, previewBg])

  // Click handler: freeze magnifier during edge cleanup
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    if (!edgeCleanupActive) return
    if (frozenMagnifiers.length >= 3) return
    const img = imgRef.current
    if (!img) return

    const imgRect = img.getBoundingClientRect()
    const imageAspect = current.nativeWidth / current.nativeHeight
    const containerAspect = imgRect.width / imgRect.height
    let renderW: number, renderH: number, offsetX: number, offsetY: number

    if (imageAspect > containerAspect) {
      renderW = imgRect.width
      renderH = imgRect.width / imageAspect
      offsetX = 0
      offsetY = (imgRect.height - renderH) / 2
    } else {
      renderH = imgRect.height
      renderW = imgRect.height * imageAspect
      offsetX = (imgRect.width - renderW) / 2
      offsetY = 0
    }

    const mouseX = e.clientX - imgRect.left - offsetX
    const mouseY = e.clientY - imgRect.top - offsetY

    // Convert to native coords
    const nativeX = (mouseX / renderW) * current.nativeWidth
    const nativeY = (mouseY / renderH) * current.nativeHeight

    // Only register clicks within the image bounds
    if (nativeX >= 0 && nativeX <= current.nativeWidth && nativeY >= 0 && nativeY <= current.nativeHeight) {
      const snapshotUrl = captureSnapshot(nativeX, nativeY)
      handleFreezeClick(e.clientX, e.clientY, nativeX, nativeY, snapshotUrl)
    }
  }, [edgeCleanupActive, frozenMagnifiers.length, current, handleFreezeClick, captureSnapshot])

  return (
    <div className="flex-1 relative overflow-hidden min-h-0">
      <div
        ref={containerRef}
        className={`w-full h-full flex items-center justify-center ${previewBgClass(previewBg)} ${
          magnifierActive || edgeCleanupActive ? 'cursor-crosshair' : ''
        }`}
        style={previewBgStyle(previewBg)}
        onClick={handlePreviewClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          key={`${current.id}-${displayUrl.slice(-20)}`}
          src={displayUrl}
          alt={current.fileName}
          className="max-w-full max-h-full object-contain transition-opacity duration-300"
          draggable={false}
        />

        {/* Crop overlay */}
        {activeTab === 'crop' && cropRect && (
          <CropOverlay
            rect={cropRect}
            onChange={setCropRect}
            containerRef={containerRef}
            imgRef={imgRef}
            nativeWidth={current.nativeWidth}
            nativeHeight={current.nativeHeight}
            aspectLocked={cropAspectLocked}
          />
        )}
      </div>

      {/* Magnifier controls — floating top-right */}
      {activeTab !== 'crop' && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          {/* Zoom level selector — only when magnifier is active */}
          {magnifierActive && (
            <div className="flex items-center bg-black/60 backdrop-blur-sm rounded-lg overflow-hidden">
              {ZOOM_OPTIONS.map(z => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    zoomLevel === z ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
          )}

          {/* Magnifier toggle */}
          <button
            onClick={() => setMagnifierActive(!magnifierActive)}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              magnifierActive
                ? 'bg-[#e41e31] text-white shadow-lg'
                : 'bg-black/60 backdrop-blur-sm text-white/70 hover:text-white'
            }`}
            title="Magnifier — Hover to zoom in on any area. Click to freeze. Use during Edge Clean Up to preview changes in real time."
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>
      )}

      {/* Instruction banner when edge cleanup active */}
      {edgeCleanupActive && frozenMagnifiers.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm z-10 max-w-[420px]">
          <span className="text-[11px] font-medium text-white/90 leading-snug">
            Move the magnifier to your edge, then click to freeze it. Move sliders to preview in real time.
          </span>
        </div>
      )}

      {/* Frozen magnifier windows */}
      {frozenMagnifiers.map(fm => (
        <div
          key={fm.id}
          className="fixed pointer-events-none z-[299]"
          style={{
            left: fm.screenX - LENS_SIZE / 2,
            top: fm.screenY - LENS_SIZE / 2,
            width: LENS_SIZE,
            height: LENS_SIZE,
            borderRadius: '50%',
            border: '3px solid #e41e31',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Background matching selected preview background */}
          <div
            className={`w-full h-full relative ${previewBg === 'checkerboard' ? 'checkerboard-bg' : ''}`}
            style={previewBg !== 'checkerboard' ? { backgroundColor: previewBg } : undefined}
          >
            {fm.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fm.previewUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : fm.snapshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fm.snapshotUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[10px] text-white/30">
                  {state.contractionRadius === 0 && state.smoothingRadius === 0 ? 'Drag a slider' : 'Loading...'}
                </span>
              </div>
            )}
          </div>
          {/* Crosshair overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[1px] h-full bg-white/15 absolute" />
            <div className="h-[1px] w-full bg-white/15 absolute" />
          </div>
        </div>
      ))}

      {/* Live magnifier lens — active during normal mode AND edge cleanup */}
      {magnifierActive && (
        <Magnifier
          src={magnifierSrc}
          containerRef={containerRef}
          imgRef={imgRef}
          nativeWidth={current.nativeWidth}
          nativeHeight={current.nativeHeight}
          zoomFactor={zoomLevel}
          previewBg={previewBg}
        />
      )}
    </div>
  )
}

// ── Crop Overlay ──

function CropOverlay({
  rect,
  onChange,
  containerRef,
  imgRef,
  nativeWidth,
  nativeHeight,
  aspectLocked,
}: {
  rect: { x: number; y: number; width: number; height: number }
  onChange: (r: { x: number; y: number; width: number; height: number }) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
  nativeWidth: number
  nativeHeight: number
  aspectLocked: boolean
}) {
  // Convert native px coords to display coords relative to container
  const img = imgRef.current
  const container = containerRef.current
  if (!img || !container) return null

  const containerRect = container.getBoundingClientRect()
  const imgRect = img.getBoundingClientRect()

  const imageAspect = nativeWidth / nativeHeight
  const containerAspect = imgRect.width / imgRect.height
  let renderW: number, renderH: number, offsetX: number, offsetY: number

  if (imageAspect > containerAspect) {
    renderW = imgRect.width
    renderH = imgRect.width / imageAspect
    offsetX = imgRect.left - containerRect.left
    offsetY = imgRect.top - containerRect.top + (imgRect.height - renderH) / 2
  } else {
    renderH = imgRect.height
    renderW = imgRect.height * imageAspect
    offsetX = imgRect.left - containerRect.left + (imgRect.width - renderW) / 2
    offsetY = imgRect.top - containerRect.top
  }

  const scale = renderW / nativeWidth
  const displayX = offsetX + rect.x * scale
  const displayY = offsetY + rect.y * scale
  const displayW = rect.width * scale
  const displayH = rect.height * scale

  const handleMouseDown = (e: React.MouseEvent, edge: string) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startRect = { ...rect }
    const aspect = rect.width / rect.height

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale

      const newRect = { ...startRect }

      if (edge === 'move') {
        newRect.x = Math.max(0, Math.min(nativeWidth - startRect.width, startRect.x + dx))
        newRect.y = Math.max(0, Math.min(nativeHeight - startRect.height, startRect.y + dy))
      } else {
        if (edge.includes('e')) newRect.width = Math.max(20, Math.min(nativeWidth - startRect.x, startRect.width + dx))
        if (edge.includes('w')) {
          const newW = Math.max(20, startRect.width - dx)
          newRect.x = startRect.x + startRect.width - newW
          newRect.width = newW
        }
        if (edge.includes('s')) newRect.height = Math.max(20, Math.min(nativeHeight - startRect.y, startRect.height + dy))
        if (edge.includes('n')) {
          const newH = Math.max(20, startRect.height - dy)
          newRect.y = startRect.y + startRect.height - newH
          newRect.height = newH
        }
        if (aspectLocked && (edge.includes('e') || edge.includes('w'))) {
          newRect.height = newRect.width / aspect
        }
      }

      newRect.x = Math.max(0, newRect.x)
      newRect.y = Math.max(0, newRect.y)
      onChange(newRect)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const handlePos: Record<string, { left: string; top: string; cursor: string }> = {
    nw: { left: '0', top: '0', cursor: 'nw-resize' },
    n: { left: '50%', top: '0', cursor: 'n-resize' },
    ne: { left: '100%', top: '0', cursor: 'ne-resize' },
    e: { left: '100%', top: '50%', cursor: 'e-resize' },
    se: { left: '100%', top: '100%', cursor: 'se-resize' },
    s: { left: '50%', top: '100%', cursor: 's-resize' },
    sw: { left: '0', top: '100%', cursor: 'sw-resize' },
    w: { left: '0', top: '50%', cursor: 'w-resize' },
  }

  return (
    <>
      {/* Dark mask */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(to right, rgba(0,0,0,0.5) ${displayX}px, transparent ${displayX}px, transparent ${displayX + displayW}px, rgba(0,0,0,0.5) ${displayX + displayW}px)`,
      }} />
      <div className="absolute pointer-events-none" style={{
        left: displayX, top: 0, width: displayW, height: displayY,
        backgroundColor: 'rgba(0,0,0,0.5)',
      }} />
      <div className="absolute pointer-events-none" style={{
        left: displayX, top: displayY + displayH, width: displayW, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
      }} />

      {/* Crop selection */}
      <div
        className="absolute border-2 border-dashed border-white cursor-move"
        style={{ left: displayX, top: displayY, width: displayW, height: displayH }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Handles */}
        {handles.map(h => (
          <div
            key={h}
            className="absolute w-3 h-3 bg-white border border-black/30 rounded-sm -translate-x-1/2 -translate-y-1/2"
            style={{ left: handlePos[h].left, top: handlePos[h].top, cursor: handlePos[h].cursor }}
            onMouseDown={(e) => handleMouseDown(e, h)}
          />
        ))}
      </div>
    </>
  )
}
