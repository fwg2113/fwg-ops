/**
 * Edge contraction and contour smoothing for DTF transfers.
 * Ported from Frederick Apparel DTF Gang Sheet Builder.
 *
 * Uses a Chamfer 2-pass distance transform to contract opaque edges
 * inward, then applies contour-based smoothing for clean, hard edges.
 */

// ── Distance transform (Chamfer 2-pass approximation) ──

function computeDistanceToTransparent(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const dist = new Float32Array(w * h)
  const INF = w + h
  const DIAG = 1.41

  for (let i = 0; i < w * h; i++) {
    dist[i] = data[i * 4 + 3] === 0 ? 0 : INF
  }

  // Forward pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (dist[i] === 0) continue
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1)
      if (y > 0) dist[i] = Math.min(dist[i], dist[(y - 1) * w + x] + 1)
      if (x > 0 && y > 0) dist[i] = Math.min(dist[i], dist[(y - 1) * w + (x - 1)] + DIAG)
      if (x < w - 1 && y > 0) dist[i] = Math.min(dist[i], dist[(y - 1) * w + (x + 1)] + DIAG)
    }
  }

  // Backward pass
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (dist[i] === 0) continue
      if (x < w - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1)
      if (y < h - 1) dist[i] = Math.min(dist[i], dist[(y + 1) * w + x] + 1)
      if (x < w - 1 && y < h - 1) dist[i] = Math.min(dist[i], dist[(y + 1) * w + (x + 1)] + DIAG)
      if (x > 0 && y < h - 1) dist[i] = Math.min(dist[i], dist[(y + 1) * w + (x - 1)] + DIAG)
    }
  }

  return dist
}

function contractAlpha(data: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (radius <= 0) return
  const dist = computeDistanceToTransparent(data, w, h)
  for (let i = 0; i < w * h; i++) {
    const alpha = data[i * 4 + 3]
    if (alpha === 0) continue
    const d = dist[i]
    if (d >= radius) continue
    const factor = d / radius
    data[i * 4 + 3] = Math.round(alpha * factor)
  }
}

/**
 * Contour-based smoothing: binarize alpha mask, box blur, re-threshold.
 * Produces hard, clean edges along smooth curves — no soft edges.
 */
function contourSmooth(data: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (radius <= 0) return
  const n = w * h

  const mask = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    mask[i] = data[i * 4 + 3] > 128 ? 1.0 : 0.0
  }

  // Horizontal pass
  const hBlur = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w - 1, x + radius)
      let sum = 0
      for (let xi = x0; xi <= x1; xi++) sum += mask[y * w + xi]
      hBlur[y * w + x] = sum / (x1 - x0 + 1)
    }
  }

  // Vertical pass
  const blurred = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(h - 1, y + radius)
      let sum = 0
      for (let yi = y0; yi <= y1; yi++) sum += hBlur[yi * w + x]
      blurred[y * w + x] = sum / (y1 - y0 + 1)
    }
  }

  for (let i = 0; i < n; i++) {
    data[i * 4 + 3] = blurred[i] >= 0.5 ? 255 : 0
  }
}

// ── Load image helper ──

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

// ── Public API ──

export async function applyEdgeSmoothing(
  src: string,
  nativeWidth: number,
  nativeHeight: number,
  contractionRadius: number,
  smoothingRadius: number,
): Promise<{ url: string; width: number; height: number }> {
  const img = await loadImage(src)
  const w = img.naturalWidth || nativeWidth
  const h = img.naturalHeight || nativeHeight

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  contractAlpha(imageData.data, w, h, contractionRadius)
  contourSmooth(imageData.data, w, h, smoothingRadius)
  ctx.putImageData(imageData, 0, 0)

  return { url: canvas.toDataURL('image/png'), width: w, height: h }
}

