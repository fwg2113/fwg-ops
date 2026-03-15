/**
 * Alpha threshold edge cleanup for DTF transfers.
 * Ported from Frederick Apparel DTF Gang Sheet Builder.
 *
 * Converts gradient/semi-transparent pixels to hard edges:
 * - Below threshold: fully transparent (alpha = 0)
 * - Above threshold: fully opaque (alpha = 255)
 */
export async function applyAlphaThreshold(
  src: string,
  nativeWidth: number,
  nativeHeight: number,
  threshold: number = 50,
): Promise<{ url: string; width: number; height: number }> {
  const alphaThreshold = Math.round((Math.max(0, Math.min(100, threshold)) / 100) * 255)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || nativeWidth
      const h = img.naturalHeight || nativeHeight

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)

      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data

      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i]
        if (alpha === 0 || alpha === 255) continue
        data[i] = alpha >= alphaThreshold ? 255 : 0
      }

      ctx.putImageData(imageData, 0, 0)
      resolve({ url: canvas.toDataURL('image/png'), width: w, height: h })
    }
    img.onerror = () => reject(new Error('Failed to load image for edge cleanup'))
    img.src = src
  })
}

/**
 * Preview at reduced resolution for slider responsiveness.
 */
export async function previewAlphaThreshold(
  src: string,
  nativeWidth: number,
  nativeHeight: number,
  threshold: number,
): Promise<string> {
  const alphaThreshold = Math.round((Math.max(0, Math.min(100, threshold)) / 100) * 255)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = 512
      const scale = Math.min(1, maxDim / Math.max(nativeWidth, nativeHeight))
      const w = Math.max(1, Math.round(nativeWidth * scale))
      const h = Math.max(1, Math.round(nativeHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)

      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data

      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i]
        if (alpha === 0 || alpha === 255) continue
        data[i] = alpha >= alphaThreshold ? 255 : 0
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load image for preview'))
    img.src = src
  })
}
