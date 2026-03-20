'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { PreviewBg } from '../PreviewBgSelector'

export const LENS_SIZE = 238

/** Map UI zoom labels (2x/3x/4x/6x) to actual magnification multipliers */
const ZOOM_STRENGTH: Record<number, number> = { 2: 0.5, 3: 0.75, 4: 1.0, 6: 1.5 }
export function getZoomMultiplier(label: number): number {
  return ZOOM_STRENGTH[label] ?? label
}

interface MagnifierProps {
  /** URL of image to sample from (rasterized PNG for SVGs) */
  src: string
  /** Container element to track mouse events on */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** The rendered img element (for computing object-fit:contain offset) */
  imgRef: React.RefObject<HTMLImageElement | null>
  /** Native image dimensions */
  nativeWidth: number
  nativeHeight: number
  /** Zoom level (default 3x) */
  zoomFactor?: number
  /** Preview background — determines canvas fill behind transparent pixels */
  previewBg?: PreviewBg
}

export function Magnifier({ src, containerRef, imgRef, nativeWidth, nativeHeight, zoomFactor = 3, previewBg = 'checkerboard' }: MagnifierProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceImgRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number>(0)
  const posRef = useRef({ x: 0, y: 0, visible: false })

  // Preload source image for fast canvas sampling
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    sourceImgRef.current = img
    return () => { sourceImgRef.current = null }
  }, [src])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const sourceImg = sourceImgRef.current
    const renderedImg = imgRef.current
    if (!canvas || !sourceImg || !sourceImg.complete || !renderedImg || !posRef.current.visible) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get the rendered image's actual displayed bounds within its container
    const imgRect = renderedImg.getBoundingClientRect()

    // Compute object-fit:contain offset
    const containerAspect = imgRect.width / imgRect.height
    const imageAspect = nativeWidth / nativeHeight
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

    // Mouse position relative to the rendered image area
    const mouseX = posRef.current.x - imgRect.left - offsetX
    const mouseY = posRef.current.y - imgRect.top - offsetY

    // Map to source image coordinates
    const srcX = (mouseX / renderW) * nativeWidth
    const srcY = (mouseY / renderH) * nativeHeight

    // Source region size (what the lens covers at native resolution)
    const srcSize = LENS_SIZE / getZoomMultiplier(zoomFactor)
    const sx = srcX - srcSize / 2
    const sy = srcY - srcSize / 2

    // Draw zoomed region
    ctx.clearRect(0, 0, LENS_SIZE, LENS_SIZE)

    // Clip to circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(LENS_SIZE / 2, LENS_SIZE / 2, LENS_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()

    // Background behind transparent pixels — matches selected preview background
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
      ctx.drawImage(sourceImg, sx, sy, srcSize, srcSize, 0, 0, LENS_SIZE, LENS_SIZE)
    } catch {
      // CORS or tainted canvas — fail silently
    }

    // Crosshair
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LENS_SIZE / 2, 0)
    ctx.lineTo(LENS_SIZE / 2, LENS_SIZE)
    ctx.moveTo(0, LENS_SIZE / 2)
    ctx.lineTo(LENS_SIZE, LENS_SIZE / 2)
    ctx.stroke()

    ctx.restore()
  }, [imgRef, nativeWidth, nativeHeight, zoomFactor, previewBg])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY, visible: true }
      if (canvasRef.current) {
        canvasRef.current.style.left = `${e.clientX - LENS_SIZE / 2}px`
        canvasRef.current.style.top = `${e.clientY - LENS_SIZE / 2}px`
        canvasRef.current.style.display = 'block'
      }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    const onLeave = () => {
      posRef.current.visible = false
      if (canvasRef.current) {
        canvasRef.current.style.display = 'none'
      }
    }

    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', onLeave)
    return () => {
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef, draw])

  return (
    <canvas
      ref={canvasRef}
      width={LENS_SIZE}
      height={LENS_SIZE}
      className="fixed pointer-events-none z-[300]"
      style={{
        display: 'none',
        width: LENS_SIZE,
        height: LENS_SIZE,
        borderRadius: '50%',
        border: '3px solid white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    />
  )
}