export async function previewEdgeSmoothing(
  src: string,
  nativeWidth: number,
  nativeHeight: number,
  contractionRadius: number,
  smoothingRadius: number,
): Promise<string> {
  const img = await loadImage(src)
  const maxDim = 512
  const scale = Math.min(1, maxDim / Math.max(nativeWidth, nativeHeight))
  const w = Math.max(1, Math.round(nativeWidth * scale))
  const h = Math.max(1, Math.round(nativeHeight * scale))

  const scaledContraction = contractionRadius > 0 ? Math.max(1, Math.round(contractionRadius * scale)) : 0
  const scaledSmoothing = smoothingRadius > 0 ? Math.max(1, Math.round(smoothingRadius * scale)) : 0

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  contractAlpha(imageData.data, w, h, scaledContraction)
  contourSmooth(imageData.data, w, h, scaledSmoothing)
  ctx.putImageData(imageData, 0, 0)

  return canvas.toDataURL('image/png')
}

export async function findBestEdgeRegion(
  src: string,
  nativeWidth: number,
  nativeHeight: number,
): Promise<{ x: number; y: number; size: number }> {
  const img = await loadImage(src)

  const maxDim = 256
  const scale = Math.min(1, maxDim / Math.max(nativeWidth, nativeHeight))
  const w = Math.max(1, Math.round(nativeWidth * scale))
  const h = Math.max(1, Math.round(nativeHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const isEdge = new Uint8Array(w * h)
  const threshold = 30

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const alpha = data[idx * 4 + 3]
      const neighbors = [
        data[((y - 1) * w + x) * 4 + 3],
        data[((y + 1) * w + x) * 4 + 3],
        data[(y * w + x - 1) * 4 + 3],
        data[(y * w + x + 1) * 4 + 3],
      ]
      for (const n of neighbors) {
        if (Math.abs(alpha - n) > threshold) { isEdge[idx] = 1; break }
      }
    }
  }

  const blockSize = Math.max(8, Math.round(Math.min(w, h) / 6))
  let bestX = 0, bestY = 0, bestCount = 0

  for (let by = 0; by + blockSize <= h; by += Math.max(1, Math.floor(blockSize / 2))) {
    for (let bx = 0; bx + blockSize <= w; bx += Math.max(1, Math.floor(blockSize / 2))) {
      let count = 0
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          count += isEdge[(by + dy) * w + (bx + dx)]
        }
      }
      if (count > bestCount) { bestCount = count; bestX = bx; bestY = by }
    }
  }

  const invScale = 1 / scale
  const nativeSize = Math.round(blockSize * invScale)
  return {
    x: Math.round(bestX * invScale),
    y: Math.round(bestY * invScale),
    size: Math.min(nativeSize, Math.min(nativeWidth, nativeHeight)),
  }
}

/**
 * Generate a zoomed preview of a specific edge region.
 * Crops the region from the source image at native resolution,
 * applies contraction + contour smoothing, then magnifies by `zoom`x.
 */
export async function generateZoomPreview(
  src: string,
  nativeWidth: number,
  nativeHeight: number,
  region: { x: number; y: number; size: number },
  contractionRadius: number,
  smoothingRadius: number,
  zoom: number = 4,
): Promise<string> {
  const img = await loadImage(src)

  // Clamp region to image bounds
  const x = Math.max(0, Math.min(nativeWidth - region.size, region.x))
  const y = Math.max(0, Math.min(nativeHeight - region.size, region.y))
  const size = Math.min(region.size, Math.min(nativeWidth, nativeHeight))

  // Crop the region at native resolution
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = size
  cropCanvas.height = size
  const cropCtx = cropCanvas.getContext('2d')!
  cropCtx.drawImage(img, x, y, size, size, 0, 0, size, size)

  // Apply contraction then contour smoothing
  if (contractionRadius > 0 || smoothingRadius > 0) {
    const imageData = cropCtx.getImageData(0, 0, size, size)
    contractAlpha(imageData.data, size, size, contractionRadius)
    contourSmooth(imageData.data, size, size, smoothingRadius)
    cropCtx.putImageData(imageData, 0, 0)
  }

  // Scale up by zoom factor
  const outSize = Math.round(size * zoom)
  const outCanvas = document.createElement('canvas')
  outCanvas.width = outSize
  outCanvas.height = outSize
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = false // Nearest-neighbor for pixel-level detail
  outCtx.drawImage(cropCanvas, 0, 0, outSize, outSize)

  return outCanvas.toDataURL('image/png')
}
